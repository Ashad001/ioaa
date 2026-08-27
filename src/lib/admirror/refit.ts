/**
 * Re-fitting the opportunity score's weights against what the user's own ads
 * actually did.
 *
 * WHY THIS IS THE MOST DANGEROUS FILE IN THE APP. The score decides which angles
 * a user generates from, so a bad re-fit does not produce one wrong screen — it
 * quietly corrupts every ranking afterwards, with nothing visible to show it
 * happened. Auto-tuning a five-parameter model on forty noisy samples is exactly
 * how you build a system that confidently ranks garbage. So this module only ever
 * PROPOSES, it refuses to propose at all below a real sample, and it never emits
 * a confident fit quality on a thin one.
 *
 * WHAT IS BEING CORRELATED. For each ad the user shipped, two things are honestly
 * ours to compare: the EBOS component values of the SOURCE angle it was built
 * from (inference from collected evidence) and the cost-per-result index of the
 * ad itself (measured, self-reported, indexed against the user's own account). If
 * a component genuinely predicts a cheaper result, ads whose source scored high
 * on it should show a higher cost index. That is the whole claim — a correlation
 * inside one account, not a law of advertising, and the copy says so.
 *
 * Pure functions only — no database, no `server-only`. The honesty check imports
 * this file directly and asserts the refusals really hold.
 */

// TYPE-ONLY on purpose. The honesty check runs these functions directly, so this
// module must carry no runtime import — and the default vector below is asserted
// against the score's own by that same check, so the two cannot drift apart.
import type { EbosComponent, EbosWeights } from "./scoring";

/** Below this many measured, settled ads, no proposal is offered. From the brief. */
export const MIN_ADS_FOR_REFIT = 40;
/** And each of those ads must have had time to settle before it counts. */
export const MIN_DAYS_FOR_REFIT = 7;
/** A single component needs this many paired points before it earns a correlation. */
export const MIN_PAIRS_PER_COMPONENT = 12;
/** No component may ever carry more than this share of the score. */
export const MAX_COMPONENT_WEIGHT = 0.45;
/** Nor less than this, so no signal is ever silently switched off completely. */
export const MIN_COMPONENT_WEIGHT = 0.04;
/** How far the fit may pull each weight toward what the correlations imply. */
export const MAX_MOVE_PER_ROUND = 0.5;
/** Below this much movement the fit reports "nothing worth changing". */
export const MOVE_WORTH_SHOWING = 0.02;

export const REFIT_RULE =
  `A weight change needs ${MIN_ADS_FOR_REFIT} of your own measured ads with at least ${MIN_DAYS_FOR_REFIT} days running. Under that AdMirror shows no proposal and no numbers, because tuning a ranking on a handful of noisy ads is how a scoring model starts confidently ranking rubbish.`;

export const REFIT_CANNOT_PROVE =
  "This is a correlation inside your own account, not a law of advertising. It says which signals have tracked cheaper results for you so far — never why, and never that they will again.";

export const REFIT_NEVER_AUTO_RULE =
  "AdMirror never changes this on its own. A proposal sits inert: your boards keep ranking on the weighting in force until you accept a new one, and you can go back at any time.";

/**
 * AdMirror's own shipped weighting — the vector every fallback returns to.
 *
 * Held here rather than imported so this module stays free of runtime imports for
 * the honesty check, which runs the fit for real. That check also asserts this
 * matches the score's own weighting exactly, so changing one and forgetting the
 * other fails the check instead of quietly ranking on two different weightings.
 */
export const DEFAULT_WEIGHTS: EbosWeights = {
  duration_visible: 0.3,
  variant_repetition: 0.25,
  evidenced_rank: 0.2,
  recency: 0.15,
  platform_breadth: 0.1,
};

export const COMPONENT_ORDER: EbosComponent[] = [
  "duration_visible",
  "variant_repetition",
  "evidenced_rank",
  "recency",
  "platform_breadth",
];

export const COMPONENT_LABEL: Record<EbosComponent, string> = {
  duration_visible: "How long it has been running",
  variant_repetition: "How many variants exist",
  evidenced_rank: "Where it sat in the results",
  recency: "How recently it was seen",
  platform_breadth: "How many placements it runs on",
};

/* ── Reading a stored vector without trusting it ───────────────────────────── */

/**
 * Parse a weight vector out of stored JSON, or return null.
 *
 * Defensive on purpose: this text was written by an earlier version of the app,
 * and a malformed or partial vector must fall back to the default rather than
 * produce a ranking weighted by NaN — which would sort silently and wrongly.
 */
