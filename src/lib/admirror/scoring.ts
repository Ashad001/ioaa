/**
 * The Evidence-Backed Opportunity Score, and the coverage score that must always
 * travel with it.
 *
 * The one rule that matters here: a component with no evidence is DROPPED and the
 * remaining weights renormalised — never zero-filled. Zero-filling would quietly
 * punish an ad for something the user simply did not capture, which turns the
 * ranking into a measure of the user's diligence rather than the ad's opportunity.
 */

export type ScoreItem = {
  id: string;
  visibleStartDate: string | null;
  visibleResultRank: number | null;
  platformCount: number | null;
  variantCount: number;
  /**
   * REACH AS META PUBLISHES IT, or null. This is the only figure in the app that
   * speaks to how much an ad is actually being seen, and it is used ONLY when
   * Meta published one. Null drops the component and renormalises — it never
   * scores as a zero, because "not published" is not "not working".
   */
  publishedReach: number | null;
  observedAt: Date;
  hasCreativeArtefact: boolean;
  hasLibraryUrl: boolean;
  advertiser: string;
};

export const EBOS_WEIGHTS = {
  /**
   * Reach carries the most weight, because it is the one component backed by a
   * figure Meta itself published rather than a proxy for effort. It is present
   * only on ads that carry one, and absent on the rest — which is exactly why
   * the drop-and-renormalise rule below matters more now, not less.
   */
  published_reach: 0.28,
  duration_visible: 0.22,
  variant_repetition: 0.18,
  evidenced_rank: 0.12,
  recency: 0.1,
  platform_breadth: 0.1,
} as const;

export type EbosComponent = keyof typeof EBOS_WEIGHTS;

/**
 * A complete weight vector. Always all five components, always summing to 1.
 *
 * The default above is a human's judgement. Once a user has enough of their own
 * measured results, the re-fit can propose a vector fitted to them — but only a
 * vector the user has explicitly accepted is ever passed in here, and the vector
 * actually used is written into every score's stored inputs, so the teardown
 * drawer shows the arithmetic that really ran rather than the default's.
 */
export type EbosWeights = Record<EbosComponent, number>;

export type EbosResult = {
  ebos: number;
  components: Partial<Record<EbosComponent, number>>;
  dropped: EbosComponent[];
  weightsUsed: Partial<Record<EbosComponent, number>>;
  notes: string[];
};

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);
}

function percentile(values: number[], p: number): number {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const index = Math.min(clean.length - 1, Math.floor(p * (clean.length - 1)));
  return clean[index];
}

function normalisedLog(value: number, reference: number): number {
  if (reference <= 0) return value > 0 ? 1 : 0;
  const raw = Math.log(1 + value) / Math.log(1 + reference);
  return Math.min(1, Math.max(0, raw));
}

export function parseVisibleDate(input: string | null): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Batch-level references — the score is relative to what was observed, not "the market". */
export function batchReferences(items: ScoreItem[], now: Date) {
  const durations = items
    .map((item) => parseVisibleDate(item.visibleStartDate))
    .filter((d): d is Date => d !== null)
    .map((d) => daysBetween(d, now));
  const repetitions = items.map((item) => Math.max(1, item.variantCount));
  const reaches = items
    .map((item) => item.publishedReach)
    .filter((value): value is number => value !== null && value > 0);
  return {
    durationP95: percentile(durations, 0.95),
    repetitionP95: percentile(repetitions, 0.95),
    reachP95: percentile(reaches, 0.95),
    reachCount: reaches.length,
    batchSize: items.length,
  };
}

export function computeEbos(
  item: ScoreItem,
  refs: ReturnType<typeof batchReferences>,
  now: Date,
  weights: Partial<EbosWeights> = EBOS_WEIGHTS,
): EbosResult {
  const components: Partial<Record<EbosComponent, number>> = {};
  const dropped: EbosComponent[] = [];
  const notes: string[] = [];

  if (item.publishedReach !== null && item.publishedReach > 0) {
    components.published_reach = normalisedLog(item.publishedReach, refs.reachP95);
  } else {
    dropped.push("published_reach");
    notes.push(
      "Meta publishes no reach figure for this ad, so reach was dropped from the score rather than counted as zero.",
    );
  }

  const start = parseVisibleDate(item.visibleStartDate);
  if (start) {
    components.duration_visible = normalisedLog(daysBetween(start, now), refs.durationP95);
  } else {
    dropped.push("duration_visible");
    notes.push("No visible start date was captured, so duration was dropped from the score.");
  }

  if (item.variantCount > 0) {
    components.variant_repetition = normalisedLog(item.variantCount, refs.repetitionP95);
  } else {
    dropped.push("variant_repetition");
  }

  if (item.visibleResultRank && refs.batchSize > 0) {
    components.evidenced_rank = Math.min(
      1,
      Math.max(0, 1 - item.visibleResultRank / refs.batchSize),
    );
  } else {
    dropped.push("evidenced_rank");
    notes.push("You didn't capture where this appeared in the result order, so rank was dropped.");
  }

  components.recency = Math.exp(-daysBetween(item.observedAt, now) / 45);

  if (item.platformCount && item.platformCount > 0) {
    components.platform_breadth = Math.min(1, item.platformCount / 4);
  } else {
    dropped.push("platform_breadth");
  }

  const weightsUsed: Partial<Record<EbosComponent, number>> = {};
  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(EBOS_WEIGHTS) as EbosComponent[]) {
    const value = components[key];
    if (value === undefined) continue;
    // The accepted vector is the source of truth when there is one, but a
    // missing or non-finite entry falls back to the shipped default rather than
    // silently weighting that component at zero.
    const candidate = weights[key];
    const weight =
      typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
        ? candidate
        : EBOS_WEIGHTS[key];
    weightsUsed[key] = weight;
    weighted += weight * value;
    weightSum += weight;
  }

  const ebos = weightSum === 0 ? 0 : Math.round((1000 * weighted) / weightSum) / 10;
  return { ebos, components, dropped, weightsUsed, notes };
}

