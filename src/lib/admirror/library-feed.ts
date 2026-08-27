import "server-only";

/**
 * The live Ad Library feed — where competitor ads ACTUALLY come from.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * WHY THIS MODULE EXISTS. The previous collector read the public Ad Library page
 * directly. It cannot work and never could: Meta answers every request from a
 * datacentre with a bot challenge (HTTP 403 and a `__rd_verify` script), so the
 * sweep read zero cards on every search and then reported, truthfully but
 * uselessly, "nobody advertises under this term". A locked door looked exactly
 * like an empty market. Everything downstream — the competitor map, the board,
 * the ranking — was therefore correct arithmetic over nothing.
 *
 * WHAT CHANGED. The same public Ad Library data now arrives through a read API
 * that holds a residential path to it. The facts are the same public facts a
 * person sees on the Library page, plus ONE Meta genuinely does publish through
 * its own API surface and the page does not print for commercial ads:
 * `total_impressions`, a banded reach figure. Where it is present it is a REAL
 * published figure, and it is labelled as one. Where it is absent it stays absent
 * — there is still no invented number anywhere in this app.
 *
 * THE HONESTY LINE, RESTATED. A missing key, a failed request and an empty
 * market are three different outcomes and must never be collapsed into one. Each
 * comes back as its own `state` with its own plain-words note, and the UI prints
 * that note verbatim.
 */

import { buildSearchUrl, type SearchSpec } from "./ad-library";

const ENDPOINT = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads";
const COMPANY_ENDPOINT = "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads";
const REQUEST_TIMEOUT_MS = 45_000;
/**
 * A TRANSIENT FAILURE IS NOT AN ANSWER. A timeout, a 429 or a 5xx says nothing
 * about the market — it says the pipe wobbled. Recording one as a finished read
 * is how a live market ends up written down as quiet. So each read gets a small
 * number of patient retries with widening gaps, and only a settled result is
 * ever written down.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 900;

/** One live ad, as the Library publishes it. */
export type LiveAd = {
  /** Meta's own Library ID — the stable public identifier. */
  libraryId: string;
  libraryUrl: string;
  advertiser: string;
  pageId: string | null;
  /** The visible "Started running" date, ISO, exactly as published. */
  visibleStartDate: string | null;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  displayLink: string | null;
  /** active · inactive — as published. */
  activeStatus: string;
  /** Where it sat in the returned order. NOT a metric. */
  resultRank: number;
  /** facebook,instagram,… — the platforms Meta lists for this ad. */
  platforms: string[];
  /**
   * REACH, AS META PUBLISHES IT. A lower bound of the impressions band when the
   * Library carries one, null when it does not. Never estimated, never filled.
   */
  impressionsLower: number | null;
  impressionsUpper: number | null;
  /** How many creative variations this ad runs. 1 when unstated. */
  variantCount: number;
  creativeUrl: string | null;
  advertiserAvatarUrl: string | null;
  isVideo: boolean;
  euTransparency: boolean;
  /**
   * THE VIDEO FILE the card played, when the ad runs one. A pointer to Meta's
   * own address, never a copy, so nothing heavy is stored. `creativeUrl` holds
   * the poster frame for the same ad, so a card always has something to show.
   */
  videoUrl?: string | null;
  /** How long the card said the video runs, verbatim (e.g. "0:15"). */
  videoDuration?: string | null;
};

export type FeedState = "ok" | "empty" | "no_key" | "failed" | "rate_limited";

export type FeedOutcome = {
  state: FeedState;
  /** The public Library URL for this same search, so a human can check us. */
  url: string;
  ads: LiveAd[];
  /** Plain words, printed verbatim in the UI. */
  note: string;
  /** The published total for the search, when the feed reports one. */
  totalReported: number | null;
  elapsedMs: number;
  /** How many requests this outcome cost. 1 unless a wobble forced a retry. */
  attempts?: number;
  /**
   * WHICH QUESTION ANSWERED IT. `keyword` = "who advertises about X".
   * `advertiser` = "show me THIS company's ads", which is what the fallback asks
   * when the keyword net comes back empty. A keyword hit and a named-company hit
   * mean different things about a market, so the route is never guessed.
   */
  route?: "keyword" | "advertiser";
};

