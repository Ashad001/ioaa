import "server-only";

/**
 * The automatic sweep — AdMirror reads the PUBLIC Meta Ad Library itself.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * 1. Everything read here is what any member of the public sees on the Ad
 *    Library page without logging in: Library ID, the visible "Started running"
 *    date, the advertiser, the ad copy, the headline, the call to action and the
 *    active/inactive label. No account, no cookie, no token, no private
 *    endpoint. If a field is not printed on that public page, it is not here.
 * 2. There is STILL NO PERFORMANCE FIGURE, and there never will be. Meta does
 *    not publish impressions, spend, CTR or ROAS for ordinary commercial ads, so
 *    the sweep cannot produce one. The honesty rules in `provenance.ts` hold
 *    exactly as before; swept facts carry their own provenance kind,
 *    `swept_from_public_library` — "AdMirror read this off the public page on
 *    this date", which is a weaker claim than a human seeing it, and the UI says
 *    so.
 * 3. The sweep is BEST-EFFORT BY DESIGN. The Library is a client-rendered page
 *    that changes without notice, so every extraction is defensive and a miss
 *    produces a REPORTED GAP, never a fabricated value. A run that sweeps
 *    nothing must still be completable by hand — that path stays first-class.
 *
 * The page needs JavaScript to render its cards, so the request goes through a
 * public read-through renderer that returns the rendered text of a URL. It is an
 * ordinary HTTPS GET; the app itself launches nothing.
 */

import { buildSearchUrl, type SearchSpec } from "./ad-library";

/** One swept ad card. */
export type SweptAd = {
  /** Meta's own Library ID — the stable public identifier for the ad. */
  libraryId: string;
  libraryUrl: string;
  advertiser: string;
  /** The visible "Started running on …" text, verbatim. Never inferred. */
  visibleStartDate: string | null;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  /** The display link shown on the card, e.g. NIKE.AE. */
  displayLink: string | null;
  /** active · inactive · unknown — exactly how the page labelled it. */
  activeStatus: string;
  /** Where it sat in the result order on the page we read. NOT a metric. */
  resultRank: number;
  /** True when the page said the ad has more than one version. */
  multipleVersions: boolean;
  /** Set when the card carried an EU transparency notice. */
  euTransparency: boolean;
};

export type SweepOutcome = {
  ok: boolean;
  url: string;
  ads: SweptAd[];
  /** Plain words — this is what the UI shows when a sweep falls short. */
  note: string;
  /** The Library asked for a login or showed a challenge. */
  blocked: boolean;
  /** The "~N results" line, verbatim, when the page printed one. */
  resultsLine: string | null;
  elapsedMs: number;
};

const RENDERER = "https://r.jina.ai/";
const REQUEST_TIMEOUT_MS = 75_000;