export type CoverageResult = {
  score: number;
  band: "thin" | "partial" | "substantial";
  parts: { label: string; value: number; detail: string }[];
  gaps: string[];
};

export const EXPECTED_MIN_ITEMS = 10;

export function computeCoverage(
  items: ScoreItem[],
  plannedCompetitors: string[],
): CoverageResult {
  const count = items.length;
  const withUrl = items.filter((item) => item.hasLibraryUrl).length;
  const withCreative = items.filter((item) => item.hasCreativeArtefact).length;
  const withStart = items.filter((item) => item.visibleStartDate).length;
  const withReach = items.filter((item) => item.publishedReach !== null).length;

  const represented = new Set(
    items.map((item) => item.advertiser.trim().toLowerCase()).filter(Boolean),
  );
  const plannedClean = plannedCompetitors.map((name) => name.trim().toLowerCase()).filter(Boolean);
  const plannedHit = plannedClean.filter((name) =>
    [...represented].some((seen) => seen.includes(name) || name.includes(seen)),
  ).length;

  const ratio = (numerator: number, denominator: number) =>
    denominator <= 0 ? 0 : Math.min(1, numerator / denominator);

  const parts = [
    {
      label: "Volume",
      value: ratio(count, EXPECTED_MIN_ITEMS),
      detail: `${count} of ${EXPECTED_MIN_ITEMS} submitted ads`,
    },
    {
      label: "Library links",
      value: ratio(withUrl, count),
      detail: `${withUrl} of ${count} carry an Ad Library link`,
    },
    {
      label: "Creative attached",
      value: ratio(withCreative, count),
      detail: `${withCreative} of ${count} have a creative artefact`,
    },
    {
      label: "Start dates",
      value: ratio(withStart, count),
      detail: `${withStart} of ${count} show a visible start date`,
    },
    {
      label: "Published reach",
      value: ratio(withReach, count),
      detail: `${withReach} of ${count} carry a reach figure Meta published`,
    },
    {
      label: "Competitors",
      value: ratio(plannedHit, plannedClean.length),
      detail: `${plannedHit} of ${plannedClean.length} planned competitors represented`,
    },
  ];

  const score =
    parts.length === 0
      ? 0
      : Math.round((parts.reduce((sum, part) => sum + part.value, 0) / parts.length) * 100) / 100;

  const band: CoverageResult["band"] = score < 0.35 ? "thin" : score > 0.7 ? "substantial" : "partial";

  const gaps: string[] = [];
  if (count < EXPECTED_MIN_ITEMS) {
    gaps.push(`${EXPECTED_MIN_ITEMS - count} more ads would reach a useful volume — sweep again or add some.`);
  }
  const missingCompetitors = plannedCompetitors.filter((name) => {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return ![...represented].some((seen) => seen.includes(clean) || clean.includes(seen));
  });
  for (const name of missingCompetitors.slice(0, 3)) {
    gaps.push(`Nothing collected yet for ${name}.`);
  }
  if (count > 0 && withStart < count) {
    gaps.push(`${count - withStart} of ${count} items have no visible start date.`);
  }
  if (count > 0 && withReach < count) {
    gaps.push(
      `${count - withReach} of ${count} have no reach figure — Meta doesn't publish one for every ad, so those are ranked on the rest.`,
    );
  }
  if (count > 0 && withCreative < count) {
    gaps.push(`${count - withCreative} of ${count} have no image — attaching a screenshot adds a lot.`);
  }

  return { score, band, parts, gaps };
}

export const BAND_COPY: Record<CoverageResult["band"], string> = {
  thin: "Thin — this is a small slice of what's running.",
  partial: "Partial — a useful slice, still not the whole market.",
  substantial: "Substantial — a broad slice. Never a complete inventory.",
};

/**
 * Never "the market's best ads" — we hold a slice, not an inventory, and the only
 * performance figure that exists is the reach Meta publishes on some ads. This is
 * the only allowed superlative.
 */
export const RANK_CAPTION =
  "Working hardest in this collected set — reach where Meta publishes it, plus how long and how widely each ad runs";
