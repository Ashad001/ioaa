import "server-only";

/**
 * WHO ELSE IS ADVERTISING IN THIS FIELD — the category-driven rival lookup.
 *
 * WHY IT IS SEPARATE FROM `discover.ts`. The old discovery sweep searched the
 * words one homepage happened to repeat. That finds companies who WRITE like
 * this brand, which is a much narrower question than who SELLS like it. So the
 * company is classified into a field and a category first (`category.ts`), and
 * the sweep runs on the vocabulary the whole category advertises under, plus the
 * neighbouring categories that fight for the same buyer and the same feed.
 *
 * EVERY RIVAL HERE IS EVIDENCE. They were seen running live ads in this country
 * under a named term, and they then had to pass the market test in
 * `relevance.ts`. Whoever failed it is kept WITH the reason and shown, because a
 * filter nobody can inspect is indistinguishable from a bug.
 *
 * THE HONESTY LINE IS UNCHANGED. The only figure that leaves this module is the
 * reach band Meta itself published, reproduced verbatim, and only for the
 * companies whose ads carried one. Everything else is a count of what was read
 * or a reading of their own ad copy, labelled as a reading.
 */

import type { SearchSpec } from "./ad-library";
import {
  CATEGORY_BY_ID,
  classify,
  sweepTerms,
  type CategoryId,
  type CategoryReading,
} from "./category";
import type { SiteRead } from "./discover";
import { readCompanyAds, readMany, type FeedOutcome, type FeedState, type LiveAd } from "./library-feed";
import { readReach } from "./reach";
import { judge, marketVocabulary, type Candidate, type Verdict } from "./relevance";

/** How a company entered the list. Never presented as a verified fact. */
export type FoundVia = "named_by_you" | "your_site" | "category_sweep" | "neighbour_sweep";

/** Where they sit relative to the field this company was read as being in. */
export type CategoryRelation =
  | "same_category"
  | "neighbour_category"
  | "named_by_you"
  | "unknown";

export type RivalProfile = {
  name: string;
  pageId: string | null;
  /** The field and category their OWN ad copy reads as. */
  field: string;
  categoryLabel: string;
  categoryRelation: CategoryRelation;
  /** One sentence on how they position themselves, from their own ads. */
  positioning: string;
  foundVia: FoundVia;
  /** The term they surfaced under, when a sweep found them. */
  foundUnder: string;
  /** Live ads read for them during the lookup. A count, never a performance figure. */
  adsSeen: number;
  displayLink: string;
  /** Meta's own reach band, verbatim. Empty string when Meta published none. */
  reachBand: string;
  tier: "DIRECT" | "ADJACENT" | "ATTENTION";
  whyUseful: string;
  confidence: number;
};

export type SweptTerm = {
  term: string;
  /** Which category's vocabulary this term belongs to. */
  categoryLabel: string;
  relation: CategoryRelation;
  adsRead: number;
  state: FeedState;
};

export type RivalScanReport = {
  found: RivalProfile[];
  /** Companies the market test set aside, with the reason, so it's inspectable. */
  setAside: Array<{ name: string; reason: string }>;
  terms: SweptTerm[];
  /** True when NOT ONE search could be read — a locked door, not an empty field. */
  unreadable: boolean;
  note: string;
};

const MAX_POSITIONING = 150;

function tidy(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * One sentence of THEIR positioning, taken from their own ad copy.
 *
 * It is quoted from what they wrote, trimmed at a sentence end where there is
 * one — not paraphrased, because a paraphrase of an ad is a claim about their
 * strategy and we can only honestly report their words.
 */
function positioningFrom(ads: LiveAd[]): string {
  const ranked = [...ads].sort(
    (a, b) => (b.impressionsLower ?? -1) - (a.impressionsLower ?? -1) || a.resultRank - b.resultRank,
  );
  for (const ad of ranked) {
    const source = [ad.headline, ad.bodyCopy].map((part) => part.trim()).filter(Boolean).join(" — ");
    const cleaned = source.replace(/\s+/g, " ").trim();
    if (cleaned.length < 12) continue;
    if (cleaned.length <= MAX_POSITIONING) return cleaned;
    const cut = cleaned.slice(0, MAX_POSITIONING);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf(" — "));
    return `${(stop > 60 ? cut.slice(0, stop) : cut).trim()}…`;
  }
  return "";
}

