import "server-only";

/**
 * THE AUTOMATIC READER — a real browser, on this app's own server.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * WHY THIS MODULE EXISTS. Meta answers a plain server request to the Ad Library
 * with a bot challenge: HTTP 403 and a `__rd_verify` script that only a real
 * browser executes. Every keyless read therefore returned nothing, and "the door
 * is locked" was indistinguishable from "this market is empty". The read API that
 * used to solve this needs a key the owner does not have.
 *
 * WHAT THIS DOES INSTEAD. It drives a real headless browser on the server, which
 * runs the challenge exactly as a person's browser does, then reads the RENDERED
 * public Library page — the same page anyone can open without an account. No key,
 * no signup, nothing for the owner to connect. Verified against live searches in
 * several countries: real advertisers, real copy, real artwork, real video files.
 *
 * WHY THE PAGE AND NOT META'S INTERNAL DATA ENDPOINT. That endpoint answers
 * `Rate limit exceeded` to an unauthenticated caller almost immediately, and it
 * is not a public interface — its shape can change without notice. The rendered
 * page is the public artefact Meta intends people to read, so that is what we
 * read, through the DOM the browser actually built.
 *
 * THE HONESTY LINE. Every field either appeared on the card or stays empty. No
 * field is inferred, no date is rounded, and NO PERFORMANCE FIGURE IS EVER
 * WRITTEN: the public page publishes no spend, click, conversion or impressions
 * figure for a commercial ad, so this reader cannot produce one. `resultRank` is
 * a POSITION in the order the page listed, never a measure of performance.
 *
 * COST DISCIPLINE. One browser is launched, reused across every search in a
 * sweep, and closed in a `finally`. A leaked browser would sit on the server's
 * memory for the life of the process, so the close path must never be optional.
 */

import { buildSearchUrl, type SearchSpec } from "./ad-library";
import type { FeedOutcome, LiveAd } from "./library-feed";

/** Where Chromium lives on this server. */
const BROWSER_PATH = "/usr/bin/chromium-browser";

/** A real desktop Chrome UA. The challenge is not served to obvious automation. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** How long to give one search page, end to end. */
const PAGE_TIMEOUT_MS = 60_000;
/**
 * The page renders its shell, runs the challenge, RELOADS ITSELF, then paints
 * cards. So the reader polls for a card rather than waiting once — but it needs a
 * ceiling, because a genuinely empty market never paints one.
 */
const CARDS_TIMEOUT_MS = 30_000;
const POLL_MS = 800;
/**
 * ONCE THE REAL PAGE IS UP, AN EMPTY RESULT SETTLES FAST.
 *
 * A market with ads paints its first card within a couple of seconds of the
 * Library shell appearing. So after the shell is confirmed we only need a short
 * grace period before "no cards" is a real answer — without this, every quiet
 * search burned the full ceiling and a sweep of ten rivals crawled.
 */
const EMPTY_GRACE_MS = 7_000;
/** Extra settle time after the first card, so the rest of the batch paints. */
const SETTLE_MS = 2_600;
/** Scroll passes for more than the first screenful. */
const SCROLL_PASSES = 3;
const SCROLL_WAIT_MS = 1_900;

/**
 * A WOBBLE IS NOT AN ANSWER. A timeout or a challenge that didn't clear says
 * nothing about the market. Only a settled read is ever written down.
 */
const MAX_ATTEMPTS = 2;

export type BrowserSession = {
  read: (spec: SearchSpec, limit: number) => Promise<FeedOutcome>;
  close: () => Promise<void>;
};

type RawCard = {
  libraryId: string | null;
  advertiser: string;
  pageId: string | null;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  displayLink: string | null;
  activeStatus: string;
  visibleStartDate: string | null;
  variantCount: number;
  creativeUrl: string | null;
  advertiserAvatarUrl: string | null;
  videoUrl: string | null;
  videoDuration: string | null;
  isVideo: boolean;
  euTransparency: boolean;
};