export function parseWeights(input: string | null | undefined): EbosWeights | null {
  if (!input) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const out: Partial<EbosWeights> = {};
  for (const key of COMPONENT_ORDER) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    out[key] = value;
  }
  const vector = out as EbosWeights;
  if (COMPONENT_ORDER.reduce((sum, key) => sum + vector[key], 0) <= 0) return null;
  return normaliseWeights(vector);
}

/** Every vector this module emits sums to 1, so the UI can state a share as a share. */
export function normaliseWeights(vector: EbosWeights): EbosWeights {
  const total = COMPONENT_ORDER.reduce((sum, key) => sum + Math.max(0, vector[key]), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {} as EbosWeights;
  for (const key of COMPONENT_ORDER) {
    out[key] = Math.round((Math.max(0, vector[key]) / total) * 10_000) / 10_000;
  }
  // Rounding leaves a crumb. Give it to the largest component so the sum is exact.
  const rounded = COMPONENT_ORDER.reduce((sum, key) => sum + out[key], 0);
  const drift = Math.round((1 - rounded) * 10_000) / 10_000;
  if (drift !== 0) {
    const largest = COMPONENT_ORDER.reduce(
      (best, key) => (out[key] > out[best] ? key : best),
      COMPONENT_ORDER[0],
    );
    out[largest] = Math.round((out[largest] + drift) * 10_000) / 10_000;
  }
  return out;
}

export function weightsSum(vector: EbosWeights): number {
  return Math.round(COMPONENT_ORDER.reduce((sum, key) => sum + vector[key], 0) * 10_000) / 10_000;
}

/** True when a vector is AdMirror's own shipped weighting rather than a fitted one. */
export function isDefaultWeights(vector: EbosWeights): boolean {
  return COMPONENT_ORDER.every((key) => Math.abs(vector[key] - DEFAULT_WEIGHTS[key]) < 0.0005);
}

/* ── The paired sample ─────────────────────────────────────────────────────── */

/**
 * One shipped ad's contribution to a fit.
 *
 * `components` are the SOURCE angle's stored EBOS values — a component the user
 * never captured is simply absent, exactly as in the score itself, and
 * contributes no pair rather than a zero. `costIndex` is 100 = this account's own
 * normal, higher = cheaper per result, matching how the rest of the app indexes.
 */
export type RefitSample = {
  shippedAdId: string;
  label: string;
  components: Partial<Record<EbosComponent, number>>;
  costIndex: number | null;
  daysLive: number | null;
  measured: boolean;
};

export type FitDirection = "helps" | "hurts" | "flat" | "unknown";

export const DIRECTION_COPY: Record<FitDirection, string> = {
  helps: "tracked cheaper results",
  hurts: "tracked pricier results",
  flat: "no clear relationship",
  unknown: "too few of your ads carry this",
};

/** One component's whole argument: where it was, where it goes, and on what. */
export type ComponentFit = {
  component: EbosComponent;
  fromWeight: number;
  toWeight: number;
  /** Pearson r between the component value and the cost index. Null = not enough. */
  correlation: number | null;
  /** How many of the user's ads carried this component at all. */
  n: number;
  direction: FitDirection;
};

export type FitQuality = "weak" | "moderate" | "strong";

export const FIT_QUALITY_COPY: Record<FitQuality, { label: string; note: string }> = {
  weak: {
    label: "Weak fit",
    note: "The relationship is faint. Worth a small nudge at most, and worth fitting again once more ads have numbers.",
  },
  moderate: {
    label: "Moderate fit",
    note: "A visible relationship across a decent sample of your ads. Still your account only, and still worth watching.",
  },
  strong: {
    label: "Clear fit",
    note: "A consistent relationship across a large sample of your own ads — as good as this gets without an ad account integration.",
  },
};

export type WeightRefitProposal = {
  fromWeights: EbosWeights;
  toWeights: EbosWeights;
  sampleSize: number;
  /** The shortest run in the sample, so the user can see how settled it is. */
  minDaysLive: number;
  fitQuality: FitQuality;
  evidence: ComponentFit[];
  /** One sentence of what moved. */
  headline: string;
  /** The fuller plain-words account, stored with the proposal. */
  summary: string;
  /** True when the honest answer is "your weighting is already about right". */
  unchanged: boolean;
};

export type RefitOutcome =
  | {
      enough: false;
      /** How many ads could vote today and how many more are needed. No vector. */
      usable: number;
      needed: number;
      /** Reported separately because this part of the gap closes by itself. */
      tooYoung: number;
      unmeasured: number;
      reason: string;
      /** Never present on a refusal. Stated in the type so nothing can read one. */
      proposal?: undefined;
    }
  | { enough: true; proposal: WeightRefitProposal };

/* ── Readiness ─────────────────────────────────────────────────────────────── */

/** Which ads count: measured, settled, and carrying a cost index. */
export function qualifying(samples: RefitSample[]): RefitSample[] {
  return samples.filter(
    (row) =>
      row.measured &&
      row.costIndex !== null &&
      row.daysLive !== null &&
      row.daysLive >= MIN_DAYS_FOR_REFIT,
  );
}

/**
 * What the screen needs to explain the wait without showing a weighting.
 *
 * `tooYoung` matters because that part of the gap closes by itself — telling
 * someone they need eleven more ads when four of theirs are simply still new is
 * a worse answer than telling them which is which.
 */
export function refitReadiness(samples: RefitSample[]): {
  usable: number;
  tooYoung: number;
  unmeasured: number;
} {
  const usable = qualifying(samples).length;
  const tooYoung = samples.filter(
    (row) =>
      row.measured &&
      row.costIndex !== null &&
      (row.daysLive === null || row.daysLive < MIN_DAYS_FOR_REFIT),
  ).length;
  const unmeasured = samples.filter((row) => !row.measured || row.costIndex === null).length;
  return { usable, tooYoung, unmeasured };
}

/* ── Correlation ───────────────────────────────────────────────────────────── */

/** Pearson r. Null when either side has no spread — a flat column predicts nothing. */
export function correlate(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX <= 0 || varY <= 0) return null;
  const r = covariance / Math.sqrt(varX * varY);
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, Math.round(r * 1000) / 1000));
}

