import "server-only";

/**
 * Automatic discovery — the two lookups that used to be the user's homework.
 *
 * 1. READ THEIR SITE. Fetch the homepage, pull the title, description, headings
 *    and visible copy, and derive the brand read from real text instead of from
 *    a form. Everything derived is labelled `model_interpretation` exactly as
 *    before: a reading, correctable, never a fact.
 * 2. FIND WHO IS ACTUALLY ADVERTISING. Rather than guessing company names, we
 *    sweep the PUBLIC Ad Library for the category words the site itself uses and
 *    see which advertisers come back. An advertiser discovered this way is
 *    evidence — they are demonstrably buying ads in that market under that term
 *    — which is a stronger basis than a list of names invented from a category.
 *
 * The honesty line is unchanged: no performance figure exists in any of this.
 */

import { MARKET_PRESETS, type SearchSpec } from "./ad-library";
import { sweepMany, type SweptAd } from "./sweep";

const FETCH_TIMEOUT_MS = 15_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export type SiteRead = {
  ok: boolean;
  url: string | null;
  brandName: string;
  title: string;
  description: string;
  headings: string[];
  /** Words the site itself uses to describe what it sells. */
  categoryTerms: string[];
  /** Country codes hinted at by the copy or the domain, e.g. AE from .ae. */
  countryHints: string[];
  languageHint: string;
  /** Plain-words note for the UI when the read was thin or failed. */
  note: string;
};

/**
 * Strip a page down to VISIBLE PROSE.
 *
 * The order matters. Script and style bodies go first, then JSON blobs and
 * inline handlers, and only then the tags themselves. Stripping tags first
 * dumps every attribute value into the text — which is how `opacity-100`,
 * `width '1024'` and `handleMouseEnter` end up looking like a brand's category
 * words, and then become Ad Library searches.
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[a-z][^>]*>/gi, " ")
    .replace(/<\/[a-z][^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/** Text that is code or markup residue rather than something a person reads. */
function looksLikeCode(text: string): boolean {
  return (
    /[{}<>[\]|\\]/.test(text) ||
    /[_$]/.test(text) ||
    /\b(function|const|var|let|null|undefined|true|false|window|document|className|onclick)\b/i.test(text) ||
    /\b[a-z]+-\d{2,4}\b/i.test(text) ||
    /\bdata-|aria-|px\b/i.test(text) ||
    /['"]/.test(text)
  );
}

function decode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]).slice(0, 400);
  }
  return "";
}

/**
 * Words that are NAVIGATION rather than category. This list matters more than it
 * looks: these terms become Ad Library searches, and searching "bestsellers" or
 * "customer favorites" returns whoever happens to use that word rather than the
 * brand's actual competitors. A junk term costs a whole 40-second search.
 */
const STOPWORDS = new Set(
  ("the a an and or of for to in on with your you we our us is are be by at from this that it as "
    + "shop now buy get more all new best top free home page site website online official store "
    + "about contact privacy terms cookies login sign menu search cart account help support faq "
    + "than then them they their there here what when where which who why how can will just also "
    + "not no yes but if so up out over into any every each other same very much many most only "
    + "arrivals bestsellers bestseller favorites favourites collection collections featured sale "
    + "shipping returns delivery checkout wishlist reviews review rated stars gift gifts card "
    + "sizes size color colors colour colours women women's men men's kids unisex accessories "
    + "redirecting redirect loading javascript enabled browser cookie skip content main navigation "
    + "quick view add bag basket subscribe newsletter email address follow instagram facebook "
    + "explore discover learn view see click here read blog stories story journal press careers "
    + "sustainability sustainable materials story team values impact faqs track order help centre "
    // Verbs, adverbs and connectives. A category term is a NOUN PHRASE — these
    // words only ever produce fragments like "clothing made" or "everything could",
    // which as an Ad Library search return nothing related to the category.
    + "made make makes making called call calls could would should might must does doing done "
    + "possibly probably actually really simply truly literally basically honestly maybe perhaps "
    + "think thinks thought filled fill fills bring brings brought build builds built built "
    + "across into onto within without through during before after while since until unless "
    + "like likes liked love loves want wants need needs know knows keep keeps take takes "
    + "give gives put puts find finds found feel feels look looks looking come comes going "
    + "made-with everything everyone anything anyone nothing nobody something someone somewhere "
    + "designed created built-for crafted powered backed trusted loved chosen rated proven "
    + "introducing meet welcome hello thanks thank please sorry yeah okay wait stop start")
    .split(" "),
);