export function feedConfigured(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY);
}

/** The one sentence the UI shows when the key is missing. Never a fake empty. */
export const NO_KEY_NOTE =
  "The ad reader isn't connected yet, so no ads could be read. This is a missing connection, not an empty market.";

type Unknown = Record<string, unknown>;

function asRecord(value: unknown): Unknown | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Unknown)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Meta's impressions band, e.g. {lower_bound:"1000", upper_bound:"5000"}. */
function readImpressions(snapshot: Unknown | null, root: Unknown) {
  const candidates = [
    root.total_impressions,
    root.impressions,
    root.reach_estimate,
    snapshot?.total_impressions,
    snapshot?.impressions,
  ];
  for (const candidate of candidates) {
    const flat = num(candidate);
    if (flat !== null && flat > 0) return { lower: flat, upper: null as number | null };
    const band = asRecord(candidate);
    if (band) {
      const lower = num(band.lower_bound) ?? num(band.lowerBound) ?? num(band.min);
      const upper = num(band.upper_bound) ?? num(band.upperBound) ?? num(band.max);
      if (lower !== null || upper !== null) return { lower, upper };
    }
  }
  return { lower: null as number | null, upper: null as number | null };
}

function isoDate(value: unknown): string | null {
  const asString = str(value);
  if (asString) {
    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const seconds = num(value);
  if (seconds !== null && seconds > 1_000_000_000) {
    return new Date(seconds * 1000).toISOString().slice(0, 10);
  }
  return null;
}

/** Pick the card creative: the biggest still, or the video's poster frame. */
function readCreative(snapshot: Unknown | null): { url: string | null; isVideo: boolean } {
  if (!snapshot) return { url: null, isVideo: false };

  const videos = asArray(snapshot.videos);
  if (videos.length > 0) {
    const first = asRecord(videos[0]);
    const poster =
      str(first?.video_preview_image_url) ||
      str(first?.preview_image_url) ||
      str(first?.thumbnail_url);
    if (poster) return { url: poster, isVideo: true };
  }

  const images = [...asArray(snapshot.images), ...asArray(snapshot.extra_images)];
  for (const entry of images) {
    const record = asRecord(entry);
    const url =
      str(record?.resized_image_url) ||
      str(record?.original_image_url) ||
      (typeof entry === "string" ? entry : "");
    if (url) return { url, isVideo: false };
  }

  const cards = asArray(snapshot.cards);
  for (const entry of cards) {
    const record = asRecord(entry);
    const url =
      str(record?.resized_image_url) ||
      str(record?.original_image_url) ||
      str(record?.video_preview_image_url);
    if (url) return { url, isVideo: Boolean(str(record?.video_hd_url)) };
  }

  return { url: null, isVideo: false };
}

/** How many creative variations this one ad is running. */
function readVariantCount(snapshot: Unknown | null, root: Unknown): number {
  const stated =
    num(root.collation_count) ??
    num(root.total_ads) ??
    num(snapshot?.collation_count);
  if (stated !== null && stated >= 1) return Math.min(999, Math.round(stated));
  const cards = asArray(snapshot?.cards).length;
  const images = asArray(snapshot?.images).length;
  return Math.max(1, cards || images || 1);
}

function readAd(raw: unknown, rank: number): LiveAd | null {
  const root = asRecord(raw);
  if (!root) return null;

  const libraryId = str(root.ad_archive_id) || str(root.adArchiveID) || str(root.id);
  if (!libraryId) return null;

  const snapshot = asRecord(root.snapshot);
  const advertiser =
    str(root.page_name) ||
    str(snapshot?.page_name) ||
    str(snapshot?.current_page_name) ||
    "";

  const bodyRecord = asRecord(snapshot?.body);
  const bodyCopy = (str(bodyRecord?.text) || str(snapshot?.body) || "").trim();
  const headline = (str(snapshot?.title) || str(snapshot?.link_description) || "").trim();

  const impressions = readImpressions(snapshot, root);
  const creative = readCreative(snapshot);

  const platforms = asArray(root.publisher_platform)
    .map((entry) => str(entry).toLowerCase())
    .filter(Boolean);

  return {
    libraryId,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${libraryId}`,
    advertiser: advertiser.slice(0, 160),
    pageId: str(root.page_id) || str(snapshot?.page_id) || null,
    visibleStartDate: isoDate(root.start_date_string) ?? isoDate(root.start_date),
    headline: headline.slice(0, 300),
    bodyCopy: bodyCopy.slice(0, 1400),
    ctaLabel: str(snapshot?.cta_text).slice(0, 60),
    displayLink: str(snapshot?.caption) || null,
    activeStatus: root.is_active === true ? "active" : root.is_active === false ? "inactive" : "unknown",
    resultRank: rank,
    platforms,
    impressionsLower: impressions.lower,
    impressionsUpper: impressions.upper,
    variantCount: readVariantCount(snapshot, root),
    creativeUrl: creative.url,
    advertiserAvatarUrl: str(snapshot?.page_profile_picture_url) || null,
    isVideo: creative.isVideo || str(snapshot?.display_format).toUpperCase() === "VIDEO",
    euTransparency: Boolean(str(snapshot?.disclaimer_label)),
  };
}

async function request(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const key = process.env.SCRAPECREATORS_API_KEY ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-api-key": key, Accept: "application/json" },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function outcomeFrom(
  body: unknown,
  publicUrl: string,
  limit: number,
  started: number,
  subjectNote: string,
): FeedOutcome {
  const root = asRecord(body) ?? {};
  const results = [
    ...asArray(root.searchResults),
    ...asArray(root.results),
    ...asArray(root.ads),
    ...asArray(root.data),
  ];

  const ads: LiveAd[] = [];
  results.forEach((raw, index) => {
    if (ads.length >= limit) return;
    const ad = readAd(raw, index + 1);
    if (ad) ads.push(ad);
  });

  const totalReported = num(root.searchResultsCount) ?? num(root.count);

  if (ads.length === 0) {
    return {
      state: "empty",
      url: publicUrl,
      ads: [],
      note: `No live ads are running ${subjectNote} in this country right now.`,
      totalReported,
      elapsedMs: Date.now() - started,
    };
  }

  const withReach = ads.filter((ad) => ad.impressionsLower !== null).length;
  const withArt = ads.filter((ad) => ad.creativeUrl).length;

  return {
    state: "ok",
    url: publicUrl,
    ads,
    note: `${ads.length} live ad${ads.length === 1 ? "" : "s"} read ${subjectNote}${
      withArt > 0 ? `, ${withArt} with artwork` : ""
    }${withReach > 0 ? `, ${withReach} with published reach` : ""}`,
    totalReported,
    elapsedMs: Date.now() - started,
  };
}

function failure(
  publicUrl: string,
  status: number,
  started: number,
  attempts = 1,
): FeedOutcome {
  const rateLimited = status === 429;
  const tried = attempts > 1 ? ` Tried ${attempts} times.` : "";
  return {
    state: rateLimited ? "rate_limited" : "failed",
    url: publicUrl,
    ads: [],
    note: rateLimited
      ? `The ad reader hit its rate limit on this search, so it was left unread — not an empty market.${tried}`
      : status === 401 || status === 403
        ? "The ad reader rejected our credentials, so nothing could be read. This is a connection problem, not an empty market."
        : `This search couldn't be read just now. It was left unread rather than reported as empty.${tried}`,
    totalReported: null,
    elapsedMs: Date.now() - started,
    attempts,
  };
}

/** Worth trying again? Only the failures that carry no information. */
function retryable(status: number): boolean {
  // 0 = the request never completed (timeout / network). 429 = asked to slow
  // down. 5xx = their side. A 401/403/404 is settled and retrying it just burns
  // the user's quota to reach the same answer.
  return status === 0 || status === 429 || status >= 500;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One read, retried while the failure is uninformative. Returns the LAST status
 * so the caller can name the outcome precisely.
 */
async function requestWithRetry(
  url: string,
): Promise<{ ok: boolean; status: number; body: unknown; attempts: number }> {
  let last = { ok: false, status: 0, body: null as unknown };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      last = await request(url);
    } catch {
      last = { ok: false, status: 0, body: null };
    }

    if (last.ok) return { ...last, attempts: attempt };
    if (!retryable(last.status)) return { ...last, attempts: attempt };
    if (attempt < MAX_ATTEMPTS) {
      // Widening gaps: a rate limit wants room, and hammering it earns another.
      await pause(RETRY_BASE_MS * attempt * (last.status === 429 ? 2 : 1));
    }
  }

  return { ...last, attempts: MAX_ATTEMPTS };
}


