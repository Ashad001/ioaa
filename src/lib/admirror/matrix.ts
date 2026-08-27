/**
 * The creative matrix and the round-by-round test plan.
 *
 * Two rules from the brief drive everything here, and both exist to make the
 * test READABLE rather than to make the output look bigger:
 *
 *  1. ONE BODY PER FORMAT. Only the hook beat changes across hook variants, so
 *     the body is written once and every hook is cut onto it. Regenerating the
 *     body per variant introduces variation nobody asked for and the test then
 *     measures nothing. `sharedBodyKey` is the proof of which body a cell used.
 *  2. ONE VARIABLE PER ROUND. Round 1 is hooks against a shared body. A round
 *     that moves hook and format together cannot be read, so the planner never
 *     emits one.
 *
 * The cap is hard: 12 assets per gate press, and the count is shown before the
 * user commits, never after.
 */

export const MATRIX_CAP = 12;

export type FormatAxis = "primary" | "contrast";

export type MatrixChoice = {
  /** Add the contrasting format — six videos instead of three. */
  contrastFormat: boolean;
  /** A static per video, built from the opening frame it already has. */
  includeStatics: boolean;
  /** Three alternative primary texts per cell. Text, not a render. */
  includeCopyVariants: boolean;
};

export const DEFAULT_MATRIX: MatrixChoice = {
  contrastFormat: false,
  includeStatics: true,
  includeCopyVariants: false,
};

export type MatrixCost = {
  /** Hook × format cells that need motion. */
  videos: number;
  /** Bodies that get written — one per format, never one per hook. */
  bodies: number;
  /** Statics reusing an opening frame that already exists. */
  statics: number;
  /** Copy-only options. Text, so they cost nothing to render. */
  copyOptions: number;
  /** Everything the user will be handed. */
  total: number;
  /** True when the choice would exceed the cap for the angles selected. */
  overCap: boolean;
  /** Plain-language line shown on the gate button's own panel. */
  summary: string;
};

const HOOKS_PER_FORMAT = 3;

export function priceMatrix(choice: MatrixChoice, angleCount: number): MatrixCost {
  const angles = Math.max(1, angleCount);
  const formats = choice.contrastFormat ? 2 : 1;
  const videos = angles * formats * HOOKS_PER_FORMAT;
  const bodies = angles * formats;
  const statics = choice.includeStatics ? videos : 0;
  const copyOptions = choice.includeCopyVariants ? videos * 3 : 0;
  const total = videos + statics;

  const parts = [
    `${videos} video brief${videos === 1 ? "" : "s"}`,
    statics > 0 ? `${statics} static${statics === 1 ? "" : "s"}` : null,
    copyOptions > 0 ? `${copyOptions} copy options` : null,
  ].filter(Boolean);

  return {
    videos,
    bodies,
    statics,
    copyOptions,
    total,
    overCap: total > MATRIX_CAP,
    summary: `${parts.join(" · ")} — ${bodies} shared bod${bodies === 1 ? "y" : "ies"}, so the only difference between hooks is the first three seconds.`,
  };
}

// ─── The test plan, in rounds ────────────────────────────────────────────────

export type TestRound = {
  round: number;
  variableUnderTest: string;
  variants: string[];
  shared: string[];
  primaryMetric: string;
  killCriterion: string;
  winnerCriterion: string;
  minDays: number;
  /** Null without a connected ad account. We never invent a cost. */
  dailyBudgetPerVariant: string | null;
  minSpendPerVariant: string | null;
};

export type RoundedTestPlan = {
  rounds: TestRound[];
  /** Whether this plan can produce a result the buyer can actually read. */
  readable: boolean;
  readabilityNote: string;
  nextRoundLogic: string;
  assumptions: string[];
};

/**
 * Build the plan. `costData` is null on this build because no ad account is
 * connected, and the planner says so instead of inventing a cost — a plan that
 * quietly assumes a delivery cost is worse than one that admits it has none.
 */
export function buildRoundedPlan(input: {
  hookLabels: string[];
  formatLabels: string[];
  angle: string;
  objective: string;
  hasCostData: boolean;
}): RoundedTestPlan {
  const { hookLabels, formatLabels, angle, objective } = input;

  const rounds: TestRound[] = [
    {
      round: 1,
      variableUnderTest: "The first three seconds — the hook, and nothing else",
      variants: hookLabels,
      shared: [
        "One body, shared by every cell in this round",
        "Same audience, placements and objective",
        "Same offer, same landing page",
      ],
      primaryMetric: "Three-second view rate against your own account's recent average",
      killCriterion:
        "A cell whose three-second view rate sits clearly below your trailing average once every cell has had the same delivery.",
      winnerCriterion:
        "The cell that holds the most viewers past three seconds while its cost per result stays inside your normal range.",
      minDays: 4,
      dailyBudgetPerVariant: null,
      minSpendPerVariant: null,
    },
  ];

  if (formatLabels.length > 1) {
    rounds.push({
      round: 2,
      variableUnderTest: "The format — the same winning hook, shot two ways",
      variants: formatLabels,
      shared: [
        "The hook that won round one, word for word",
        "Same audience, placements and objective",
      ],
      primaryMetric: "Cost per result",
      killCriterion: "The format whose cost per result is the worse of the two once both have equal delivery.",
      winnerCriterion: "The format that produces results at the lower cost on the winning hook.",
      minDays: 5,
      dailyBudgetPerVariant: null,
      minSpendPerVariant: null,
    });
  }

  rounds.push({
    round: rounds.length + 1,
    variableUnderTest: "The body — held constant until now, on purpose",
    variants: ["Winning body", "One rewritten middle section"],
    shared: ["The winning hook", "The winning format", "Same audience and offer"],
    primaryMetric: "Cost per result",
    killCriterion: "Whichever body costs more per result after equal delivery.",
    winnerCriterion: "The body that keeps more of the viewers the hook earned.",
    minDays: 5,
    dailyBudgetPerVariant: null,
    minSpendPerVariant: null,
  });

  return {
    rounds,
    readable: false,
    readabilityNote: input.hasCostData
      ? "Sized from your account's own recent delivery costs."
      : "This plan is un-costed: no ad account is connected, so AdMirror has no delivery cost to size it from. The structure is right; put your own daily budget against it and read it when every cell has had equal delivery.",
    nextRoundLogic: `Round one picks the opening beat. Whatever wins carries forward unchanged — ${angle.toLowerCase()} is the constant across every round, and the ${objective.toLowerCase()} objective never changes mid-test.`,
    assumptions: [
      "One ad set, even split, no manual bid adjustments while it runs.",
      "Every cell reaches the same audience, so the difference you read is the creative.",
      "Numbers come from your own ad account. AdMirror does not have them and will not estimate them.",
    ],
  };
}
