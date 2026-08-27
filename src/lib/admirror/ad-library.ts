/**
 * Public Meta Ad Library search references.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE. This module builds and parses Ad
 * Library URLs as STRINGS ONLY — it performs no network request of any kind, and
 * it must stay that way so a URL can be built and shown without side effects.
 *
 * Reading a search is a SEPARATE, deliberate act that lives in `sweep.ts`. That
 * module reads the PUBLIC Library page — the same page anyone can open without an
 * account — and it never produces a performance figure, because Meta publishes
 * none for commercial ads. The promise the product rests on is not "we never
 * fetch"; it is "every fact says where it came from, and we never invent one".
 */

export const AD_LIBRARY_BASE = "https://www.facebook.com/ads/library/";

export const MARKET_PRESETS = [
  {
    id: "gcc-ar",
    label: "GCC — Arabic",
    countries: ["AE", "SA", "KW", "QA"],
    languages: ["ar"],
    note: "Gulf states, Arabic creative",
  },
  {
    id: "gcc-en",
    label: "GCC — English",
    countries: ["AE", "SA", "QA"],
    languages: ["en"],
    note: "Gulf states, English creative",
  },
  {
    id: "uk",
    label: "United Kingdom",
    countries: ["GB"],
    languages: ["en"],
    note: "DSA reach figures are visible in the Library UI here",
  },
  {
    id: "us",
    label: "United States",
    countries: ["US"],
    languages: ["en"],
    note: "Largest inventory, heaviest competition",
  },
  {
    id: "dach",
    label: "DACH",
    countries: ["DE", "AT", "CH"],
    languages: ["de"],
    note: "German-language creative, EU reach visible",
  },
  {
    id: "sea",
    label: "Southeast Asia",
    countries: ["SG", "MY", "ID", "PH"],
    languages: ["en", "id"],
    note: "Mixed-language market, high video share",
  },
  {
    id: "anz",
    label: "Australia & New Zealand",
    countries: ["AU", "NZ"],
    languages: ["en"],
    note: "English creative, seasonal inversion",
  },
  {
    id: "nordics",
    label: "Nordics",
    countries: ["SE", "NO", "DK", "FI"],
    languages: ["sv", "no", "da", "fi"],
    note: "Small markets, low ad density",
  },
] as const;

export const MEDIA_TYPES = [
  { id: "all", label: "All media" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "meme", label: "Image & text" },
  { id: "none", label: "Text only" },
] as const;

export const OBJECTIVES = [
  "Direct response",
  "Lead generation",
  "App installs",
  "Brand awareness",
  "Retention & winback",
  "Seasonal push",
] as const;

export type SearchSpec = {
  competitorName: string;
  country: string;
  language: string;
  mediaType: string;
  activeStatus: string;
};

/**
 * Build the URL the user will open themselves.
 *
 * A note on `sort_data[mode]`: a sort request in a Library URL is a UI-side
 * instruction about ordering. It does NOT mean the results expose per-ad figures,
 * and the order that comes back is not a performance number. AdMirror never
 * writes one into a search and never reads order as a metric — only as "where
 * this appeared in the result order you captured", if the user tells us.
 */
export function buildSearchUrl(spec: SearchSpec): string {
  const params = new URLSearchParams({
    active_status: spec.activeStatus || "active",
    ad_type: "all",
    country: spec.country || "ALL",
    q: spec.competitorName,
    search_type: "keyword_unordered",
    media_type: spec.mediaType && spec.mediaType !== "all" ? spec.mediaType : "all",
  });
  if (spec.language && spec.language !== "any") {
    params.set("content_languages[0]", spec.language);
  }
  return `${AD_LIBRARY_BASE}?${params.toString()}`;
}

export function describeFilters(spec: SearchSpec): string {
  const media = MEDIA_TYPES.find((m) => m.id === spec.mediaType)?.label ?? "All media";
  const language = spec.language && spec.language !== "any" ? spec.language.toUpperCase() : "Any language";
  const status = spec.activeStatus === "all" ? "Active & inactive" : "Active only";
  return `${spec.country || "All countries"} · ${language} · ${media} · ${status}`;
}

export type ParsedSearch = {
  ok: boolean;
  spec: SearchSpec;
  summary: string;
  /** What we could not read out of the URL, told plainly. */
  problem?: string;
};

const LIBRARY_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"];

/**
 * Read the filters out of a URL the user pasted. String parsing only.
 *
 * On failure we keep the raw string and let them save it as a plain reference
 * anyway — a link they can still click is more useful than a rejected paste.
 */
export function parseSearchUrl(input: string): ParsedSearch {
  const raw = input.trim();
  const blank: SearchSpec = {
    competitorName: "",
    country: "",
    language: "any",
    mediaType: "all",
    activeStatus: "active",
  };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      spec: blank,
      summary: "",
      problem:
        "That isn't a full web address. Paste the whole link from your browser's address bar, starting with https://.",
    };
  }

  if (!LIBRARY_HOSTS.includes(url.hostname)) {
    return {
      ok: false,
      spec: blank,
      summary: "",
      problem:
        "That link isn't a Meta Ad Library search. You can still save it as a plain reference.",
    };
  }

  if (!url.pathname.startsWith("/ads/library")) {
    return {
      ok: false,
      spec: blank,
      summary: "",
      problem:
        "That's a Facebook link, but not an Ad Library search. Save it as a reference if it's still useful.",
    };
  }

  const params = url.searchParams;
  const spec: SearchSpec = {
    competitorName: params.get("q") ?? params.get("view_all_page_id") ?? "",
    country: params.get("country") ?? "",
    language: params.get("content_languages[0]") ?? "any",
    mediaType: params.get("media_type") ?? "all",
    activeStatus: params.get("active_status") ?? "active",
  };

  const sortRequest = params.get("sort_data[mode]");
  const summary = describeFilters(spec);

  return {
    ok: true,
    spec,
    summary: sortRequest
      ? `${summary} · sorted in the Library UI (a sort request, not a figure)`
      : summary,
  };
}

export const LANGUAGES = [
  { id: "any", label: "Any language" },
  { id: "en", label: "English" },
  { id: "ar", label: "Arabic" },
  { id: "de", label: "German" },
  { id: "fr", label: "French" },
  { id: "es", label: "Spanish" },
  { id: "id", label: "Indonesian" },
  { id: "sv", label: "Swedish" },
] as const;

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: "FB",
  instagram: "IG",
  audience_network: "AN",
  messenger: "MSG",
};