/**
 * Read ONE keyword search of the live Library. Never throws — a failure is a
 * state with a note, because one bad search must not take a run down.
 */
async function readSearchViaApi(
  spec: SearchSpec,
  options: { limit?: number; sortBy?: "total_impressions" | "relevancy_monthly_grouped" } = {},
): Promise<FeedOutcome> {
  const publicUrl = buildSearchUrl(spec);
  const started = Date.now();
  const limit = options.limit ?? 12;

  if (!feedConfigured()) {
    return {
      state: "no_key",
      url: publicUrl,
      ads: [],
      note: NO_KEY_NOTE,
      totalReported: null,
      elapsedMs: 0,
    };
  }

  const params = new URLSearchParams({
    query: spec.competitorName,
    // Impressions-first ordering is the whole point: it surfaces the ads that
    // are actually working, rather than whatever the Library happens to list.
    sort_by: options.sortBy ?? "total_impressions",
    search_type: "keyword_unordered",
    ad_type: "all",
    status: spec.activeStatus === "all" ? "ALL" : "ACTIVE",
  });
  if (spec.country) params.set("country", spec.country);
  if (spec.language && spec.language !== "any") {
    params.set("language", spec.language.toUpperCase());
  }
  if (spec.mediaType && spec.mediaType !== "all") params.set("media_type", spec.mediaType);

  try {
    const { ok, status, body, attempts } = await requestWithRetry(
      `${ENDPOINT}?${params.toString()}`,
    );
    if (!ok) return failure(publicUrl, status, started, attempts);
    return {
      ...outcomeFrom(body, publicUrl, limit, started, `under “${spec.competitorName}”`),
      attempts,
    };
  } catch {
    return failure(publicUrl, 0, started, MAX_ATTEMPTS);
  }
}

