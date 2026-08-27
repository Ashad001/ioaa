import "server-only";

/**
 * IS THIS ADVERTISER ACTUALLY IN YOUR MARKET?
 *
 * The Ad Library's keyword search is deliberately loose. Search "complete food"
 * in GB and it will happily hand back a dog-food brand, a first-aid trainer and
 * an affiliate page, because one of those words appeared somewhere in the ad.
 * Taking that list at face value is how a competitive analysis ends up naming
 * companies the user has never competed with — which destroys trust in every
 * other number on the screen, however carefully those were counted.
 *
 * So a candidate has to EARN its place. We hold each advertiser's own ad copy up
 * against the vocabulary of the user's own site and ask three questions:
 *
 *   1. Does their copy use the market's language, not just one loose keyword?
 *   2. Do they read like a brand selling a product, rather than an affiliate,
 *      a marketplace reseller, a recruiter or a lead-gen page?
 *   3. Did more than one signal put them here?
 *
 * Everything here is derived from text the sweep actually read. There is no
 * model call, no invented score, and every rejection carries a plain-words
 * reason the UI can show — because "we dropped 6 advertisers" without saying
 * why is just a different kind of guessing.
 */

/** A candidate's evidence, gathered from the ads the sweep read. */
export type Candidate = {
  name: string;
  /** Every ad's copy, concatenated — headline, body and CTA. */
  copy: string;
  /** How many ads of theirs came back. */
  adCount: number;
  /** Which of the site's category terms surfaced them. */
  terms: string[];
  /** Best position they held in any result page we read. NOT a metric. */
  bestRank: number;
  /** Display links seen on their cards, e.g. HUEL.COM. */
  displayLinks: string[];
};

export type Verdict = {
  name: string;
  /** true = belongs on the map. */
  keep: boolean;
  /** 0–100. Evidence strength, never a performance figure. */
  score: number;
  /** Plain words: why this advertiser is, or is not, in this market. */
  reason: string;
  /** The market words their own ads share with the user's site. */
  sharedWords: string[];
};

/**
 * Advertisers who sell OTHER PEOPLE'S products, teach, recruit, or aggregate.
 * They match category keywords constantly and compete with nobody's creative.
 */
const NOT_A_COMPETITOR = [
  "amazon associates",
  "amazon",
  "ebay",
  "etsy",
  "aliexpress",
  "temu",
  "shein",
  "groupon",
  "wowcher",
  "trustpilot",
  "indeed",
  "reed.co.uk",
  "totaljobs",
  "linkedin",
  "coursera",
  "udemy",
  "skillshare",
  "gumtree",
  "craigslist",
  "vinted",
  "depop",
];

/** Words in a name that mark a reseller, affiliate, course or directory. */
const ROLE_FLAGS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\baffiliate|afflink|associates\b/i, reason: "an affiliate account, not a brand" },
  { pattern: /\b(training|academy|courses?|masterclass|bootcamp)\b/i, reason: "sells training, not this product" },
  { pattern: /\b(recruit|jobs?|careers|hiring|staffing)\b/i, reason: "a recruiter" },
  { pattern: /\b(marketplace|wholesale|distributor|dropship)\b/i, reason: "a reseller or marketplace" },
  { pattern: /\b(compare|comparison|reviews?|deals?|coupons?|voucher)\b/i, reason: "a deals or review site" },
  { pattern: /\b(agency|marketing|seo|ads? management)\b/i, reason: "sells marketing services" },
];

/** Copy that reads as affiliate or arbitrage rather than a brand's own ad. */
const COPY_FLAGS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(ad\s*\|\s*afflink|afflink|commissions? earned|paid link)\b/i, reason: "affiliate disclosure in the copy" },
  { pattern: /\blink in bio\b.*\b(shop|buy)\b/i, reason: "reads as affiliate promotion" },
  { pattern: /\b(work from home|earn \S{0,4}\d+ ?(per|a) (day|week|month))\b/i, reason: "an income offer, not this category" },
];

const NOISE = new Set([
  "the","and","for","with","your","you","our","are","from","that","this","have","has",
  "was","were","will","can","all","any","get","now","new","more","most","best","just",
  "out","not","but","how","why","what","when","who","its","it's","they","them","their",
  "been","only","also","than","then","into","over","off","per","every","each","one","two",
  "free","shop","buy","save","off","sale","today","order","click","learn","sign","book",
  "here","now","don't","dont","see","use","make","made","try","need","want","like","love",
  "day","days","week","weeks","month","months","year","years","time","times","people",
  "help","really","very","much","many","some","about","after","before","because","would",
  "could","should","did","does","doing","got","goes","went","say","says","said","know",
  "think","thought","feel","felt","look","looks","looking","take","takes","took","give",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[-']+|[-']+$/g, ""))
    .filter((word) => word.length >= 4 && word.length <= 22 && !NOISE.has(word));
}

