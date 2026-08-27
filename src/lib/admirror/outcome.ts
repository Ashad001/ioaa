/**
 * The closed loop's arithmetic: turning a user's own reported numbers into a
 * funnel diagnosis, and refusing to give one when the numbers are too thin.
 *
 * WHY THIS FILE IS THE OPPOSITE HALF OF THE APP. Everywhere else, AdMirror is
 * careful never to claim a performance figure, because the public Ad Library
 * publishes none. Here the figures are real — but they belong to the user, about
 * their own ad, on their own account, read off their own dashboard. That is the
 * only reason a verdict is allowed to exist at all, and it is why nothing in this
 * module may ever be applied to a competitor's ad.
 *
 * THE REFUSAL IS THE FEATURE. An ad with 400 views is not evidence of anything.
 * A confident story told about noise does not just mislead once — it gets fed
 * into the pattern library and poisons every future reading of that mechanism.
 * So `diagnose()` returns `insufficient_data` and says what would be enough,
 * rather than producing a diagnosis with a hedge attached. There is no override.
 *
 * Pure functions only, no database, no `server-only`: the honesty check imports
 * this directly and asserts the refusal thresholds really hold.
 */

/** Below this, no diagnosis is offered. Stated in the UI, not hidden here. */
export const MIN_IMPRESSIONS_FOR_DIAGNOSIS = 1000;
/** And it must have had time to settle, however big the audience. */
export const MIN_DAYS_FOR_DIAGNOSIS = 3;
/** A pattern cell below this many measured ads shows no number at all. */
export const MIN_N_FOR_PATTERN = 5;

export const THIN_DATA_RULE =
  `A verdict needs at least ${MIN_IMPRESSIONS_FOR_DIAGNOSIS.toLocaleString("en-GB")} views and ${MIN_DAYS_FOR_DIAGNOSIS} days running. Below that AdMirror says so and stops, because a confident story told about noise is worse than no story.`;

export const PATTERN_THIN_RULE =
  `A pattern needs ${MIN_N_FOR_PATTERN} measured ads before it shows a number. Under that the cell stays empty rather than showing something believable built on two or three ads.`;

export const MEASURED_SCOPE_RULE =
  "Real numbers exist only for your own ads, reported by you. Nothing on a competitor card is measured, and these two never share a scale.";

/* ── Reading what the user typed ──────────────────────────────────────────── */

/**
 * Every number arrives as text the user typed, and "" means NOT REPORTED, which
 * is a different thing from zero. Returning null for empty is what lets a rate
 * be "not enough to say" instead of silently computing against a zero.
 */