const TLD_COUNTRY: Record<string, string> = {
  ae: "AE",
  sa: "SA",
  kw: "KW",
  qa: "QA",
  uk: "GB",
  de: "DE",
  at: "AT",
  ch: "CH",
  fr: "FR",
  es: "ES",
  it: "IT",
  nl: "NL",
  se: "SE",
  no: "NO",
  dk: "DK",
  fi: "FI",
  au: "AU",
  nz: "NZ",
  sg: "SG",
  my: "MY",
  id: "ID",
  ph: "PH",
  in: "IN",
  ca: "CA",
  us: "US",
  ie: "IE",
  za: "ZA",
};

const COUNTRY_WORDS: Array<[RegExp, string]> = [
  [/\b(uae|united arab emirates|dubai|abu dhabi|sharjah)\b/i, "AE"],
  [/\b(saudi|ksa|riyadh|jeddah)\b/i, "SA"],
  [/\b(kuwait)\b/i, "KW"],
  [/\b(qatar|doha)\b/i, "QA"],
  [/\b(united kingdom|london|manchester|\buk\b)\b/i, "GB"],
  [/\b(united states|\busa\b|new york|california)\b/i, "US"],
  [/\b(germany|berlin|münchen|munich|deutschland)\b/i, "DE"],
  [/\b(australia|sydney|melbourne)\b/i, "AU"],
  [/\b(singapore)\b/i, "SG"],
  [/\b(india|mumbai|bengaluru|delhi)\b/i, "IN"],
  [/\b(canada|toronto|vancouver)\b/i, "CA"],
];

function normaliseUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function brandFromHost(host: string): string {
  const bare = host.replace(/^www\./i, "").split(".")[0];
  return bare
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Pull the CATEGORY WORDS a site uses about itself.
 *
 * These terms become Ad Library searches, and each search costs ~40 seconds and
 * returns whoever uses that word — so a junk term is worse than a missing one.
 * That is why this reads only the page's own PITCH: the title, the meta
 * description and the headings. Full body text is dominated by cookie banners,
 * returns policies and privacy copy, which produced terms like "personal
 * information" and sent discovery looking for insurance companies.
 */
function deriveTerms(input: {
  title: string;
  description: string;
  headings: string[];
  brandName: string;
}): string[] {
  const brandWords = new Set(
    input.brandName
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2),
  );

  const pitch = [input.title, input.description, ...input.headings.slice(0, 8)]
    .join(" . ")
    .toLowerCase();

  const sentences = pitch
    .split(/[.!?|·—–:;,()]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const phraseCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();

  for (const sentence of sentences) {
    const words = sentence
      .replace(/[^a-z\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.replace(/^-+|-+$/g, ""))
      .filter(
        (word) =>
          word.length >= 4 &&
          word.length <= 20 &&
          !STOPWORDS.has(word) &&
          !brandWords.has(word) &&
          /^[a-z][a-z-]*[a-z]$/.test(word),
      );

    for (const word of words) wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);

    // Phrases only WITHIN a sentence — across a boundary they are meaningless.
    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  const topPhrases = [...phraseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([phrase]) => phrase);

  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word]) => word);

  const merged: string[] = [];
  for (const term of [...topPhrases, ...topWords]) {
    if (merged.some((existing) => existing.includes(term) || term.includes(existing))) continue;
    merged.push(term);
    if (merged.length >= 5) break;
  }
  return merged;
}