/**
 * THE IN-PAGE READER — runs inside the browser, against the real DOM.
 *
 * It must be SELF-CONTAINED: it is serialised into the page, so it cannot close
 * over anything from this module.
 *
 * How a card is found: every real card carries exactly one "Library ID: <digits>"
 * text node, which no ad copy contains, so that node is the anchor. From it we
 * climb to the smallest ancestor that owns the whole card, then read the parts out
 * of that subtree. Anything the card did not show comes back empty.
 */
function readCardsInPage(): RawCard[] {
  const CTA_LABELS = [
    "Learn more", "Shop now", "Sign up", "Book now", "Book travel", "Get offer",
    "Get quote", "Get showtimes", "Download", "Install now", "Apply now",
    "Contact us", "Send message", "Send WhatsApp message", "Subscribe",
    "Order now", "Watch more", "See menu", "Play game", "Donate now",
    "Listen now", "Request time", "Buy tickets", "Open link", "Call now",
    "Save", "Get directions",
  ];
  const CHROME = [
    "Sponsored", "Open Dropdown", "See ad details", "See summary details",
    "Platforms", "Active", "Inactive", "EU transparency", "See more", "See less",
    "Translate", "See translation", "Why am I seeing this ad?",
  ];

  const isCta = (line: string) =>
    CTA_LABELS.some((label) => label.toLowerCase() === line.toLowerCase());

  const idNodes = Array.from(document.querySelectorAll("span,div")).filter(
    (el) => el.children.length === 0 && /^Library ID:\s*\d+/.test((el.textContent ?? "").trim()),
  );

  const out: RawCard[] = [];
  const seen = new Set<string>();

  for (const node of idNodes) {
    const libraryId = (node.textContent ?? "").match(/Library ID:\s*(\d+)/)?.[1] ?? null;
    if (libraryId && seen.has(libraryId)) continue;
    if (libraryId) seen.add(libraryId);

    // Climb to the card: the nearest ancestor tall enough to be a whole card
    // while still holding exactly this one Library ID.
    let card: HTMLElement = node as HTMLElement;
    for (let i = 0; i < 14 && card.parentElement; i++) {
      card = card.parentElement;
      if (card.offsetHeight > 360) {
        const ids = Array.from(card.querySelectorAll("span,div")).filter(
          (el) =>
            el.children.length === 0 &&
            /^Library ID:\s*\d+/.test((el.textContent ?? "").trim()),
        );
        if (ids.length === 1) break;
      }
    }

    const lines = (card.innerText ?? "")
      .split("\n")
      .map((line) => line.replace(/\u200b/g, "").trim())
      .filter(Boolean);

    // ── Status, exactly as printed. Never inferred from anything else.
    let activeStatus = "unknown";
    if (lines.some((line) => line === "Active")) activeStatus = "active";
    else if (lines.some((line) => line === "Inactive")) activeStatus = "inactive";

    // ── The visible start date, verbatim.
    let visibleStartDate: string | null = null;
    for (const line of lines) {
      const match = line.match(/^Started running on\s+(.+)$/);
      if (match) {
        visibleStartDate = match[1].trim();
        break;
      }
    }

    // ── Variant count: only ever a number the page actually printed.
    let variantCount = 1;
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+ads?\s+use\s+this\s+creative/i);
      if (match) {
        variantCount = Number(match[1]);
        break;
      }
    }

    const euTransparency = lines.some((line) => /EU transparency/i.test(line));

    // ── Video: the file the card played, its poster frame and its duration.
    const video = card.querySelector("video");
    const videoUrl = video?.src ? video.src : null;
    const posterUrl = video?.poster ? video.poster : null;
    let videoDuration: string | null = null;
    for (const line of lines) {
      const match = line.match(/^\d+:\d{2}\s*\/\s*(\d+:\d{2})$/);
      if (match) {
        videoDuration = match[1];
        break;
      }
    }

    // ── Pictures. The tiny square is the advertiser's avatar; the big one is the
    // creative. Sorting by rendered area separates them without guessing.
    const images = Array.from(card.querySelectorAll("img"))
      .map((img) => ({
        src: img.currentSrc || img.src || "",
        area: (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0),
        side: Math.max(img.naturalWidth || 0, img.naturalHeight || 0),
      }))
      .filter((img) => img.src.startsWith("http"));

    const avatar = images.find((img) => img.side > 0 && img.side <= 100) ?? null;
    const creative =
      images
        .filter((img) => img !== avatar && img.side > 100)
        .sort((a, b) => b.area - a.area)[0] ?? null;

    // ── The advertiser: the page link's own text is the most reliable source.
    let advertiser = "";
    let pageId: string | null = null;
    const pageLink = Array.from(card.querySelectorAll("a")).find(
      (anchor) =>
        /facebook\.com\/[^/?]+\/?$/.test(anchor.href) && !/\/ads\/library/.test(anchor.href),
    );
    if (pageLink) {
      advertiser = (pageLink.innerText ?? "").trim();
      const slug = pageLink.href.match(/facebook\.com\/([^/?]+)/)?.[1] ?? null;
      if (slug && /^\d+$/.test(slug)) pageId = slug;
    }
    if (!advertiser) {
      const index = lines.findIndex((line) => line === "Sponsored");
      if (index > 0) advertiser = lines[index - 1];
    }

    // ── The destination domain, as the card printed it (e.g. "NIKE.COM").
    let displayLink: string | null = null;
    for (const line of lines) {
      if (/^[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}$/.test(line) && !/FACEBOOK\.COM/.test(line)) {
        displayLink = line.toLowerCase();
        break;
      }
    }

    // ── The button label, matched against Meta's own set. Never invented.
    let ctaLabel = "";
    for (const line of lines) {
      if (isCta(line)) {
        ctaLabel = line;
        break;
      }
    }

    // ── Copy. Everything after "Sponsored" that isn't page furniture: the
    // longest line is the body, and a short line below it is the headline.
    const startIndex = lines.findIndex((line) => line === "Sponsored");
    const rest = (startIndex >= 0 ? lines.slice(startIndex + 1) : lines).filter((line) => {
      if (CHROME.some((word) => word.toLowerCase() === line.toLowerCase())) return false;
      if (isCta(line)) return false;
      if (/^Library ID:/.test(line)) return false;
      if (/^Started running on/.test(line)) return false;
      if (/^\d+\s+ads?\s+use\s+this/i.test(line)) return false;
      if (/^This ad has multiple versions$/i.test(line)) return false;
      if (/^\d+:\d{2}\s*\/\s*\d+:\d{2}$/.test(line)) return false;
      if (/^[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}$/.test(line)) return false;
      if (advertiser && line === advertiser) return false;
      return line.length > 1;
    });

    let bodyCopy = "";
    let bodyIndex = -1;
    rest.forEach((line, index) => {
      if (line.length > bodyCopy.length) {
        bodyCopy = line;
        bodyIndex = index;
      }
    });
    // A short single line is a name or a label, not ad copy.
    if (bodyCopy.length < 25) {
      bodyCopy = "";
      bodyIndex = -1;
    }

    const headline =
      (bodyIndex >= 0
        ? rest.slice(bodyIndex + 1).find((line) => line.length <= 120)
        : rest.find((line) => line.length <= 120)) ?? "";

    out.push({
      libraryId,
      advertiser,
      pageId,
      headline,
      bodyCopy,
      ctaLabel,
      displayLink,
      activeStatus,
      visibleStartDate,
      variantCount,
      creativeUrl: creative ? creative.src : posterUrl,
      advertiserAvatarUrl: avatar ? avatar.src : null,
      videoUrl,
      videoDuration,
      isVideo: Boolean(videoUrl),
      euTransparency,
    });
  }

  return out;
}