function directionOf(r: number | null): FitDirection {
  if (r === null) return "unknown";
  if (r >= 0.15) return "helps";
  if (r <= -0.15) return "hurts";
  return "flat";
}

function listOf(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ── The fit ───────────────────────────────────────────────────────────────── */

/**
 * Propose a weighting, or refuse.
 *
 * Deliberately conservative: each weight moves toward its correlation-implied
 * share by at most `MAX_MOVE_PER_ROUND`, is clamped into
 * [MIN_COMPONENT_WEIGHT, MAX_COMPONENT_WEIGHT] so no single signal can take over
 * the ranking or be switched off, and the result is renormalised to sum to 1. A
 * modest nudge that can be seen, accepted and repeated is worth far more than an
 * aggressive fit nobody dares apply.
 */
export function fitWeights(
  samples: RefitSample[],
  current: EbosWeights = DEFAULT_WEIGHTS,
): RefitOutcome {
  const usable = qualifying(samples);

  if (usable.length < MIN_ADS_FOR_REFIT) {
    const readiness = refitReadiness(samples);
    return {
      enough: false,
      usable: readiness.usable,
      needed: MIN_ADS_FOR_REFIT - readiness.usable,
      tooYoung: readiness.tooYoung,
      unmeasured: readiness.unmeasured,
      reason: REFIT_RULE,
    };
  }

  const fromWeights = normaliseWeights(current);
  const costs = usable.map((row) => row.costIndex as number);

  const measurements = COMPONENT_ORDER.map((component) => {
    const xs: number[] = [];
    const ys: number[] = [];
    usable.forEach((row, i) => {
      const value = row.components[component];
      if (value === undefined || !Number.isFinite(value)) return;
      xs.push(value);
      ys.push(costs[i]);
    });
    const correlation = xs.length >= MIN_PAIRS_PER_COMPONENT ? correlate(xs, ys) : null;
    return { component, correlation, n: xs.length };
  });

  // A component with too few pairs, or no spread, keeps its current weight
  // untouched: re-weighting on an absent signal is inventing a finding. Only the
  // positive half of a correlation earns weight — a component tracking WORSE cost
  // is pushed down, never given a negative weight.
  const scored = measurements.filter((row) => row.correlation !== null);
  const signalTotal = scored.reduce(
    (sum, row) => sum + Math.max(0, row.correlation as number),
    0,
  );
  const scoredShare = scored.reduce((sum, row) => sum + fromWeights[row.component], 0);

  const moved = {} as EbosWeights;
  for (const row of measurements) {
    if (row.correlation === null || signalTotal <= 0) {
      moved[row.component] = fromWeights[row.component];
      continue;
    }
    // The fitted components redistribute only the share they already hold
    // between them, so an untouched component's weight is not diluted by the fit.
    const implied = (Math.max(0, row.correlation) / signalTotal) * scoredShare;
    const next =
      fromWeights[row.component] + (implied - fromWeights[row.component]) * MAX_MOVE_PER_ROUND;
    moved[row.component] = Math.min(MAX_COMPONENT_WEIGHT, Math.max(MIN_COMPONENT_WEIGHT, next));
  }

  const toWeights = normaliseWeights(moved);

  const evidence: ComponentFit[] = measurements.map((row) => ({
    component: row.component,
    fromWeight: fromWeights[row.component],
    toWeight: toWeights[row.component],
    correlation: row.correlation,
    n: row.n,
    direction: directionOf(row.correlation),
  }));

  const biggestMove = evidence.reduce(
    (max, fit) => Math.max(max, Math.abs(fit.toWeight - fit.fromWeight)),
    0,
  );
  const unchanged = biggestMove < MOVE_WORTH_SHOWING;

  const peak = scored.reduce((max, row) => Math.max(max, Math.abs(row.correlation as number)), 0);
  const minDaysLive = usable.reduce(
    (min, row) => Math.min(min, row.daysLive as number),
    Number.POSITIVE_INFINITY,
  );

  // Fit quality is about how much of the sample was usable and how clear the
  // strongest relationship was — never a bare r shown as if it were a grade.
  // `strong` is unreachable on a bare-minimum sample by design.
  let fitQuality: FitQuality = "weak";
  if (scored.length >= 3 && peak >= 0.25 && usable.length >= MIN_ADS_FOR_REFIT * 1.5) {
    fitQuality = "moderate";
  }
  if (scored.length >= 4 && peak >= 0.4 && usable.length >= MIN_ADS_FOR_REFIT * 3) {
    fitQuality = "strong";
  }

  const helps = evidence.filter((fit) => fit.direction === "helps");
  const hurts = evidence.filter((fit) => fit.direction === "hurts");
  const skipped = evidence.filter((fit) => fit.correlation === null);

  // The headline names the two biggest MOVERS, not everything that correlated.
  // On a sample where all five point the same way, listing all five says nothing
  // — what the user needs to see is what actually changes in their ranking.
  const movers = [...evidence]
    .filter((fit) => Math.abs(fit.toWeight - fit.fromWeight) >= MOVE_WORTH_SHOWING)
    .sort((a, b) => Math.abs(b.toWeight - b.fromWeight) - Math.abs(a.toWeight - a.fromWeight))
    .slice(0, 2);

  const headline = unchanged
    ? `Nothing moved enough to be worth changing across ${usable.length} of your measured ads — your weighting is already about right for what your ads have done.`
    : movers.length > 0
      ? `${listOf(
          movers.map(
            (fit) =>
              `${COMPONENT_LABEL[fit.component].toLowerCase()} ${fit.toWeight > fit.fromWeight ? "counts for more" : "counts for less"}`,
          ),
        )}, fitted across ${usable.length} of your own measured ads.`
      : `Across ${usable.length} of your own measured ads, the score's signals moved apart enough to be worth re-balancing.`;

  const parts: string[] = [
    `Across ${usable.length} of your own measured ads, AdMirror compared each ad's cost per result against the opportunity signals of the angle it came from.`,
  ];
  if (helps.length > 0) {
    parts.push(
      `${listOf(helps.map((fit) => COMPONENT_LABEL[fit.component]))} tracked cheaper results, so ${helps.length === 1 ? "it earns" : "they earn"} a bigger share.`,
    );
  }
  if (hurts.length > 0) {
    parts.push(
      `${listOf(hurts.map((fit) => COMPONENT_LABEL[fit.component]))} tracked the other way, so ${hurts.length === 1 ? "its" : "their"} share comes down.`,
    );
  }
  if (skipped.length > 0) {
    parts.push(
      `${listOf(skipped.map((fit) => COMPONENT_LABEL[fit.component]))} stayed exactly as ${skipped.length === 1 ? "it is" : "they are"} — too few of your ads carry that signal to say anything about it.`,
    );
  }
  parts.push(REFIT_CANNOT_PROVE);

  return {
    enough: true,
    proposal: {
      fromWeights,
      toWeights,
      sampleSize: usable.length,
      minDaysLive: Number.isFinite(minDaysLive) ? Math.round(minDaysLive) : MIN_DAYS_FOR_REFIT,
      fitQuality,
      evidence,
      headline,
      summary: parts.join(" "),
      unchanged,
    },
  };
}

/* ── Formatting ────────────────────────────────────────────────────────────── */

export function fmtWeight(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

export function fmtCorrelation(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function fmtWeightDelta(from: number, to: number): string {
  const delta = Math.round((to - from) * 1000) / 10;
  if (Math.abs(delta) < 0.1) return "no change";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pts`;
}