/** The widest band Meta published across their ads, verbatim. "" when none. */
function widestBand(ads: LiveAd[]): string {
  let best = -1;
  let band = "";
  for (const ad of ads) {
    const read = readReach(
      ad.impressionsLower === null ? null : String(ad.impressionsLower),
      ad.impressionsUpper === null ? null : String(ad.impressionsUpper),
    );
    if (!read.published) continue;
    const lower = ad.impressionsLower ?? 0;
    if (lower > best) {
      best = lower;
      band = read.short;
    }
  }
  return band;
}

/** Classify a company from their own ad copy, so their profile is their words. */
function categoryFromAds(name: string, ads: LiveAd[]) {
  const headlines = ads.slice(0, 8).map((ad) => ad.headline).filter(Boolean);
  const body = ads.slice(0, 8).map((ad) => ad.bodyCopy).filter(Boolean).join(" ");
  const reading = classify({
    title: name,
    description: body,
    headings: headlines,
    categoryTerms: [],
  });
  return reading;
}

type TermPlan = {
  term: string;
  categoryLabel: string;
  relation: CategoryRelation;
  foundVia: FoundVia;
};

/**
 * The search plan: the category's own vocabulary first, then each neighbour's,
 * then the company's own words as a backstop. `sweepTerms` decides the order and
 * the cap; this only records WHICH category each term came from, so every rival
 * can say where it was found.
 */
export function planTerms(reading: CategoryReading, ownTerms: string[]): TermPlan[] {
  const terms = sweepTerms(reading, ownTerms);
  const primary = new Set(reading.primary.category.marketTerms.map((term) => term.toLowerCase()));
  const neighbourOf = new Map<string, string>();
  for (const neighbour of reading.neighbours) {
    for (const term of neighbour.marketTerms) {
      const key = term.toLowerCase();
      if (!neighbourOf.has(key)) neighbourOf.set(key, neighbour.label);
    }
  }

  return terms.map((term) => {
    if (primary.has(term)) {
      return {
        term,
        categoryLabel: reading.primary.category.label,
        relation: "same_category" as CategoryRelation,
        foundVia: "category_sweep" as FoundVia,
      };
    }
    const neighbour = neighbourOf.get(term);
    if (neighbour) {
      return {
        term,
        categoryLabel: neighbour,
        relation: "neighbour_category" as CategoryRelation,
        foundVia: "neighbour_sweep" as FoundVia,
      };
    }
    return {
      term,
      categoryLabel: "Your own words",
      relation: "same_category" as CategoryRelation,
      foundVia: "category_sweep" as FoundVia,
    };
  });
}

type Bucket = {
  name: string;
  pageId: string | null;
  ads: LiveAd[];
  terms: Set<string>;
  plans: TermPlan[];
  bestRank: number;
  displayLinks: Set<string>;
};

/**
 * Sweep the field, its neighbours, and rank who comes back.
 */