/** The page's own text, for the poll loop. Self-contained by the same rule. */
function readPageTextInPage(): string {
  return document.body ? document.body.innerText.slice(0, 4000) : "";
}

/** How many cards are painted right now. */
function countCardsInPage(): number {
  if (!document.body) return 0;
  return (document.body.innerText.match(/Library ID:/g) ?? []).length;
}

function scrollDownInPage(): void {
  window.scrollBy(0, 5000);
}

function toLiveAd(card: RawCard, rank: number, fallbackUrl: string): LiveAd {
  return {
    libraryId: card.libraryId ?? "",
    libraryUrl: card.libraryId
      ? `https://www.facebook.com/ads/library/?id=${card.libraryId}`
      : fallbackUrl,
    advertiser: card.advertiser,
    pageId: card.pageId,
    visibleStartDate: card.visibleStartDate,
    headline: card.headline,
    bodyCopy: card.bodyCopy,
    ctaLabel: card.ctaLabel,
    displayLink: card.displayLink,
    activeStatus: card.activeStatus,
    resultRank: rank,
    // The page shows platforms as sprite-masked icons with no accessible label,
    // so nothing here can honestly say which platforms an ad runs on. Empty is
    // the truthful answer; the board renders "not captured" rather than a guess.
    platforms: [],
    // The public page publishes NO reach figure for a commercial ad, so these
    // stay null on this route. Writing a number here would be inventing the one
    // thing this product promises never to invent.
    impressionsLower: null,
    impressionsUpper: null,
    variantCount: card.variantCount,
    creativeUrl: card.creativeUrl,
    advertiserAvatarUrl: card.advertiserAvatarUrl,
    isVideo: card.isVideo,
    euTransparency: card.euTransparency,
    videoUrl: card.videoUrl,
    videoDuration: card.videoDuration,
  };
}

