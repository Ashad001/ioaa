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
  observedAt: Date;
  hasCreativeArtefact: boolean;
  hasLibraryUrl: boolean;
  advertiser: string;
};

export const EBOS_WEIGHTS = {
  duration_visible: 0.3,
  variant_repetition: 0.25,
  evidenced_rank: 0.2,
  recency: 0.15,
  platform_breadth: 0.1,
} as const;

export type EbosComponent = keyof typeof EBOS_WEIGHTS;

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
  return {
    durationP95: percentile(durations, 0.95),
    repetitionP95: percentile(repetitions, 0.95),
    batchSize: items.length,
  };
}

export function computeEbos(
  item: ScoreItem,
  refs: ReturnType<typeof batchReferences>,
  now: Date,
): EbosResult {
  const components: Partial<Record<EbosComponent, number>> = {};
  const dropped: EbosComponent[] = [];
  const notes: string[] = [];

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
    const weight = EBOS_WEIGHTS[key];
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
    gaps.push(`Submit ${EXPECTED_MIN_ITEMS - count} more ads to reach a useful volume.`);
  }
  const missingCompetitors = plannedCompetitors.filter((name) => {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return ![...represented].some((seen) => seen.includes(clean) || clean.includes(seen));
  });
  for (const name of missingCompetitors.slice(0, 3)) {
    gaps.push(`No evidence yet for ${name}.`);
  }
  if (count > 0 && withStart < count) {
    gaps.push(`${count - withStart} of ${count} items have no visible start date.`);
  }
  if (count > 0 && withCreative < count) {
    gaps.push(`${count - withCreative} of ${count} items are text-only — a screenshot adds a lot.`);
  }

  return { score, band, parts, gaps };
}

export const BAND_COPY: Record<CoverageResult["band"], string> = {
  thin: "Thin — this is a small slice of what's running.",
  partial: "Partial — a useful slice, still not the whole market.",
  substantial: "Substantial — a broad slice. Never a complete inventory.",
};

/** Never "the market's best ads". This is the only allowed superlative. */
export const RANK_CAPTION = "Highest opportunity score in this submitted evidence set";