/**
 * Read every live ad for ONE named advertiser. This is the call that answers
 * "show me my competitor's ads" directly, rather than hoping a keyword search
 * happens to surface them.
 */
async function readCompanyAdsViaApi(
  input: { companyName: string; pageId?: string | null; country: string; language: string; includeInactive?: boolean },
  options: { limit?: number } = {},
): Promise<FeedOutcome> {
  const publicUrl = buildSearchUrl({
    competitorName: input.companyName,
    country: input.country,
    language: input.language,
    mediaType: "all",
    activeStatus: input.includeInactive ? "all" : "active",
  });
  const started = Date.now();
  const limit = options.limit ?? 12;

  if (!feedConfigured()) {
    return {
      state: "no_key",
      url: publicUrl,
      ads: [],
      note: NO_KEY_NOTE,
      totalReported: null,
      elapsedMs: 0,
    };
  }

  const params = new URLSearchParams({
    status: input.includeInactive ? "ALL" : "ACTIVE",
  });
  if (input.pageId) params.set("pageId", input.pageId);
  else params.set("companyName", input.companyName);
  if (input.country) params.set("country", input.country);
  if (input.language && input.language !== "any") {
    params.set("language", input.language.toUpperCase());
  }

  try {
    const { ok, status, body, attempts } = await requestWithRetry(
      `${COMPANY_ENDPOINT}?${params.toString()}`,
    );
    if (!ok) return failure(publicUrl, status, started, attempts);
    return {
      ...outcomeFrom(body, publicUrl, limit, started, `for ${input.companyName}`),
      attempts,
    };
  } catch {
    return failure(publicUrl, 0, started, MAX_ATTEMPTS);
  }
}

