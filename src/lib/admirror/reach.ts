/**
 * Reach, phrased the way it can honestly be phrased.
 *
 * Meta publishes a BANDED reach figure for some Ad Library ads and nothing at all
 * for others. Two rules follow, and both are load-bearing:
 *
 * 1. A band is printed as a band. "10K–50K people reached" is the claim Meta
 *    made; "30,000" is not, and turning a range into a point estimate would be
 *    exactly the invented figure this whole app refuses to produce.
 * 2. NO FIGURE IS NOT ZERO. An ad without one renders as "reach not published",
 *    never as a blank or a 0, because a reader who sees 0 concludes the ad is
 *    failing when the truth is that nobody told us either way.
 */

function compact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}K`;
  }
  return String(Math.round(value));
}

export type ReachRead = {
  /** True only when Meta published something. */
  published: boolean;
  /** Short form for a chip: "10K–50K" or "50K+". */
  short: string;
  /** Full sentence for a tooltip or a drawer. */
  full: string;
};

export function readReach(
  lower: string | null | undefined,
  upper: string | null | undefined,
): ReachRead {
  const low = lower ? Number(lower) : NaN;
  const high = upper ? Number(upper) : NaN;
  const hasLow = Number.isFinite(low) && low > 0;
  const hasHigh = Number.isFinite(high) && high > 0;

  if (!hasLow && !hasHigh) {
    return {
      published: false,
      short: "Reach not published",
      full: "Meta publishes no reach figure for this ad, so AdMirror shows none. This says nothing about how the ad is performing.",
    };
  }

  if (hasLow && hasHigh && high > low) {
    return {
      published: true,
      short: `${compact(low)}–${compact(high)}`,
      full: `Meta publishes this ad's reach as ${compact(low)}–${compact(high)} people. That range is Meta's own, reproduced exactly — AdMirror does not narrow it to a single number.`,
    };
  }

  const value = hasLow ? low : high;
  return {
    published: true,
    short: `${compact(value)}+`,
    full: `Meta publishes this ad's reach as at least ${compact(value)} people. The figure is Meta's own, reproduced exactly.`,
  };
}

/** Total published reach across a set, plus how much of the set carried one. */
export function reachCoverage(
  rows: Array<{ impressionsLower: string | null }>,
): { withFigure: number; total: number; sumLower: number } {
  let withFigure = 0;
  let sumLower = 0;
  for (const row of rows) {
    const value = row.impressionsLower ? Number(row.impressionsLower) : NaN;
    if (Number.isFinite(value) && value > 0) {
      withFigure += 1;
      sumLower += value;
    }
  }
  return { withFigure, total: rows.length, sumLower };
}