/** Fetch the RENDERED text of a public URL. Plain GET; nothing is executed here. */
async function renderedText(url: string, waitSeconds: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${RENDERER}${url}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/plain",
        "x-return-format": "text",
        "x-timeout": String(waitSeconds),
        "x-wait-for-selector": "div[role=main]",
      },
    });
    if (!response.ok) throw new Error(`renderer-${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Reading the page ─────────────────────────────────────────────────────────

const CTA_LABELS = new Set(
  [
    "shop now",
    "learn more",
    "sign up",
    "book now",
    "download",
    "get offer",
    "get quote",
    "apply now",
    "contact us",
    "send message",
    "send whatsapp message",
    "subscribe",
    "order now",
    "watch more",
    "play game",
    "install now",
    "use app",
    "see menu",
    "donate now",
    "buy tickets",
    "listen now",
    "request time",
    "get showtimes",
    "get directions",
    "call now",
    "save",
    "open link",
  ],
);

/** Card chrome — text the Library prints itself, never the advertiser's copy. */
function isChrome(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    [
      "platforms",
      "sponsored",
      "open dropdown",
      "see ad details",
      "see summary details",
      "this ad has multiple versions",
      "eu transparency",
      "active",
      "inactive",
      "copy",
      "filters",
      "sort",
      "sort by",
      "remove",
    ].includes(lower)
  ) {
    return true;
  }
  if (/^library id/i.test(line)) return true;
  if (/^started running/i.test(line)) return true;
  if (/^\d+\s+ads?\s+use this creative/i.test(line)) return true;
  if (/^~?[\d,]+ results$/i.test(line)) return true;
  if (/^active status:/i.test(line)) return true;
  return false;
}

const DISPLAY_LINK = /^[A-Z0-9][A-Z0-9.\-]{1,44}\.[A-Z]{2,8}$/;

/**
 * Pull the ad cards out of the rendered page text.
 *
 * The anchor is "Library ID: <digits>", printed once per card, so each card's
 * slice runs from its own anchor to the next. That holds even as the markup
 * around it changes, which it will.
 */
export function extractAds(rendered: string): {
  ads: SweptAd[];
  resultsLine: string | null;
} {
  const lines = rendered
    .split("\n")
    .map((line) => line.replace(/\u200b/g, "").trim())
    .filter((line) => line.length > 0);

  const resultsLine = lines.find((line) => /^~?[\d,]+ results$/i.test(line)) ?? null;

  const anchors: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^library id:\s*\d{5,}/i.test(lines[index])) anchors.push(index);
  }
  if (anchors.length === 0) return { ads: [], resultsLine };

  const ads: SweptAd[] = [];

  anchors.forEach((start, position) => {
    const end = position + 1 < anchors.length ? anchors[position + 1] : lines.length;
    const block = lines.slice(start, end);

    const libraryId = (block[0].match(/(\d{5,})/) ?? [])[1];
    if (!libraryId) return;

    const startedLine = block.find((line) => /^started running/i.test(line));
    const visibleStartDate = startedLine
      ? startedLine.replace(/^started running on\s*/i, "").trim() || null
      : null;

    // The status label sits immediately BEFORE the Library ID on this layout, so
    // look back one line as well as inside the block.
    const beforeAnchor = start > 0 ? lines[start - 1] : "";
    const statusSource = [beforeAnchor, ...block];
    const activeStatus = statusSource.some((line) => /^active$/i.test(line))
      ? "active"
      : statusSource.some((line) => /^inactive$/i.test(line))
        ? "inactive"
        : "unknown";

    const multipleVersions = block.some((line) =>
      /this ad has multiple versions/i.test(line),
    );
    const euTransparency = block.some((line) => /^eu transparency$/i.test(line));

    const sponsoredAt = block.findIndex((line) => /^sponsored$/i.test(line));
    const substantive = block
      .map((line, index) => ({ line, index }))
      .filter(
        ({ line }) =>
          !isChrome(line) && line.length > 1 && !/^\d+$/.test(line) && !/^https?:\/\//i.test(line),
      );

    // Advertiser: the last substantive line before "Sponsored".
    let advertiser = "";
    if (sponsoredAt >= 0) {
      const before = substantive.filter((entry) => entry.index < sponsoredAt);
      advertiser = before.length > 0 ? before[before.length - 1].line : "";
    }
    if (!advertiser && substantive.length > 0) advertiser = substantive[0].line;

    const rest = substantive
      .filter((entry) => entry.index > (sponsoredAt >= 0 ? sponsoredAt : -1))
      .map((entry) => entry.line)
      .filter((line) => line !== advertiser);

    const ctaLabel = rest.find((line) => CTA_LABELS.has(line.toLowerCase())) ?? "";
    const withoutCta = rest.filter((line) => line !== ctaLabel);

    const displayLinkAt = withoutCta.findIndex((line) => DISPLAY_LINK.test(line));
    const displayLink = displayLinkAt >= 0 ? withoutCta[displayLinkAt] : null;

    let bodyCopy = "";
    let headline = "";

    if (displayLinkAt >= 0) {
      // Layout on the public card: body copy · DISPLAY.LINK · headline · subtext.
      bodyCopy = withoutCta.slice(0, displayLinkAt).join(" ").trim();
      const after = withoutCta.slice(displayLinkAt + 1);
      headline = after[0] ?? "";
      if (!bodyCopy && after.length > 1) bodyCopy = after.slice(1).join(" ").trim();
    } else if (withoutCta.length > 0) {
      const longest = [...withoutCta].sort((a, b) => b.length - a.length)[0];
      bodyCopy = longest;
      headline = withoutCta.find((line) => line !== longest) ?? "";
    }

    ads.push({
      libraryId,
      libraryUrl: `https://www.facebook.com/ads/library/?id=${libraryId}`,
      advertiser: advertiser.slice(0, 160),
      visibleStartDate,
      headline: headline.slice(0, 300),
      bodyCopy: bodyCopy.slice(0, 1400),
      ctaLabel,
      displayLink,
      activeStatus,
      resultRank: position + 1,
      multipleVersions,
      euTransparency,
    });
  });

  return { ads, resultsLine };
}