/** Read several searches, a few lanes at a time. */
async function readManyViaApi(
  specs: SearchSpec[],
  options: {
    concurrency?: number;
    limit?: number;
    /** Ask for the advertiser by name when the keyword search comes back empty. */
    advertiserFallback?: boolean;
    onSettled?: (index: number, outcome: FeedOutcome) => void | Promise<void>;
  } = {},
): Promise<FeedOutcome[]> {
  const lanes = Math.max(1, Math.min(options.concurrency ?? 4, 6));
  const results: FeedOutcome[] = new Array(specs.length);
  let cursor = 0;

  async function lane() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= specs.length) return;
      const outcome = options.advertiserFallback
        ? await readSearchOrAdvertiserViaApi(specs[index], { limit: options.limit })
        : await readSearchViaApi(specs[index], { limit: options.limit });
      results[index] = outcome;
      if (options.onSettled) await options.onSettled(index, outcome);
    }
  }

  await Promise.all(Array.from({ length: Math.min(lanes, specs.length) }, lane));
  return results;
}

/**
 * ASK THE KEYWORD QUESTION, THEN THE DIRECT ONE.
 *
 * WHY THIS EXISTS. A keyword search is a loose net. A named rival can be
 * running ads right now and still not come back, simply because their copy never
 * uses the term we searched — and the sweep then recorded, truthfully but
 * uselessly, "no live ads under this term". The user reads that as "my
 * competitor isn't advertising", which is a different and false statement.
 *
 * So when the keyword read settles EMPTY, we ask the question the user actually
 * meant: show me this advertiser's live ads. Only an empty keyword read triggers
 * it — a failed or rate-limited read is unresolved, and a second question does
 * not resolve the first one. The route that answered is carried on the outcome
 * so nothing on screen has to guess.
 */
async function readSearchOrAdvertiserViaApi(
  spec: SearchSpec,
  options: { limit?: number } = {},
): Promise<FeedOutcome> {
  const keyword = await readSearchViaApi(spec, options);
  if (keyword.state !== "empty") return { ...keyword, route: "keyword" };

  const direct = await readCompanyAdsViaApi(
    {
      companyName: spec.competitorName,
      country: spec.country,
      language: spec.language,
      includeInactive: spec.activeStatus === "all",
    },
    options,
  );

  if (direct.state === "ok" && direct.ads.length > 0) {
    return {
      ...direct,
      url: keyword.url,
      route: "advertiser",
      note: `${direct.ads.length} live ad${
        direct.ads.length === 1 ? "" : "s"
      } found by looking ${spec.competitorName} up directly — the keyword search alone missed them.`,
      attempts: (keyword.attempts ?? 1) + (direct.attempts ?? 1),
    };
  }

  // The direct lookup didn't resolve it either. Keep the keyword outcome as the
  // record — but say that both questions were asked, so an empty result here
  // means genuinely empty rather than badly worded.
  return {
    ...keyword,
    route: "keyword",
    note:
      direct.state === "empty"
        ? `No live ads for ${spec.competitorName} in this country — checked both by keyword and by name.`
        : keyword.note,
    attempts: (keyword.attempts ?? 1) + (direct.attempts ?? 1),
  };
}


/* ══════════════════════════════════════════════════════════════════════════
   THE ROUTER — which reader answers, and why.

   There are two ways to read the public Ad Library, and the app now picks
   between them ON ITS OWN. Nothing about this is a user setting, and there is
   nothing for the owner to connect:

   1. THE BROWSER READER (default, always available). A real headless browser on
      this app's own server clears Meta's bot challenge and reads the rendered
      public page. Needs no key. It cannot report a reach figure, because the
      public page prints none for a commercial ad.
   2. THE READ API (only when a key happens to be present). Same public facts,
      plus the ONE figure Meta publishes through its own API surface and the page
      does not: a banded impressions total. When a key exists this route is
      preferred, purely because that extra published figure makes the ranking
      sharper.

   `no_key` IS NO LONGER A REACHABLE OUTCOME for collection. It stays in the type
   because older rows and older notes reference it, but a missing key is no
   longer a dead end — it just means route 1 answers.
   ══════════════════════════════════════════════════════════════════════════ */