export function num(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.replace(/[^0-9.\-]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function ratio(top: number | null, bottom: number | null): number | null {
  if (top === null || bottom === null || bottom <= 0) return null;
  return top / bottom;
}

export type ReportedReading = {
  impressions: string;
  reach: string;
  clicks: string;
  amountSpent: string;
  currency: string;
  results: string;
  resultLabel: string;
  videoPlays: string;
  watched25: string;
  watched75: string;
  watched100: string;
  daysLive: string;
};

export const EMPTY_READING: ReportedReading = {
  impressions: "",
  reach: "",
  clicks: "",
  amountSpent: "",
  currency: "",
  results: "",
  resultLabel: "",
  videoPlays: "",
  watched25: "",
  watched75: "",
  watched100: "",
  daysLive: "",
};

/**
 * Read a stored row as a reading.
 *
 * Lives here rather than beside the database writes because the screens need it
 * too, and a server-action module can only export async functions.
 */
export function toReading(row: {
  impressions: string;
  reach: string;
  clicks: string;
  amountSpent: string;
  currency: string;
  results: string;
  resultLabel: string;
  videoPlays: string;
  watched25: string;
  watched75: string;
  watched100: string;
  daysLive: string;
}): ReportedReading {
  return {
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    amountSpent: row.amountSpent,
    currency: row.currency,
    results: row.results,
    resultLabel: row.resultLabel,
    videoPlays: row.videoPlays,
    watched25: row.watched25,
    watched75: row.watched75,
    watched100: row.watched100,
    daysLive: row.daysLive,
  };
}

/**
 * The four rates that actually diagnose a creative, each as a fraction or null.
 *
 * These are the ONLY derived figures in the loop, and each one names the part of
 * the ad it tests:
 *   thumbstop — did the first seconds stop the scroll
 *   hold      — did the body pay off what the hook promised
 *   click     — did the offer earn the tap
 *   cost      — did any of it turn into a result at a sane price
 * A missing input yields null, never zero: "they didn't report views" and "nobody
 * watched" are not the same finding.
 */
export type DerivedRates = {
  thumbstop: number | null;
  hold: number | null;
  completion: number | null;
  click: number | null;
  costPerResult: number | null;
};

export function deriveRates(reading: ReportedReading): DerivedRates {
  const impressions = num(reading.impressions);
  const plays = num(reading.videoPlays);
  const w25 = num(reading.watched25);
  const w75 = num(reading.watched75);
  const w100 = num(reading.watched100);
  const clicks = num(reading.clicks);
  const spent = num(reading.amountSpent);
  const results = num(reading.results);

  return {
    thumbstop: ratio(w25, impressions),
    hold: ratio(w75, w25),
    completion: ratio(w100, plays ?? impressions),
    click: ratio(clicks, impressions),
    costPerResult: results !== null && results > 0 ? ratio(spent, results) : null,
  };
}

/* ── What "normal" is for this account ────────────────────────────────────── */

/**
 * The user's own averages. An absolute rate is meaningless — a 20% hold rate is
 * strong in one account and weak in another — so every verdict here is a
 * comparison against this and nothing else.
 *
 * `basis` records WHICH comparison was used, because "against the averages you
 * typed in" and "against the middle of your own other ads" are different claims
 * and the UI has to be able to say which one it made.
 */
export type Baseline = {
  thumbstop: number | null;
  hold: number | null;
  click: number | null;
  costPerResult: number | null;
  basis: "stated" | "your_other_ads" | "none";
  basisNote: string;
};

export const NO_BASELINE: Baseline = {
  thumbstop: null,
  hold: null,
  click: null,
  costPerResult: null,
  basis: "none",
  basisNote:
    "No account averages yet, so nothing here is indexed. Add your own averages, or ship a few more and AdMirror will compare against the middle of your own ads.",
};

function pct(input: string | null | undefined): number | null {
  const value = num(input);
  return value === null ? null : value / 100;
}

export function statedBaseline(row: {
  clickThroughPct: string;
  thumbstopPct: string;
  holdPct: string;
  costPerResult: string;
  basisNote: string;
} | null): Baseline | null {
  if (!row) return null;
  const thumbstop = pct(row.thumbstopPct);
  const hold = pct(row.holdPct);
  const click = pct(row.clickThroughPct);
  const costPerResult = num(row.costPerResult);
  if (thumbstop === null && hold === null && click === null && costPerResult === null) {
    return null;
  }
  return {
    thumbstop,
    hold,
    click,
    costPerResult,
    basis: "stated",
    basisNote: row.basisNote || "Your own account averages, as you entered them.",
  };
}

export function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

/**
 * Fall back to the middle of the user's OWN other ads.
 *
 * `exclude` is not optional politeness — comparing an ad against a median that
 * includes itself pulls the baseline toward the ad and makes everything look
 * inline. With fewer than three other measured ads there is no meaningful middle,
 * so this returns null rather than a two-sample "average".
 */
export function baselineFromOwnAds(
  readings: ReportedReading[],
  options: { minimum?: number } = {},
): Baseline | null {
  const minimum = options.minimum ?? 3;
  if (readings.length < minimum) return null;
  const rates = readings.map(deriveRates);
  const pick = (key: keyof DerivedRates) =>
    median(rates.map((row) => row[key]).filter((value): value is number => value !== null));

  const thumbstop = pick("thumbstop");
  const hold = pick("hold");
  const click = pick("click");
  const costPerResult = pick("costPerResult");
  if (thumbstop === null && hold === null && click === null && costPerResult === null) {
    return null;
  }
  return {
    thumbstop,
    hold,
    click,
    costPerResult,
    basis: "your_other_ads",
    basisNote: `The middle of your own ${readings.length} measured ads — not an industry figure, and not anybody else's.`,
  };
}

/* ── Indexing ─────────────────────────────────────────────────────────────── */

/** 100 = exactly your own normal. 130 = a third better. Null = can't say. */
export function indexAgainst(
  value: number | null,
  baseline: number | null,
  options: { lowerIsBetter?: boolean } = {},
): number | null {
  if (value === null || baseline === null || baseline <= 0) return null;
  const raw = options.lowerIsBetter ? baseline / value : value / baseline;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100);
}

export type IndexedRates = {
  thumbstop: number | null;
  hold: number | null;
  click: number | null;
  cost: number | null;
};

export function indexRates(rates: DerivedRates, baseline: Baseline): IndexedRates {
  return {
    thumbstop: indexAgainst(rates.thumbstop, baseline.thumbstop),
    hold: indexAgainst(rates.hold, baseline.hold),
    click: indexAgainst(rates.click, baseline.click),
    cost: indexAgainst(rates.costPerResult, baseline.costPerResult, { lowerIsBetter: true }),
  };
}

/** Inside this band an ad is doing what your ads do. Outside it, something moved. */
export const INLINE_BAND = { low: 85, high: 115 } as const;

export function standingOf(index: number | null): "above" | "inline" | "below" | "unknown" {
  if (index === null) return "unknown";
  if (index > INLINE_BAND.high) return "above";
  if (index < INLINE_BAND.low) return "below";
  return "inline";
}

/* ── The diagnosis ────────────────────────────────────────────────────────── */

export type Verdict = "outperformed" | "inline" | "underperformed" | "insufficient_data";

export const VERDICT_COPY: Record<Verdict, { label: string; tone: "good" | "flat" | "bad" | "quiet" }> = {
  outperformed: { label: "Beat your own average", tone: "good" },
  inline: { label: "In line with your average", tone: "flat" },
  underperformed: { label: "Under your own average", tone: "bad" },
  insufficient_data: { label: "Not enough yet to say", tone: "quiet" },
};

export type FunnelStage = "hook" | "body" | "offer" | "downstream" | "none" | "unknown";

export const STAGE_COPY: Record<FunnelStage, { label: string; where: string }> = {
  hook: {
    label: "The hook",
    where: "the first seconds, the opening frame, or the format",
  },
  body: {
    label: "The body",
    where: "the middle — the hook wrote a cheque the body didn't cash",
  },
  offer: {
    label: "The offer",
    where: "what you asked for, or the call to action",
  },
  downstream: {
    label: "After the click",
    where: "the ad did its job — the drop-off is on the page or the checkout",
  },
  none: { label: "Nothing failing", where: "every stage is at or above your normal" },
  unknown: {
    label: "Can't tell yet",
    where: "the numbers needed to separate the stages weren't reported",
  },
};

export type Diagnosis = {
  verdict: Verdict;
  /** Why a refusal is a refusal — shown instead of a verdict, never alongside one. */
  refusal: string | null;
  impressions: number | null;
  daysLive: number | null;
  rates: DerivedRates;
  indexed: IndexedRates;
  stage: FunnelStage;
  /** Beat-level, specific, and never "the creative didn't resonate". */
  reading: string[];
  /** Did the borrowed angle carry over into their own brand's voice? */
  angleVerdict: "transferred" | "did_not_transfer" | "cannot_say";
  nextMoves: { change: string; why: string }[];
  baselineNote: string;
  /** Only set when this ad is solid enough to teach the pattern library. */
  patternSignal: {
    direction: "positive" | "negative";
    confidence: "low" | "medium";
  } | null;
};

function fmtPct(value: number | null): string {
  return value === null ? "not reported" : `${(value * 100).toFixed(1)}%`;
}

/**
 * The whole diagnosis, in one pure function.
 *
 * Order matters and it is deliberate: the volume gate runs FIRST and returns
 * early. Nothing downstream can talk its way past it, which is the only reliable
 * way to keep a thin-data verdict from ever being rendered.
 */
export function diagnose(input: {
  reading: ReportedReading;
  baseline: Baseline;
  /** True when this variant inherited a competitor angle — most do. */
  inheritedAngle?: boolean;
}): Diagnosis {
  const { reading, baseline } = input;
  const rates = deriveRates(reading);
  const indexed = indexRates(rates, baseline);
  const impressions = num(reading.impressions);
  const daysLive = num(reading.daysLive);

  const base: Omit<Diagnosis, "verdict" | "refusal" | "stage" | "reading" | "angleVerdict" | "nextMoves" | "patternSignal"> = {
    impressions,
    daysLive,
    rates,
    indexed,
    baselineNote: baseline.basisNote,
  };

  // ── The gate. Nothing gets a verdict on noise.
  if (impressions === null) {
    return {
      ...base,
      verdict: "insufficient_data",
      refusal:
        "No view count reported yet, so there's nothing to weigh this against. Add the views from your own dashboard and the reading appears.",
      stage: "unknown",
      reading: [],
      angleVerdict: "cannot_say",
      nextMoves: [],
      patternSignal: null,
    };
  }
  if (impressions < MIN_IMPRESSIONS_FOR_DIAGNOSIS) {
    return {
      ...base,
      verdict: "insufficient_data",
      refusal: `${impressions.toLocaleString("en-GB")} views isn't enough to read anything into. AdMirror waits for ${MIN_IMPRESSIONS_FOR_DIAGNOSIS.toLocaleString("en-GB")} — below that the swings are noise, and a confident answer here would be made up.`,
      stage: "unknown",
      reading: [],
      angleVerdict: "cannot_say",
      nextMoves: [],
      patternSignal: null,
    };
  }
  if (daysLive !== null && daysLive < MIN_DAYS_FOR_DIAGNOSIS) {
    return {
      ...base,
      verdict: "insufficient_data",
      refusal: `Only ${daysLive} day${daysLive === 1 ? "" : "s"} running. Delivery is still settling in the first few days, so give it ${MIN_DAYS_FOR_DIAGNOSIS} before reading the numbers.`,
      stage: "unknown",
      reading: [],
      angleVerdict: "cannot_say",
      nextMoves: [],
      patternSignal: null,
    };
  }
  if (baseline.basis === "none") {
    return {
      ...base,
      verdict: "insufficient_data",
      refusal:
        "There's nothing to compare this to yet. An absolute rate says nothing on its own — add your own account averages, or ship a few more ads, and AdMirror can index this against your normal.",
      stage: "unknown",
      reading: [
        `Views ${impressions.toLocaleString("en-GB")} · scroll-stop ${fmtPct(rates.thumbstop)} · held to three-quarters ${fmtPct(rates.hold)} · clicks ${fmtPct(rates.click)}.`,
      ],
      angleVerdict: "cannot_say",
      nextMoves: [],
      patternSignal: null,
    };
  }

  // ── Which stage is failing. Walk the funnel in order and stop at the first
  //    break: a low hold rate under a broken hook is not a body problem, it is
  //    the same problem measured twice.
  const stops = standingOf(indexed.thumbstop);
  const holds = standingOf(indexed.hold);
  const clicks = standingOf(indexed.click);
  const costs = standingOf(indexed.cost);

  let stage: FunnelStage = "unknown";
  const readingLines: string[] = [];
  const nextMoves: { change: string; why: string }[] = [];

  if (stops === "below") {
    stage = "hook";
    readingLines.push(
      `${fmtPct(rates.thumbstop)} of people who saw this stopped for it — that's ${indexed.thumbstop}% of your own normal. The problem is in the first seconds, before anyone heard the argument.`,
    );
    nextMoves.push({
      change: "Rebuild the opening three seconds against the same angle.",
      why: "The angle was never seen, so it hasn't been tested yet — only the opening has.",
    });
    nextMoves.push({
      change: "Try the other opening frame from this run's set.",
      why: "Same body, different first frame: that isolates the hook as the one thing that changed.",
    });
  } else if (holds === "below") {
    stage = "body";
    readingLines.push(
      `The opening worked — ${fmtPct(rates.thumbstop)} stopped, ${indexed.thumbstop}% of your normal. Then it lost them: ${fmtPct(rates.hold)} of those stayed to three-quarters, ${indexed.hold}% of your normal.`,
    );
    nextMoves.push({
      change: "Move the proof beat earlier, before the halfway point.",
      why: "They stayed for the promise and left before the evidence for it arrived.",
    });
    nextMoves.push({
      change: "Cut the body by a third and keep this hook exactly as it is.",
      why: "The hook is the one part that's already earning attention — don't spend the test on it.",
    });
  } else if (clicks === "below") {
    stage = "offer";
    readingLines.push(
      `People watched it — ${indexed.hold ?? "—"}% of your normal hold — and then didn't tap. Clicks ran at ${fmtPct(rates.click)}, ${indexed.click}% of your normal.`,
    );
    nextMoves.push({
      change: "Say the offer out loud in the last beat, and put it on screen.",
      why: "An audience that watched to the end and didn't act usually wasn't told what to do.",
    });
    nextMoves.push({
      change: "Test the other call to action from this run's copy options.",
      why: "The creative is carrying its weight, so the cheapest variable left is the ask.",
    });
  } else if (costs === "below") {
    stage = "downstream";
    readingLines.push(
      `The ad did its job: attention and clicks are at or above your normal. What's expensive is what happens after the tap — cost per result came in at ${indexed.cost}% of your normal.`,
    );
    nextMoves.push({
      change: "Leave the creative alone and look at the landing page.",
      why: "Changing a working ad to fix a page problem loses you the ad as well.",
    });
  } else if (stops === "unknown" && holds === "unknown" && clicks === "unknown") {
    stage = "unknown";
    readingLines.push(
      "The view count is there, but not the funnel numbers — without those there's no way to tell a hook problem from a body problem.",
    );
    nextMoves.push({
      change: "Add the video view counts and clicks from your dashboard.",
      why: "Those are what separate a hook failure from a body failure. Without them any answer is a guess.",
    });
  } else {
    stage = "none";
    readingLines.push(
      `Nothing is dragging: stop rate ${indexed.thumbstop ?? "—"}%, hold ${indexed.hold ?? "—"}%, clicks ${indexed.click ?? "—"}% against your own normal.`,
    );
    nextMoves.push({
      change: "Put more behind this one and build the next test off its hook.",
      why: "It's already at or above your average — the useful question now is how far it goes.",
    });
  }

  // ── The verdict. Cost per result decides it where reported, because that is
  //    the figure the user is actually spending against; otherwise the strongest
  //    reported stage stands in, and the reading says which.
  const decisive = indexed.cost ?? indexed.click ?? indexed.hold ?? indexed.thumbstop;
  const verdict: Verdict =
    decisive === null
      ? "insufficient_data"
      : decisive > INLINE_BAND.high
        ? "outperformed"
        : decisive < INLINE_BAND.low
          ? "underperformed"
          : "inline";

  const angleVerdict: Diagnosis["angleVerdict"] =
    input.inheritedAngle === false
      ? "cannot_say"
      : stage === "hook"
        ? "cannot_say"
        : verdict === "outperformed"
          ? "transferred"
          : verdict === "underperformed"
            ? "did_not_transfer"
            : "cannot_say";

  if (stage === "hook" && angleVerdict === "cannot_say") {
    readingLines.push(
      "Which means this isn't a verdict on the borrowed angle. Nobody got far enough to hear it.",
    );
  }

  // A pattern signal is only ever "low" or "medium" confidence from one ad. There
  // is no "high" from a single sample, and the type won't let one be written.
  const patternSignal: Diagnosis["patternSignal"] =
    verdict === "outperformed"
      ? { direction: "positive", confidence: impressions > 20_000 ? "medium" : "low" }
      : verdict === "underperformed"
        ? { direction: "negative", confidence: impressions > 20_000 ? "medium" : "low" }
        : null;

  return {
    ...base,
    verdict,
    refusal: null,
    stage,
    reading: readingLines,
    angleVerdict,
    nextMoves,
    patternSignal,
  };
}

/* ── The pattern library ──────────────────────────────────────────────────── */

export type PatternInput = {
  mechanism: string;
  formatLabel: string;
  categoryLabel: string;
  marketLabel: string;
  indexed: IndexedRates;
  measured: boolean;
};

export type PatternCell = {
  mechanism: string;
  formatLabel: string;
  categoryLabel: string;
  marketLabel: string;
  shippedCount: number;
  measuredCount: number;
  thumbstopIndex: number | null;
  holdIndex: number | null;
  clickIndex: number | null;
  costIndex: number | null;
  standing: "outperformed" | "inline" | "underperformed" | "too_thin";
};

/**
 * Roll shipped ads up into pattern cells.
 *
 * Cells under `MIN_N_FOR_PATTERN` measured ads come back with every index NULL
 * and `too_thin`. The numbers are dropped here, in the aggregation — not hidden
 * later in the UI — so there is no version of this data a screen could
 * accidentally render.
 */
export function rollUpPatterns(rows: PatternInput[]): PatternCell[] {
  const cells = new Map<string, { key: PatternInput; all: PatternInput[] }>();
  for (const row of rows) {
    if (!row.mechanism) continue;
    const key = [row.mechanism, row.formatLabel, row.categoryLabel, row.marketLabel].join("¦");
    const existing = cells.get(key);
    if (existing) existing.all.push(row);
    else cells.set(key, { key: row, all: [row] });
  }

  const out: PatternCell[] = [];
  for (const { key, all } of cells.values()) {
    const measured = all.filter((row) => row.measured);
    const thin = measured.length < MIN_N_FOR_PATTERN;
    const pick = (field: keyof IndexedRates) =>
      thin
        ? null
        : median(
            measured
              .map((row) => row.indexed[field])
              .filter((value): value is number => value !== null),
          );

    const costIndex = pick("cost");
    const clickIndex = pick("click");
    const decisive = costIndex ?? clickIndex;

    out.push({
      mechanism: key.mechanism,
      formatLabel: key.formatLabel,
      categoryLabel: key.categoryLabel,
      marketLabel: key.marketLabel,
      shippedCount: all.length,
      measuredCount: measured.length,
      thumbstopIndex: pick("thumbstop"),
      holdIndex: pick("hold"),
      clickIndex,
      costIndex,
      standing: thin
        ? "too_thin"
        : decisive === null
          ? "too_thin"
          : decisive > INLINE_BAND.high
            ? "outperformed"
            : decisive < INLINE_BAND.low
              ? "underperformed"
              : "inline",
    });
  }

  return out.sort(
    (a, b) => b.measuredCount - a.measuredCount || b.shippedCount - a.shippedCount,
  );
}

export const PATTERN_STANDING_COPY: Record<
  PatternCell["standing"],
  { label: string; note: string }
> = {
  outperformed: {
    label: "Carrying",
    note: "In your account, in this category and market, this mechanism has come in above your own average.",
  },
  inline: {
    label: "Level",
    note: "No better or worse than your account average — a fine default, not an edge.",
  },
  underperformed: {
    label: "Dragging",
    note: "Has come in under your own average here. Worth a different mechanism before spending again.",
  },
  too_thin: {
    label: "Too thin",
    note: `Fewer than ${MIN_N_FOR_PATTERN} measured ads, so no number is shown. A believable figure built on two ads is the most dangerous thing this screen could display.`,
  },
};

/** Formatting helpers — one place, so an index is drawn the same way everywhere. */
export function fmtIndex(index: number | null): string {
  return index === null ? "—" : `${index}%`;
}

export function fmtRate(value: number | null): string {
  return value === null ? "not reported" : `${(value * 100).toFixed(1)}%`;
}

export function fmtCount(value: number | null): string {
  return value === null ? "not reported" : value.toLocaleString("en-GB");
}