function looksBlocked(rendered: string): boolean {
  const head = rendered.slice(0, 4_000).toLowerCase();
  if (/library id/i.test(rendered)) return false;
  return (
    head.includes("you must log in") ||
    head.includes("log into facebook") ||
    head.includes("security check") ||
    head.includes("checkpoint") ||
    head.includes("temporarily blocked")
  );
}

/**
 * Sweep ONE public search.
 *
 * Never throws. A failure comes back as a note the UI can show, because one bad
 * search must not take a whole run down with it.
 */
export async function sweepSearch(
  spec: SearchSpec,
  options: { limit?: number; waitSeconds?: number } = {},
): Promise<SweepOutcome> {
  const url = buildSearchUrl(spec);
  const started = Date.now();

  try {
    const rendered = await renderedText(url, options.waitSeconds ?? 40);
    const elapsedMs = Date.now() - started;

    if (looksBlocked(rendered)) {
      return {
        ok: false,
        url,
        ads: [],
        blocked: true,
        resultsLine: null,
        note: "The Ad Library asked for a login on this search, so nothing was read. Open it yourself and paste what you see.",
        elapsedMs,
      };
    }

    const { ads: all, resultsLine } = extractAds(rendered);
    const ads = options.limit ? all.slice(0, options.limit) : all;

    if (ads.length === 0) {
      const empty = /no ads (match|to show)/i.test(rendered);
      return {
        ok: true,
        url,
        ads: [],
        blocked: false,
        resultsLine,
        note: empty
          ? "Nobody is running ads under this search in this country right now."
          : "The page loaded but no ad cards could be read from it — worth opening yourself.",
        elapsedMs,
      };
    }

    return {
      ok: true,
      url,
      ads,
      blocked: false,
      resultsLine,
      note: `${ads.length} ad${ads.length === 1 ? "" : "s"} read from the public Library`,
      elapsedMs,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return {
      ok: false,
      url,
      ads: [],
      blocked: false,
      resultsLine: null,
      note:
        reason === "AbortError" || reason.includes("abort") || reason.includes("timeout")
          ? "This search took too long to load and was left for you to open."
          : "This search couldn't be read automatically. Open it yourself and paste what you find.",
      elapsedMs: Date.now() - started,
    };
  }
}

/** Sweep several searches, a couple at a time, never in parallel enough to hammer. */
export async function sweepMany(
  specs: SearchSpec[],
  options: { concurrency?: number; limit?: number; waitSeconds?: number } = {},
): Promise<SweepOutcome[]> {
  const lanes = Math.max(1, Math.min(options.concurrency ?? 2, 3));
  const results: SweepOutcome[] = new Array(specs.length);
  let cursor = 0;

  async function lane() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= specs.length) return;
      results[index] = await sweepSearch(specs[index], {
        limit: options.limit,
        waitSeconds: options.waitSeconds,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(lanes, specs.length) }, lane));
  return results;
}