/**
 * Open ONE browser and hand back a reader that reuses it for every search.
 *
 * The caller MUST call `close()` in a `finally`. Launch is the expensive part, and
 * each search then costs roughly the time the page needs to paint, so a sweep of
 * a dozen rivals shares one launch rather than paying twelve.
 */
export async function openLibrarySession(): Promise<BrowserSession> {
  const { chromium } = await import("playwright-core");

  const browser = await chromium.launch({
    executablePath: BROWSER_PATH,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "en-US",
    viewport: { width: 1440, height: 1200 },
    serviceWorkers: "block",
  });

  async function readOnce(spec: SearchSpec, limit: number): Promise<FeedOutcome> {
    const url = buildSearchUrl(spec);
    const started = Date.now();
    const page = await context.newPage();

    try {
      // The challenge answers 403 and reloads itself, so a non-OK response here
      // is EXPECTED and must never be treated as a failure.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

      /**
       * POLL, DON'T WAIT ONCE.
       *
       * The challenge script calls `window.location.reload()`, which destroys the
       * page's execution context. A single wait dies with it the moment it fires —
       * which looks exactly like "this market has no ads", and is precisely how a
       * working reader ends up reporting every search as empty. So we poll in
       * short hops and swallow the navigation error, which is normal here.
       */
      let painted = false;
      let shellSeenAt: number | null = null;
      const deadline = Date.now() + CARDS_TIMEOUT_MS;

      while (Date.now() < deadline) {
        try {
          const body = await page.evaluate(readPageTextInPage);
          if (/Library ID:/.test(body)) {
            painted = true;
            break;
          }
          // The real Library shell prints its own navigation; the challenge
          // holding page does not. That is how we tell a quiet market from a
          // door that never opened.
          if (/Ad Library Report|Search by keyword|Ad Library API/i.test(body)) {
            if (shellSeenAt === null) shellSeenAt = Date.now();
            // The page is up and listing nothing. Give it a moment, then accept
            // that as the answer rather than burning the whole ceiling.
            if (Date.now() - shellSeenAt > EMPTY_GRACE_MS) break;
          }
        } catch {
          // Context destroyed by the challenge reload. Expected — keep polling.
        }
        await page.waitForTimeout(POLL_MS);
      }

      const sawLibraryShell = shellSeenAt !== null;

      if (!painted) {
        if (!sawLibraryShell) {
          return {
            state: "failed",
            url,
            ads: [],
            note: "The Ad Library page didn't finish loading, so this search is unread — we know nothing about it either way.",
            totalReported: null,
            elapsedMs: Date.now() - started,
          };
        }
        return {
          state: "empty",
          url,
          ads: [],
          note: `No live ads under “${spec.competitorName}” in this country right now — the Library page loaded and listed none.`,
          totalReported: null,
          elapsedMs: Date.now() - started,
        };
      }

      await page.waitForTimeout(SETTLE_MS);

      // Pull in more than the first screenful, but stop early once the page has
      // stopped growing — a small market has one screen and no more.
      let previous = 0;
      for (let pass = 0; pass < SCROLL_PASSES; pass++) {
        let current = 0;
        try {
          current = await page.evaluate(countCardsInPage);
        } catch {
          break;
        }
        if (current >= limit || (pass > 0 && current === previous)) break;
        previous = current;
        try {
          await page.evaluate(scrollDownInPage);
        } catch {
          break;
        }
        await page.waitForTimeout(SCROLL_WAIT_MS);
      }

      const cards = await page.evaluate(readCardsInPage);

      // A card with nothing identifying on it is page furniture that fooled the
      // anchor, not an ad.
      const usable = cards.filter(
        (card) => card.libraryId || card.bodyCopy || card.headline || card.creativeUrl,
      );

      if (usable.length === 0) {
        return {
          state: "empty",
          url,
          ads: [],
          note: `No live ads under “${spec.competitorName}” in this country right now.`,
          totalReported: null,
          elapsedMs: Date.now() - started,
        };
      }

      const ads = usable.slice(0, limit).map((card, index) => toLiveAd(card, index + 1, url));
      const withArt = ads.filter((ad) => ad.creativeUrl).length;
      const withVideo = ads.filter((ad) => ad.videoUrl).length;

      return {
        state: "ok",
        url,
        ads,
        note: `${ads.length} live ad${ads.length === 1 ? "" : "s"} read from the public Ad Library under “${spec.competitorName}” · ${withArt} with artwork${withVideo > 0 ? ` · ${withVideo} with video` : ""}.`,
        totalReported: usable.length,
        elapsedMs: Date.now() - started,
        route: "keyword",
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  return {
    async read(spec, limit) {
      let last: FeedOutcome | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const outcome = await readOnce(spec, limit);
          // Only a wobble is worth asking twice. An empty market IS an answer.
          if (outcome.state !== "failed") return { ...outcome, attempts: attempt };
          last = outcome;
        } catch {
          last = {
            state: "failed",
            url: buildSearchUrl(spec),
            ads: [],
            note: "That search couldn't be read this time, so it is recorded as unread rather than empty.",
            totalReported: null,
            elapsedMs: 0,
          };
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 1_200 * attempt));
        }
      }
      return { ...(last as FeedOutcome), attempts: MAX_ATTEMPTS };
    },
    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

/**
 * Read several searches with ONE browser, a couple of lanes at a time.
 *
 * Concurrency is deliberately low: each lane is a real page rendering a heavy
 * site, and pushing harder makes Meta throttle and makes the server thrash.
 */
export async function readManyWithBrowser(
  specs: SearchSpec[],
  options: {
    limit?: number;
    concurrency?: number;
    onSettled?: (index: number, outcome: FeedOutcome) => void | Promise<void>;
  } = {},
): Promise<FeedOutcome[]> {
  if (specs.length === 0) return [];

  const limit = options.limit ?? 12;
  const lanes = Math.max(1, Math.min(options.concurrency ?? 2, 3));
  const results: FeedOutcome[] = new Array(specs.length);
  const session = await openLibrarySession();
  let cursor = 0;

  try {
    const lane = async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= specs.length) return;
        results[index] = await session.read(specs[index], limit);
        if (options.onSettled) await options.onSettled(index, results[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(lanes, specs.length) }, lane));
  } finally {
    await session.close();
  }

  return results;
}

/** Read ONE search. Opens and closes its own browser — use the session for many. */
export async function readSearchWithBrowser(
  spec: SearchSpec,
  options: { limit?: number } = {},
): Promise<FeedOutcome> {
  const [outcome] = await readManyWithBrowser([spec], { limit: options.limit });
  return outcome;
}