export async function scanCategoryRivals(input: {
  brandName: string;
  site: SiteRead | null;
  reading: CategoryReading;
  country: string;
  language: string;
  mediaType: string;
  ownTerms: string[];
  /** Companies already on the list — found again, they only get profiled. */
  exclude: string[];
  onTermSettled?: (term: string, adsRead: number, index: number) => void | Promise<void>;
}): Promise<RivalScanReport> {
  const plans = planTerms(input.reading, input.ownTerms);

  if (plans.length === 0) {
    return {
      found: [],
      setAside: [],
      terms: [],
      unreadable: false,
      note: "There was no category vocabulary to search under, so nobody was looked up. Pick your field on the profile and run it again.",
    };
  }

  const specs: SearchSpec[] = plans.map((plan) => ({
    competitorName: plan.term,
    country: input.country,
    language: input.language,
    mediaType: input.mediaType,
    activeStatus: "active",
  }));

  const outcomes: FeedOutcome[] = await readMany(specs, {
    concurrency: 4,
    limit: 40,
    onSettled: async (index, outcome) => {
      if (input.onTermSettled) {
        await input.onTermSettled(plans[index].term, outcome.ads.length, index);
      }
    },
  });

  const buckets = new Map<string, Bucket>();
  const terms: SweptTerm[] = [];
  const states: FeedState[] = [];

  outcomes.forEach((outcome, index) => {
    const plan = plans[index];
    states.push(outcome.state);
    terms.push({
      term: plan.term,
      categoryLabel: plan.categoryLabel,
      relation: plan.relation,
      adsRead: outcome.ads.length,
      state: outcome.state,
    });
    if (outcome.state !== "ok") return;

    for (const ad of outcome.ads) {
      const name = tidy(ad.advertiser);
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.ads.push(ad);
        bucket.terms.add(plan.term);
        bucket.plans.push(plan);
        bucket.bestRank = Math.min(bucket.bestRank, ad.resultRank);
        if (ad.displayLink) bucket.displayLinks.add(ad.displayLink);
        if (!bucket.pageId && ad.pageId) bucket.pageId = ad.pageId;
      } else {
        buckets.set(key, {
          name,
          pageId: ad.pageId,
          ads: [ad],
          terms: new Set([plan.term]),
          plans: [plan],
          bestRank: ad.resultRank,
          displayLinks: new Set(ad.displayLink ? [ad.displayLink] : []),
        });
      }
    }
  });

  const unreadable =
    states.length > 0 && states.every((state) => state !== "ok" && state !== "empty");
  if (unreadable) {
    return {
      found: [],
      setAside: [],
      terms,
      unreadable: true,
      note:
        outcomes.find((outcome) => outcome.state === "no_key")?.note ??
        "None of the category searches could be read, so nobody was found. That is a reading problem on our side, not an empty field.",
    };
  }

  // ── THE MARKET TEST ────────────────────────────────────────────────────────
  const vocabulary = marketVocabulary({
    categoryTerms: [...input.reading.primary.category.marketTerms, ...input.ownTerms],
    title: input.site?.title ?? "",
    description: input.site?.description ?? "",
    headings: input.site?.headings ?? [],
  });

  const excluded = new Set(input.exclude.map((name) => name.trim().toLowerCase()));
  const kept: Array<{ bucket: Bucket; verdict: Verdict }> = [];
  const setAside: Array<{ name: string; reason: string }> = [];

  for (const bucket of buckets.values()) {
    const candidate: Candidate = {
      name: bucket.name,
      copy: bucket.ads
        .map((ad) => [ad.headline, ad.bodyCopy, ad.ctaLabel].filter(Boolean).join(" "))
        .join(" \n "),
      adCount: bucket.ads.length,
      terms: [...bucket.terms],
      bestRank: bucket.bestRank,
      displayLinks: [...bucket.displayLinks],
    };
    const verdict = judge(candidate, vocabulary, {
      ownBrand: input.brandName,
      country: input.country,
    });
    if (!verdict.keep) {
      setAside.push({ name: verdict.name, reason: verdict.reason });
      continue;
    }
    if (excluded.has(bucket.name.toLowerCase())) continue;
    kept.push({ bucket, verdict });
  }

  const sorted = kept
    .sort((a, b) => {
      // A company whose ads Meta says are being seen widely comes first — that is
      // the one published figure we have, so it leads where it exists.
      const reach = (bucket: Bucket) =>
        bucket.ads.reduce((top, ad) => Math.max(top, ad.impressionsLower ?? 0), 0);
      const byReach = reach(b.bucket) - reach(a.bucket);
      if (byReach !== 0) return byReach;
      const byScore = b.verdict.score - a.verdict.score;
      if (byScore !== 0) return byScore;
      const byBreadth = b.bucket.terms.size - a.bucket.terms.size;
      if (byBreadth !== 0) return byBreadth;
      return a.bucket.bestRank - b.bucket.bestRank;
    })
    .slice(0, 10);

  const found: RivalProfile[] = sorted.map(({ bucket, verdict }) => {
    // A company found under the primary category is a closer rival than one that
    // only appeared under a neighbour's vocabulary, so the relation follows the
    // term that actually surfaced them.
    const samePlan = bucket.plans.find((plan) => plan.relation === "same_category");
    const plan = samePlan ?? bucket.plans[0];
    const ownReading = categoryFromAds(bucket.name, bucket.ads);
    const relation: CategoryRelation = plan.relation;

    return {
      name: bucket.name,
      pageId: bucket.pageId,
      field: ownReading.primary.category.field,
      categoryLabel: ownReading.primary.score > 0
        ? ownReading.primary.category.label
        : plan.categoryLabel,
      categoryRelation: relation,
      positioning: positioningFrom(bucket.ads),
      foundVia: plan.foundVia,
      foundUnder: plan.term,
      adsSeen: bucket.ads.length,
      displayLink: [...bucket.displayLinks][0] ?? "",
      reachBand: widestBand(bucket.ads),
      tier:
        relation === "neighbour_category"
          ? "ATTENTION"
          : verdict.score >= 60 && bucket.terms.size >= 2
            ? "DIRECT"
            : "ADJACENT",
      whyUseful: verdict.reason,
      confidence: verdict.score,
    };
  });

  const blocked = terms.filter((term) => term.state !== "ok" && term.state !== "empty");
  const readable = terms.length - blocked.length;

  return {
    found,
    setAside: setAside.slice(0, 12),
    terms,
    unreadable: false,
    note:
      found.length > 0
        ? `${found.length} advertiser${found.length === 1 ? "" : "s"} found running live ads in ${input.country} across ${readable} of ${terms.length} searches in ${input.reading.primary.category.field}${
            setAside.length > 0
              ? ` · ${setAside.length} keyword match${setAside.length === 1 ? "" : "es"} set aside as out of your field`
              : ""
          }.`
        : setAside.length > 0
          ? `Advertisers came back on those searches but none were in your field — all ${setAside.length} are listed below with the reason. Add companies by name instead.`
          : `Nobody came back from ${terms.length} searches in ${input.reading.primary.category.field}. Either the field advertises under different words, or add companies by name.`,
  };
}