/** Fetch and read a brand's own site. Plain GET, no rendering, never throws. */
export async function readSite(input: string): Promise<SiteRead> {
  const url = normaliseUrl(input);
  const blank: SiteRead = {
    ok: false,
    url,
    brandName: "",
    title: "",
    description: "",
    headings: [],
    categoryTerms: [],
    countryHints: [],
    languageHint: "any",
    note: "",
  };

  if (!url) {
    return {
      ...blank,
      note: "That doesn't look like a website address. Try it with the full domain, like acme.com.",
    };
  }

  const host = new URL(url).hostname;
  const fallbackName = brandFromHost(host);
  const tld = host.split(".").pop() ?? "";
  const tldCountry = TLD_COUNTRY[tld.toLowerCase()];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) throw new Error(`status-${response.status}`);
    let html = (await response.text()).slice(0, 900_000);

    // Some sites answer the bare domain with a redirect interstitial that has no
    // real copy in it. Follow the meta-refresh or the canonical once, otherwise
    // the whole read is built on the word "redirecting".
    if (html.length < 60_000 || /redirecting/i.test(html.slice(0, 3_000))) {
      const hop =
        (html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i) ?? [])[1] ??
        (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i) ?? [])[1];
      if (hop) {
        try {
          const next = new URL(hop, url).toString();
          if (next !== url) {
            const second = await fetch(next, {
              cache: "no-store",
              redirect: "follow",
              signal: controller.signal,
              headers: {
                "User-Agent": UA,
                Accept: "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
              },
            });
            if (second.ok) {
              const body = (await second.text()).slice(0, 900_000);
              if (body.length > html.length) html = body;
            }
          }
        } catch {
          // Keep the first response; a failed hop is not a failed read.
        }
      }
    }

    const title = meta(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i,
      /<title[^>]*>([\s\S]{1,300}?)<\/title>/i,
    ]);
    const description = meta(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i,
    ]);
    const ogTitle = meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    ]);

    const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]{2,200}?)<\/h[1-3]>/gi)]
      .map((match) => decode(stripTags(match[1])))
      .filter((text) => text.length > 2 && text.length < 140)
      .slice(0, 12);

    // Only PROSE feeds the term derivation — sentences with real words in them.
    const body = decode(stripTags(html))
      .split(/(?<=[.!?])\s+|\s{2,}/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 12 && chunk.split(" ").length >= 3 && !looksLikeCode(chunk))
      .join(" ");

    const langAttr = (html.match(/<html[^>]+lang=["']([a-z]{2})/i) ?? [])[1];

    const countryHints = new Set<string>();
    if (tldCountry) countryHints.add(tldCountry);
    for (const [pattern, code] of COUNTRY_WORDS) {
      if (pattern.test(`${title} ${description} ${headings.join(" ")} ${body.slice(0, 6_000)}`)) {
        countryHints.add(code);
      }
    }

    const brandName =
      (title.split(/[|–—:·-]/)[0] ?? "").trim().slice(0, 60) ||
      ogTitle.split(/[|–—:·-]/)[0]?.trim().slice(0, 60) ||
      fallbackName;

    const categoryTerms = deriveTerms({
      title,
      description,
      headings,
      brandName: brandName || fallbackName,
    });

    return {
      ok: true,
      url,
      brandName: brandName || fallbackName,
      title,
      description,
      headings,
      categoryTerms,
      countryHints: [...countryHints],
      languageHint: langAttr?.toLowerCase() ?? "any",
      note:
        categoryTerms.length >= 3
          ? "Read your site and pulled the words your market searches under."
          : "Your site was reachable but light on text, so the category read is thin. Correct it below.",
    };
  } catch {
    return {
      ...blank,
      brandName: fallbackName,
      countryHints: tldCountry ? [tldCountry] : [],
      note: "Your site didn't load for us, so the read below comes from your domain name alone. Correct anything wrong.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Match the country hints onto one of the known market presets. */
export function chooseMarket(input: {
  countryHints: string[];
  languageHint: string;
}): { label: string; countries: string[]; languages: string[]; note: string } {
  const hints = input.countryHints.filter(Boolean);

  if (hints.length > 0) {
    const preset = MARKET_PRESETS.find((market) =>
      hints.some((code) => (market.countries as readonly string[]).includes(code)),
    );
    if (preset) {
      return {
        label: preset.label,
        countries: [...preset.countries],
        languages: [...preset.languages],
        note: `Matched to ${preset.label} from your site.`,
      };
    }
    return {
      label: hints.join(", "),
      countries: hints,
      languages: [input.languageHint === "any" ? "en" : input.languageHint],
      note: "Market taken from your site's own signals.",
    };
  }

  return {
    label: "United States",
    countries: ["US"],
    languages: ["en"],
    note: "Your site gave no country signal, so we started with the US. Change it if that's wrong.",
  };
}

// ─── Finding who is actually advertising ──────────────────────────────────────

export type DiscoveredAdvertiser = {
  name: string;
  /** DIRECT · ADJACENT · ATTENTION */
  tier: "DIRECT" | "ADJACENT" | "ATTENTION";
  whyUseful: string;
  /** 0–100. Evidence-based: how strongly this advertiser owns the term. */
  confidence: number;
  /** How many swept ads this advertiser had across the discovery sweep. */
  adCount: number;
  /** The category terms they showed up under. */
  terms: string[];
};

export type DiscoveryReport = {
  advertisers: DiscoveredAdvertiser[];
  termsSwept: string[];
  /** Ads seen during discovery, kept so nothing is swept twice. */
  seenAds: SweptAd[];
  blockedTerms: string[];
  note: string;
};

function tidyName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * Sweep the category terms and rank the advertisers that come back.
 *
 * An advertiser here is EVIDENCE, not a guess: they are demonstrably running
 * ads in this country under a word this brand's own site uses.
 */
export async function discoverAdvertisers(input: {
  brandName: string;
  categoryTerms: string[];
  country: string;
  language: string;
  mediaType: string;
}): Promise<DiscoveryReport> {
  const terms = input.categoryTerms.slice(0, 3);
  if (terms.length === 0) {
    return {
      advertisers: [],
      termsSwept: [],
      seenAds: [],
      blockedTerms: [],
      note: "There were no category words to search under, so nobody was discovered automatically.",
    };
  }

  const specs: SearchSpec[] = terms.map((term) => ({
    competitorName: term,
    country: input.country,
    language: input.language,
    mediaType: input.mediaType,
    activeStatus: "active",
  }));

  // One round of three, so discovery costs about as long as a single search.
  const outcomes = await sweepMany(specs, { concurrency: 3, limit: 30 });

  const byAdvertiser = new Map<
    string,
    { name: string; adCount: number; terms: Set<string>; bestRank: number }
  >();
  const seenAds: SweptAd[] = [];
  const blockedTerms: string[] = [];
  const brandLower = input.brandName.toLowerCase();

  outcomes.forEach((outcome, index) => {
    const term = terms[index];
    if (!outcome.ok || outcome.blocked) {
      if (outcome.blocked) blockedTerms.push(term);
      return;
    }
    for (const ad of outcome.ads) {
      seenAds.push(ad);
      const name = tidyName(ad.advertiser);
      if (!name || name.length < 2) continue;
      const key = name.toLowerCase();
      const existing = byAdvertiser.get(key);
      if (existing) {
        existing.adCount += 1;
        existing.terms.add(term);
        existing.bestRank = Math.min(existing.bestRank, ad.resultRank);
      } else {
        byAdvertiser.set(key, {
          name,
          adCount: 1,
          terms: new Set([term]),
          bestRank: ad.resultRank,
        });
      }
    }
  });

  const ranked = [...byAdvertiser.values()]
    .filter((entry) => !entry.name.toLowerCase().includes(brandLower) || brandLower.length < 3)
    .sort((a, b) => {
      const spread = b.terms.size - a.terms.size;
      if (spread !== 0) return spread;
      const volume = b.adCount - a.adCount;
      if (volume !== 0) return volume;
      return a.bestRank - b.bestRank;
    })
    .slice(0, 9);

  const advertisers: DiscoveredAdvertiser[] = ranked.map((entry, index) => {
    const termList = [...entry.terms];
    const tier: DiscoveredAdvertiser["tier"] =
      termList.length > 1 || index < 3 ? "DIRECT" : index < 6 ? "ADJACENT" : "ATTENTION";
    // Confidence is evidence, stated as evidence: breadth of terms plus volume.
    const confidence = Math.min(
      95,
      40 + termList.length * 15 + Math.min(entry.adCount, 8) * 3,
    );
    return {
      name: entry.name,
      tier,
      whyUseful:
        termList.length > 1
          ? `Running ads in ${input.country} under ${termList.length} of your category words (${termList.join(", ")}).`
          : `Running ads in ${input.country} under "${termList[0]}" — ${entry.adCount} ad${entry.adCount === 1 ? "" : "s"} seen.`,
      confidence,
      adCount: entry.adCount,
      terms: termList,
    };
  });

  // The brand's own ads are always worth a board, as the baseline.
  advertisers.unshift({
    name: input.brandName,
    tier: "DIRECT",
    whyUseful: "Your own ads are the baseline every other board sits against.",
    confidence: 95,
    adCount: 0,
    terms: [],
  });

  return {
    advertisers,
    termsSwept: terms,
    seenAds,
    blockedTerms,
    note:
      advertisers.length > 1
        ? `${advertisers.length - 1} advertisers found actually running ads in ${input.country}.`
        : "No other advertisers came back from those searches. Add competitors by name below.",
  };
}
