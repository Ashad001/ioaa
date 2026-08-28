/**
 * READING AN AD LIBRARY PAGE THE USER COPIED OUT OF THEIR OWN BROWSER.
 *
 * WHY THIS EXISTS. Meta blocks datacentre reads of the Ad Library, and in some
 * countries the official API is not available at all — so a server may be unable
 * to see a page that the user's own browser renders perfectly. That asymmetry is
 * the whole opportunity: the person running IOAA.AI can open the public Library
 * page themselves, select the page, copy it, and paste it here. No key, no
 * account, no signup, nothing to connect.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE. Like `ad-library.ts`, this module is
 * STRING WORK ONLY — it performs no network request of any kind and imports
 * nothing server-side, so the same function can preview a paste in the browser
 * and commit it on the server. Keep it that way.
 *
 * THE HONESTY RULE THIS FILE MUST NOT BREAK. Every field here either appeared in
 * the text the user pasted, or it stays blank. The parser never fills a gap, never
 * rounds a date, never turns "multiple versions" into a number, and never invents
 * a performance figure — the public Library publishes no spend, click or
 * conversion for a commercial ad, so none can be read out of it. Each card
 * therefore reports BOTH what was read and what was missing, and the interface
 * shows the second list as plainly as the first.
 */

export const LIBRARY_ID_PATTERN = /library\s*id[:\s]+([0-9]{6,})/i;

/** Meta's own button labels. Used to recognise a CTA, never to supply one. */
const CTA_LABELS = [
  "Learn more",
  "Shop now",
  "Sign up",
  "Book now",
  "Book travel",
  "Get offer",
  "Get quote",
  "Get showtimes",
  "Download",
  "Install now",
  "Apply now",
  "Contact us",
  "Send message",
  "Send WhatsApp message",
  "Subscribe",
  "Order now",
  "Watch more",
  "See menu",
  "Play game",
  "Donate now",
  "Listen now",
  "Request time",
  "Buy tickets",
  "Open link",
  "Call now",
  "Save",
];

/** Page furniture. Never an advertiser, a headline or a body. */
const CHROME = [
  "sponsored",
  "see ad details",
  "see summary details",
  "see details",
  "ad details",
  "summary details",
  "open drop-down",
  "platforms",
  "platform",
  "active",
  "inactive",
  "results",
  "result",
  "see more",
  "see less",
  "translate",
  "see translation",
  "why am i seeing this ad?",
  "hide",
  "report ad",
  "id",
  "library id",
  "this ad has multiple versions",
  "multiple versions",
  "about this advertiser",
  "advertiser",
  "eu transparency",
  "beneficiary",
  "payer",
  "categories",
  "filters",
  "search results",
  "log in",
  "create ad",
  "ad library",
  "all ads",
];

const PLATFORM_WORDS: { key: string; test: RegExp }[] = [
  { key: "facebook", test: /\bfacebook\b/i },
  { key: "instagram", test: /\binstagram\b/i },
  { key: "audience_network", test: /\baudience network\b/i },
  { key: "messenger", test: /\bmessenger\b/i },
];

export type PastedAd = {
  libraryId: string | null;
  libraryUrl: string | null;
  advertiser: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  displayLink: string;
  platforms: string[];
  /** active · inactive · unknown — exactly what the page said, or nothing. */
  activeStatus: string;
  visibleStartDate: string;
  /** Where it sat in the order the user's own browser showed. 1-based. */
  resultRank: number;
  /** Only ever a number the page printed. "Multiple versions" is a note. */
  variantCount: number;
  /** Anything the page stated that isn't a column, kept verbatim. */
  notes: string[];
  /** Field names actually read off the page — drives provenance. */
  readFields: string[];
  /** What this card did NOT show, in plain words for the user. */
  missing: string[];
};

export type PasteReading = {
  ads: PastedAd[];
  /** How the cards were recognised, so the UI can explain a thin read. */
  route: "cards" | "links" | "none";
  /** Non-blank lines that belonged to no card. */
  strayLines: number;
  /** Why nothing was read, in the user's language. Null when ads were found. */
  problem: string | null;
  /** How to get a better paste next time, when the read looks thin. */
  hint: string | null;
};