/**
 * PROFILE ONE NAMED COMPANY — the direct ask.
 *
 * A company the user named must never depend on a keyword sweep happening to
 * surface them, so their profile comes from a lookup of their own advertiser
 * page. Everything returned is either counted from what was read, quoted from
 * their own ads, or Meta's own published band.
 */
export async function profileNamedRival(input: {
  name: string;
  pageId?: string | null;
  country: string;
  language: string;
  ownCategoryId: CategoryId;
}): Promise<{
  ok: boolean;
  profile: Pick<
    RivalProfile,
    | "field"
    | "categoryLabel"
    | "categoryRelation"
    | "positioning"
    | "adsSeen"
    | "displayLink"
    | "reachBand"
  >;
  note: string;
}> {
  const outcome = await readCompanyAds(
    {
      companyName: input.name,
      pageId: input.pageId ?? null,
      country: input.country,
      language: input.language,
    },
    { limit: 24 },
  );

  if (outcome.state !== "ok" || outcome.ads.length === 0) {
    const own = CATEGORY_BY_ID.get(input.ownCategoryId);
    return {
      ok: false,
      profile: {
        field: own?.field ?? "",
        categoryLabel: "",
        categoryRelation: "named_by_you",
        positioning: "",
        adsSeen: 0,
        displayLink: "",
        reachBand: "",
      },
      note:
        outcome.state === "empty"
          ? `No live ads came back for ${input.name} in this market, so there is nothing to profile from yet.`
          : outcome.note,
    };
  }

  const reading = categoryFromAds(input.name, outcome.ads);
  const sameField = reading.primary.category.id === input.ownCategoryId;

  return {
    ok: true,
    profile: {
      field: reading.primary.category.field,
      categoryLabel: reading.primary.category.label,
      categoryRelation: sameField ? "same_category" : "neighbour_category",
      positioning: positioningFrom(outcome.ads),
      adsSeen: outcome.ads.length,
      displayLink: outcome.ads.find((ad) => ad.displayLink)?.displayLink ?? "",
      reachBand: widestBand(outcome.ads),
    },
    note: `${outcome.ads.length} live ad${outcome.ads.length === 1 ? "" : "s"} read for ${input.name}, and their profile is written from those ads' own words.`,
  };
}