/**
 * Build the market's own vocabulary from the user's site.
 *
 * This is the yardstick every candidate is measured against, so it comes from
 * the user's own words — never from a category list we made up.
 */
export function marketVocabulary(input: {
  categoryTerms: string[];
  title: string;
  description: string;
  headings: string[];
}): Set<string> {
  const vocabulary = new Set<string>();
  const source = [
    ...input.categoryTerms,
    input.title,
    input.description,
    ...input.headings.slice(0, 12),
  ].join(" . ");
  for (const word of words(source)) vocabulary.add(word);
  // The multi-word category terms count as single signals too.
  for (const term of input.categoryTerms) {
    const cleaned = term.trim().toLowerCase();
    if (cleaned.length >= 4) vocabulary.add(cleaned);
  }
  return vocabulary;
}

/**
 * Judge one candidate against the market's vocabulary.
 *
 * The threshold is deliberately a floor, not a ranking: this decides who is in
 * the market at all. Ranking happens later, on the collected ads.
 */
export function judge(
  candidate: Candidate,
  vocabulary: Set<string>,
  options: { ownBrand: string; country: string },
): Verdict {
  const name = candidate.name.trim();
  const lowerName = name.toLowerCase();

  // The user's own brand is never a competitor of itself.
  const ownBrand = options.ownBrand.trim().toLowerCase();
  if (ownBrand.length >= 3 && lowerName.includes(ownBrand)) {
    return {
      name,
      keep: false,
      score: 0,
      reason: "This is you.",
      sharedWords: [],
    };
  }

  if (NOT_A_COMPETITOR.some((entry) => lowerName === entry || lowerName.startsWith(`${entry} `))) {
    return {
      name,
      keep: false,
      score: 0,
      reason: "A marketplace or platform rather than a brand in your market.",
      sharedWords: [],
    };
  }

  for (const flag of ROLE_FLAGS) {
    if (flag.pattern.test(lowerName)) {
      return {
        name,
        keep: false,
        score: 0,
        reason: `Reads as ${flag.reason}.`,
        sharedWords: [],
      };
    }
  }

  for (const flag of COPY_FLAGS) {
    if (flag.pattern.test(candidate.copy)) {
      return {
        name,
        keep: false,
        score: 0,
        reason: `Dropped — ${flag.reason}.`,
        sharedWords: [],
      };
    }
  }

  // How much of the market's language do their own ads actually speak?
  const theirWords = new Set(words(candidate.copy));
  const shared: string[] = [];
  for (const word of theirWords) {
    if (vocabulary.has(word)) shared.push(word);
  }
  // A whole category phrase appearing verbatim is a stronger signal than a word.
  let phraseHits = 0;
  for (const term of vocabulary) {
    if (term.includes(" ") && candidate.copy.toLowerCase().includes(term)) phraseHits += 1;
  }

  const overlap = shared.length;
  const breadth = candidate.terms.length;

  // Evidence adds up: shared language, whole phrases, breadth of terms, volume.
  const score = Math.min(
    99,
    Math.round(
      Math.min(overlap, 12) * 5 +
        phraseHits * 12 +
        (breadth - 1) * 14 +
        Math.min(candidate.adCount, 6) * 2,
    ),
  );

  // The floor: an advertiser must speak the market's language in more than a
  // single incidental word, OR have surfaced under more than one of the user's
  // own category terms. One loose keyword hit on its own is not evidence.
  const keep = overlap >= 3 || phraseHits >= 1 || breadth >= 2;

  const sharedWords = shared.slice(0, 6);

  return {
    name,
    keep,
    score: keep ? Math.max(score, 30) : score,
    reason: keep
      ? breadth >= 2
        ? `Running ads in ${options.country} under ${breadth} of your own category words${
            sharedWords.length > 0 ? `, and their copy shares your market's language (${sharedWords.slice(0, 3).join(", ")})` : ""
          }.`
        : phraseHits >= 1
          ? `Their ads use your category wording verbatim, in ${options.country}.`
          : `Their ad copy shares ${overlap} of your market's words (${sharedWords.slice(0, 3).join(", ")}), in ${options.country}.`
      : overlap === 0
        ? "Their ads never use your market's vocabulary — a loose keyword match only."
        : `Only ${overlap} word${overlap === 1 ? "" : "s"} in common with your market, from one search term.`,
    sharedWords,
  };
}