function isChrome(line: string) {
  const flat = line.trim().toLowerCase().replace(/[:·|]+$/, "").trim();
  if (!flat) return true;
  if (CHROME.includes(flat)) return true;
  if (/^library id/i.test(flat)) return true;
  if (/^started running/i.test(flat)) return true;
  if (/^total active time/i.test(flat)) return true;
  if (/^\d+\s+(ads?|results?)\b/i.test(flat)) return true;
  if (/^(id|ad id)\s*[:#]/i.test(flat)) return true;
  // "Platforms Facebook Instagram" arrives as ONE line in a page copy, and it is
  // long enough to be mistaken for an advertiser name. It is furniture.
  if (/^platforms?\b/i.test(flat)) return true;
  if (/^this ad has\s+\d+\s+versions?/i.test(flat)) return true;
  if (/^total active time/i.test(flat)) return true;
  return false;
}

function isDomainLine(line: string) {
  const flat = line.trim().replace(/^https?:\/\//i, "");
  if (/\s/.test(flat)) return false;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s]*)?$/i.test(flat);
}

function matchCta(line: string) {
  const flat = line.trim().replace(/[.\s]+$/, "").toLowerCase();
  return CTA_LABELS.find((label) => label.toLowerCase() === flat) ?? "";
}

function libraryUrlFor(id: string) {
  return `https://www.facebook.com/ads/library/?id=${id}`;
}

/** Every Library permalink id in a blob of text, in the order it appears. */
function harvestLinks(text: string): string[] {
  const found: string[] = [];
  const links = text.match(/https?:\/\/[^\s"'<>]*facebook\.com\/ads\/library\/?\?[^\s"'<>]*/gi) ?? [];
  for (const link of links) {
    const id = link.match(/[?&]id=([0-9]{6,})/)?.[1];
    if (id && !found.includes(id)) found.push(id);
  }
  return found;
}

function readCard(lines: string[], rank: number): PastedAd {
  const idLine = lines.find((line) => LIBRARY_ID_PATTERN.test(line)) ?? "";
  const libraryId = idLine.match(LIBRARY_ID_PATTERN)?.[1] ?? null;

  let visibleStartDate = "";
  let activeStatus = "unknown";
  let ctaLabel = "";
  let displayLink = "";
  let variantCount = 1;
  const notes: string[] = [];
  const platforms: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    const started = line.match(/started running on\s*(.+)$/i);
    if (started && !visibleStartDate) {
      visibleStartDate = started[1].split(/\s*[·|]\s*/)[0].trim();
    }

    if (/^active$/i.test(line) && activeStatus === "unknown") activeStatus = "active";
    if (/^inactive$/i.test(line) && activeStatus === "unknown") activeStatus = "inactive";

    const cta = matchCta(line);
    if (cta && !ctaLabel) ctaLabel = cta;

    if (!displayLink && isDomainLine(line) && !/facebook\.com/i.test(line)) {
      displayLink = line.replace(/^https?:\/\//i, "");
    }

    const versions = line.match(/this ad has (\d+) versions?/i);
    if (versions) variantCount = Number(versions[1]);
    else if (/multiple versions/i.test(line)) {
      // The page says "multiple" without a count. Recording 2 would be inventing
      // a figure, so it stays a sentence the user can read.
      notes.push("The page said this ad runs multiple versions, without saying how many.");
    }

    if (/eu transparency|beneficiary|payer/i.test(line)) {
      notes.push("Carries an EU transparency notice.");
    }

    for (const platform of PLATFORM_WORDS) {
      if (platform.test.test(line) && !platforms.includes(platform.key)) {
        platforms.push(platform.key);
      }
    }
  }

  // What's left after the furniture is the creative copy. The longest line is the
  // body; a short line ahead of it is usually the page name; a short line after it
  // is usually the headline. Where the shape is ambiguous the field stays blank.
  const candidates = lines
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 1 &&
        !isChrome(line) &&
        !matchCta(line) &&
        !isDomainLine(line) &&
        !LIBRARY_ID_PATTERN.test(line) &&
        !PLATFORM_WORDS.some((platform) => platform.test.test(line) && line.length < 24),
    );

  let bodyCopy = "";
  let bodyIndex = -1;
  candidates.forEach((line, index) => {
    if (line.length > bodyCopy.length) {
      bodyCopy = line;
      bodyIndex = index;
    }
  });
  // A short single line is a page NAME, not ad copy. Calling it the body would
  // put an advertiser's name where the creative text belongs and quietly corrupt
  // every later stage, so a body has to actually look like a sentence.
  if (bodyCopy.length < 40) {
    bodyCopy = "";
    bodyIndex = -1;
  }

  let advertiser = "";
  let headline = "";

  if (bodyIndex >= 0) {
    const before = candidates.slice(0, bodyIndex);
    const after = candidates.slice(bodyIndex + 1);
    advertiser = before.find((line) => line.length <= 70) ?? "";
    headline = after.find((line) => line.length <= 90 && line !== advertiser) ?? "";
  } else {
    // No body came through. What is left is read in page order: the name first,
    // then a headline if there is a second line. Never both from one line.
    const short = candidates.filter((line) => line.length <= 90);
    advertiser = short[0] ?? "";
    headline = short[1] ?? "";
  }

  const readFields: string[] = [];
  const missing: string[] = [];
  const record = (field: string, present: string | boolean, label: string) => {
    if (present) readFields.push(field);
    else missing.push(label);
  };
  record("advertiser", advertiser, "advertiser name");
  record("headline", headline, "headline");
  record("bodyCopy", bodyCopy, "ad copy");
  record("ctaLabel", ctaLabel, "button label");
  record("platforms", platforms.length > 0, "where it runs");
  record("activeStatus", activeStatus !== "unknown", "whether it is still running");
  record("visibleStartDate", visibleStartDate, "start date");

  return {
    libraryId,
    libraryUrl: libraryId ? libraryUrlFor(libraryId) : null,
    advertiser,
    headline,
    bodyCopy,
    ctaLabel,
    displayLink,
    platforms,
    activeStatus,
    visibleStartDate,
    resultRank: rank,
    variantCount,
    notes: Array.from(new Set(notes)),
    readFields,
    missing,
  };
}

/**
 * Read a pasted Ad Library page into ads.
 *
 * Cards are cut on "Library ID", which every real card carries exactly once and
 * which no ad copy contains — a far safer boundary than guessing at blank lines.
 * When a paste has no card text at all but does carry Library permalinks, each
 * link becomes a card holding only what the link itself proves: the ad exists and
 * where to see it. Nothing else is filled in.
 */
export function readLibraryPaste(input: string): PasteReading {
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map((line) => line.trim());
  const nonBlank = lines.filter(Boolean);

  if (nonBlank.length === 0) {
    return {
      ads: [],
      route: "none",
      strayLines: 0,
      problem: "Nothing pasted yet.",
      hint: null,
    };
  }

  /**
   * WHERE A CARD STARTS. Meta prints the Active/Inactive badge on the line ABOVE
   * "Library ID", so cutting on the ID alone files each card's own status with
   * the card before it — every ad then reports its neighbour's status. So the cut
   * moves up over a status line when there is one.
   */
  const anchors: number[] = [];
  lines.forEach((line, index) => {
    if (!LIBRARY_ID_PATTERN.test(line)) return;
    let start = index;
    while (start > 0 && /^(active|inactive)$/i.test(lines[start - 1] ?? "")) start -= 1;
    if (anchors.length > 0 && start <= anchors[anchors.length - 1]) start = index;
    anchors.push(start);
  });

  if (anchors.length > 0) {
    const ads: PastedAd[] = [];
    const seen = new Set<string>();
    anchors.forEach((start, position) => {
      const end = position + 1 < anchors.length ? anchors[position + 1] : lines.length;
      const block = lines.slice(start, end).filter(Boolean);
      const ad = readCard(block, ads.length + 1);
      const key = ad.libraryId ?? `${ad.advertiser}|${ad.bodyCopy}`;
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      ads.push({ ...ad, resultRank: ads.length + 1 });
    });

    const thin = ads.filter((ad) => !ad.bodyCopy && !ad.headline).length;
    return {
      ads,
      route: "cards",
      strayLines: anchors[0] === 0 ? 0 : lines.slice(0, anchors[0]).filter(Boolean).length,
      problem: ads.length === 0 ? "No ads could be read out of that text." : null,
      hint:
        ads.length > 0 && thin === ads.length
          ? "The ad references came through but none of the copy did. On the Library page, scroll until the ads have loaded, then select the whole page and copy it again."
          : null,
    };
  }

  const links = harvestLinks(text);
  if (links.length > 0) {
    return {
      ads: links.map((id, index) => ({
        libraryId: id,
        libraryUrl: libraryUrlFor(id),
        advertiser: "",
        headline: "",
        bodyCopy: "",
        ctaLabel: "",
        displayLink: "",
        platforms: [],
        activeStatus: "unknown",
        visibleStartDate: "",
        resultRank: index + 1,
        variantCount: 1,
        notes: [],
        readFields: [],
        missing: ["advertiser name", "headline", "ad copy", "button label", "start date"],
      })),
      route: "links",
      strayLines: 0,
      problem: null,
      hint: "Only the links came through, so these arrive as references you can open. Copying the whole Library page instead brings the copy, the button and the dates with it.",
    };
  }

  return {
    ads: [],
    route: "none",
    problem:
      "That text doesn't look like an Ad Library page. Open the search in your browser, wait for the ads to appear, select the whole page and copy it — then paste it here.",
    strayLines: nonBlank.length,
    hint: null,
  };
}

/** One-line summary of a reading, for a status line. */
export function describeReading(reading: PasteReading): string {
  if (reading.ads.length === 0) return reading.problem ?? "Nothing read yet.";
  const withCopy = reading.ads.filter((ad) => ad.bodyCopy || ad.headline).length;
  const withDate = reading.ads.filter((ad) => ad.visibleStartDate).length;
  return `${reading.ads.length} ad${reading.ads.length === 1 ? "" : "s"} read · ${withCopy} with copy · ${withDate} with a start date`;
}