/** Which reader is answering right now, in the user's language. */
export type ReaderRoute = "browser" | "api";

export function activeReaderRoute(): ReaderRoute {
  return feedConfigured() ? "api" : "browser";
}

/**
 * Collection ALWAYS has a working reader now. Kept as a function so callers read
 * intent rather than a bare `true`, and so a future genuinely-unavailable case
 * has one place to live.
 */
export function readerAvailable(): boolean {
  return true;
}

/** Read ONE keyword search. Routes itself; never needs a key. */
export async function readSearch(
  spec: SearchSpec,
  options: { limit?: number; sortBy?: "total_impressions" | "relevancy_monthly_grouped" } = {},
): Promise<FeedOutcome> {
  if (feedConfigured()) {
    const viaApi = await readSearchViaApi(spec, options);
    if (viaApi.state !== "no_key") return viaApi;
  }
  const { readSearchWithBrowser } = await import("./library-browser");
  return readSearchWithBrowser(spec, { limit: options.limit });
}

/** Read ONE named advertiser's live ads. Routes itself; never needs a key. */
export async function readCompanyAds(
  input: {
    companyName: string;
    pageId?: string | null;
    country: string;
    language: string;
    includeInactive?: boolean;
  },
  options: { limit?: number } = {},
): Promise<FeedOutcome> {
  if (feedConfigured()) {
    const viaApi = await readCompanyAdsViaApi(input, options);
    if (viaApi.state !== "no_key") return viaApi;
  }
  // Without the API there is no "look this company up by id" endpoint — but the
  // public page searches by name perfectly well, which is the same question.
  const { readSearchWithBrowser } = await import("./library-browser");
  return readSearchWithBrowser(
    {
      competitorName: input.companyName,
      country: input.country,
      language: input.language,
      mediaType: "all",
      activeStatus: input.includeInactive ? "all" : "active",
    },
    { limit: options.limit },
  );
}

/**
 * Read a keyword search and, if it comes back empty, ask for the advertiser by
 * name. Routes itself.
 */
export async function readSearchOrAdvertiser(
  spec: SearchSpec,
  options: { limit?: number } = {},
): Promise<FeedOutcome> {
  if (feedConfigured()) {
    const viaApi = await readSearchOrAdvertiserViaApi(spec, options);
    if (viaApi.state !== "no_key") return viaApi;
  }
  // On the browser route the keyword search IS the advertiser search — the same
  // public page answers both — so one read settles it and a second would only
  // ask the same question twice.
  const { readSearchWithBrowser } = await import("./library-browser");
  const outcome = await readSearchWithBrowser(spec, { limit: options.limit });
  return { ...outcome, route: "keyword" };
}

/**
 * Read many searches. Routes itself.
 *
 * On the browser route this is where the win is: ONE browser is launched and
 * every search shares it, so a dozen rivals cost one launch rather than twelve.
 */
export async function readMany(
  specs: SearchSpec[],
  options: {
    concurrency?: number;
    limit?: number;
    advertiserFallback?: boolean;
    onSettled?: (index: number, outcome: FeedOutcome) => void | Promise<void>;
  } = {},
): Promise<FeedOutcome[]> {
  if (feedConfigured()) {
    const viaApi = await readManyViaApi(specs, options);
    if (!viaApi.some((outcome) => outcome.state === "no_key")) return viaApi;
  }
  const { readManyWithBrowser } = await import("./library-browser");
  return readManyWithBrowser(specs, {
    limit: options.limit,
    concurrency: options.concurrency,
    onSettled: options.onSettled,
  });
}
