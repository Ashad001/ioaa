/**
 * The blocking honesty check (`10 §3.1`).
 *
 * The public Ad Library does not publish per-ad impressions, spend, CTR, ROAS or
 * conversions for ordinary commercial ads. So if one of those words appears in a
 * user-facing string about a competitor's ad, the interface is claiming to know
 * something it cannot know. This grep is cheap and it blocks.
 *
 * Run it with `npm run check:wording`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const FORBIDDEN = [
  "best performing",
  "top performing",
  "best-performing",
  "top-performing",
  "impressions",
  "roas",
  "ctr",
  "conversion rate",
  "scaling budget",
  "market's best",
  "killed",
  "stopped running",
  // ── Watchtower vocabulary. An ad absent from OUR capture is a fact about the
  // capture, not about Meta, so none of these may describe one. "Paused" and
  // "dead" claim a state Meta never told us; "doubling down" turns one new ad
  // into a strategy we cannot see.
  "paused",
  "ad is dead",
  "now dead",
  "went dark",
  "doubling down",
  "no longer running",
];

/**
 * The two modules that DEFINE the rule are exempt: `provenance.ts` holds the
 * banned-word list itself, and `diff.ts` documents why "killed" is banned. A
 * check that flags its own rulebook flags nothing useful.
 */
const RULE_FILES = [
  "src/lib/admirror/provenance.ts",
  "src/lib/admirror/diff.ts",
  "src/lib/admirror/watchtower.ts",
];

const LOOP_FILES = [
  "src/db/schema.ts",
  "src/lib/admirror/outcome.ts",
  "src/app/actions/outcome.ts",
  "src/app/results/page.tsx",
  "src/app/patterns/page.tsx",
  "src/components/results/index-strip.tsx",
  "src/components/results/report-form.tsx",
  "src/components/results/result-card.tsx",
  "src/components/results/baseline-panel.tsx",
  "src/components/results/ship-panel.tsx",
  "src/components/patterns/pattern-grid.tsx",
  "src/components/board/own-row.tsx",
  "src/app/runs/[id]/board/page.tsx",
  "src/lib/admirror/queries.ts",
  "src/lib/admirror/refit.ts",
  "src/app/actions/refit.ts",
  "src/components/results/weights-panel.tsx",
];

/**
 * The PROSE in a line — what a person could actually read on screen.
 *
 * Two things are stripped before checking, and both matter:
 *  · `${...}` inside a template literal, because that is an identifier being
 *    interpolated, not words. `${impressions.toLocaleString()} views` says
 *    "views" to the user; the variable name is not on screen.
 *  · any quoted string with no whitespace in it, because a single token is a
 *    field name, a key or a prop value (`set("impressions")`), never a sentence.
 * What is left is genuine copy, and the ban applies to it in full.
 */
function proseOnly(line) {
  const found = line.match(/"[^"]*"|'[^']*'|`[^`]*`/g);
  if (!found) return "";
  return found
    .map((chunk) => chunk.slice(1, -1).replace(/\$\{[^}]*\}/g, " "))
    .filter((text) => /\s/.test(text.trim()))
    .join(" ");
}

/** A line that is a comment is documentation, not a claim shown to anyone. */
function isComment(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

const ROOTS = ["src"];
const EXTENSIONS = [".tsx", ".ts"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.some((ext) => full.endsWith(ext))) out.push(full);
  }
  return out;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const normalised = file.split(sep).join("/");
    if (RULE_FILES.includes(normalised)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    const loopFile = LOOP_FILES.includes(normalised);
    lines.forEach((line, index) => {
      if (isComment(line)) return;
      // In the measured half only the user-facing strings are checked; the field
      // names are allowed to name the thing the user actually reported.
      const subject = loopFile ? proseOnly(line) : line;
      const lower = subject.toLowerCase();
      for (const word of FORBIDDEN) {
        if (!lower.includes(word)) continue;
        // `ctr` and `roas` are substrings of ordinary identifiers, so require a
        // word boundary for the short ones.
        if (word.length <= 4 && !new RegExp(`\\b${word}\\b`).test(lower)) continue;
        findings.push(`${file}:${index + 1}  “${word}”  →  ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Forbidden metric wording found. These figures do not exist for commercial ads:\n");
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    `\n${findings.length} finding${findings.length === 1 ? "" : "s"}. Use the allowed phrasings in src/lib/admirror/provenance.ts.`,
  );
  process.exit(1);
}

/**
 * ── The three-capture rule, enforced rather than documented ─────────────────
 *
 * "Likely no longer active" is the strongest claim this product makes about a
 * competitor's ad, and it is reachable ONLY after three consecutive COMPARABLE
 * sweeps have missed it. These assertions run the real derivation, because a
 * rule that lives only in a comment is a rule that quietly stops being true.
 */
const { deriveStatus, ABSENCES_FOR_LIKELY_INACTIVE } = await import(
  "../src/lib/admirror/watchtower.ts"
);

const ruleFailures = [];
const assert = (condition, description) => {
  if (!condition) ruleFailures.push(description);
};

// One and two comparable absences must NOT reach the strong claim.
let carried = { previousAbsences: 0, previousState: "observed" };
for (let seen = 1; seen < ABSENCES_FOR_LIKELY_INACTIVE; seen += 1) {
  const result = deriveStatus({
    previousAbsences: carried.previousAbsences,
    previousState: carried.previousState,
    observed: false,
    comparable: true,
  });
  assert(
    result.state === "not_observed_recently",
    `${seen} comparable absence(s) produced "${result.state}" — only 3+ may reach likely_no_longer_active.`,
  );
  carried = { previousAbsences: result.consecutiveAbsences, previousState: result.state };
}

// The third one may.
const third = deriveStatus({
  previousAbsences: carried.previousAbsences,
  previousState: carried.previousState,
  observed: false,
  comparable: true,
});
assert(
  third.state === "likely_no_longer_active",
  `Three comparable absences produced "${third.state}" — the rule is not being applied.`,
);

// A NON-comparable capture must not move the counter at all.
const frozen = deriveStatus({
  previousAbsences: 2,
  previousState: "not_observed_recently",
  observed: false,
  comparable: false,
});
assert(
  frozen.consecutiveAbsences === 2 && frozen.state !== "likely_no_longer_active",
  "A non-comparable capture advanced the absence counter. A capture under different filters is not evidence about an ad.",
);

// Ten non-comparable captures in a row must still not get there.
let drifting = { previousAbsences: 0, previousState: "observed" };
for (let i = 0; i < 10; i += 1) {
  const result = deriveStatus({
    previousAbsences: drifting.previousAbsences,
    previousState: drifting.previousState,
    observed: false,
    comparable: false,
  });
  drifting = { previousAbsences: result.consecutiveAbsences, previousState: result.state };
}
assert(
  drifting.previousAbsences < ABSENCES_FOR_LIKELY_INACTIVE,
  "Repeated non-comparable captures reached the strong claim. That is the product inventing a disappearance.",
);

// Being seen again resets it.
const back = deriveStatus({
  previousAbsences: 2,
  previousState: "not_observed_recently",
  observed: true,
  comparable: true,
});
assert(
  back.consecutiveAbsences === 0 && back.state === "observed",
  "An ad seen again did not reset its absence count.",
);

if (ruleFailures.length > 0) {
  console.error("The three-capture honesty rule is broken:\n");
  for (const failure of ruleFailures) console.error(`  ${failure}`);
  process.exit(1);
}

/**
 * ── The thin-data refusal, enforced rather than documented ──────────────────
 *
 * The closed loop is the one place real performance figures exist, which makes
 * it the one place the product can overclaim about its OWN work. The protection
 * is a refusal: below a volume floor, and with nothing to compare against, no
 * verdict is produced at all.
 *
 * A refusal that lives in a comment is a refusal that quietly stops happening
 * the first time someone adds a fallback, so these assertions run the real
 * `diagnose()` and the real `rollUpPatterns()`.
 */
const {
  diagnose,
  rollUpPatterns,
  statedBaseline,
  MIN_IMPRESSIONS_FOR_DIAGNOSIS,
  MIN_DAYS_FOR_DIAGNOSIS,
  MIN_N_FOR_PATTERN,
  NO_BASELINE,
  EMPTY_READING,
} = await import("../src/lib/admirror/outcome.ts");

const loopFailures = [];
const expect = (condition, description) => {
  if (!condition) loopFailures.push(description);
};

const solidBaseline = statedBaseline({
  clickThroughPct: "1.2",
  thumbstopPct: "20",
  holdPct: "40",
  costPerResult: "10",
  basisNote: "test",
});

expect(solidBaseline !== null, "A baseline with real figures was read as empty.");

const reading = (over) => ({ ...EMPTY_READING, ...over });

// Thin volume must refuse, and must not name a failing stage.
const thin = diagnose({
  reading: reading({
    impressions: String(MIN_IMPRESSIONS_FOR_DIAGNOSIS - 1),
    daysLive: "14",
    clicks: "40",
    watched25: "300",
    watched75: "100",
    amountSpent: "500",
    results: "10",
  }),
  baseline: solidBaseline,
});
expect(
  thin.verdict === "insufficient_data" && thin.refusal !== null,
  `${MIN_IMPRESSIONS_FOR_DIAGNOSIS - 1} views produced "${thin.verdict}" — below the floor there must be no verdict.`,
);
expect(
  thin.stage === "unknown" && thin.reading.length === 0 && thin.nextMoves.length === 0,
  "A refused diagnosis still named a failing stage or offered next moves. A refusal must be empty of interpretation.",
);
expect(
  thin.patternSignal === null,
  "A refused diagnosis emitted a pattern signal. That is exactly how noise gets into the pattern library.",
);

// Too new must refuse even with plenty of volume.
const tooNew = diagnose({
  reading: reading({
    impressions: "500000",
    daysLive: String(MIN_DAYS_FOR_DIAGNOSIS - 1),
    clicks: "9000",
  }),
  baseline: solidBaseline,
});
expect(
  tooNew.verdict === "insufficient_data",
  `An ad ${MIN_DAYS_FOR_DIAGNOSIS - 1} day(s) old produced "${tooNew.verdict}" — delivery has not settled yet.`,
);

// No baseline must refuse: an absolute rate is not a verdict.
const unanchored = diagnose({
  reading: reading({ impressions: "80000", daysLive: "21", clicks: "1600", watched25: "20000" }),
  baseline: NO_BASELINE,
});
expect(
  unanchored.verdict === "insufficient_data" && unanchored.refusal !== null,
  "With no baseline a verdict was produced anyway. There is nothing to compare an absolute rate against.",
);

// And with volume, time and a baseline, a verdict IS produced — the gate must
// not be so tight that the feature never works.
const solid = diagnose({
  reading: reading({
    impressions: "120000",
    daysLive: "21",
    clicks: "2400",
    watched25: "36000",
    watched75: "18000",
    amountSpent: "1000",
    results: "200",
  }),
  baseline: solidBaseline,
});
expect(
  solid.verdict !== "insufficient_data" && solid.refusal === null,
  "A well-measured ad was still refused a verdict — the gate is misfiring.",
);

// A pattern cell under the minimum must carry NO numbers at all.
const indexed = { thumbstop: 130, hold: 120, click: 140, cost: 150 };
const sparse = rollUpPatterns(
  Array.from({ length: MIN_N_FOR_PATTERN - 1 }, () => ({
    mechanism: "Objection first",
    formatLabel: "Studio",
    categoryLabel: "Software",
    marketLabel: "AE",
    indexed,
    measured: true,
  })),
);
expect(
  sparse.length === 1 && sparse[0].standing === "too_thin",
  `${MIN_N_FOR_PATTERN - 1} measured ads produced "${sparse[0]?.standing}" — under the minimum a cell must read too_thin.`,
);
expect(
  sparse[0] &&
    sparse[0].thumbstopIndex === null &&
    sparse[0].holdIndex === null &&
    sparse[0].clickIndex === null &&
    sparse[0].costIndex === null,
  "A thin pattern cell carried numbers. They must be dropped in the roll-up, not hidden in the UI.",
);

const thick = rollUpPatterns(
  Array.from({ length: MIN_N_FOR_PATTERN }, () => ({
    mechanism: "Objection first",
    formatLabel: "Studio",
    categoryLabel: "Software",
    marketLabel: "AE",
    indexed,
    measured: true,
  })),
);
expect(
  thick[0] && thick[0].standing !== "too_thin" && thick[0].costIndex !== null,
  `${MIN_N_FOR_PATTERN} measured ads still read too_thin — the pattern library would never show anything.`,
);

// Unmeasured ads count toward "shipped" but never toward a figure.
const unmeasured = rollUpPatterns(
  Array.from({ length: 20 }, () => ({
    mechanism: "Direct claim",
    formatLabel: "Studio",
    categoryLabel: "Retail",
    marketLabel: "AE",
    indexed: { thumbstop: null, hold: null, click: null, cost: null },
    measured: false,
  })),
);
expect(
  unmeasured[0] && unmeasured[0].standing === "too_thin" && unmeasured[0].shippedCount === 20,
  "Twenty shipped-but-unmeasured ads produced a readable pattern. Shipping is not evidence of working.",
);

if (loopFailures.length > 0) {
  console.error("The measured-half honesty rules are broken:\n");
  for (const failure of loopFailures) console.error(`  ${failure}`);
  process.exit(1);
}


/* ──────────────────────────────────────────────────────────────────────────────
 * THE WEIGHT RE-FIT'S TWO PROMISES, ASSERTED
 *
 * The re-fit is the only feature that changes AdMirror's own arithmetic, so it
 * carries the two promises most worth breaking under pressure: it shows nothing
 * below the sample threshold, and it never applies itself. Both are enforced in
 * code paths a future edit could quietly undo, so both are executed here.
 * ────────────────────────────────────────────────────────────────────────────── */

const {
  fitWeights,
  normaliseWeights,
  weightsSum,
  parseWeights,
  isDefaultWeights,
  correlate,
  qualifying,
  refitReadiness,
  MIN_ADS_FOR_REFIT,
  MIN_DAYS_FOR_REFIT,
  MIN_COMPONENT_WEIGHT,
  MAX_COMPONENT_WEIGHT,
  DEFAULT_WEIGHTS,
} = await import("../src/lib/admirror/refit.ts");
const { EBOS_WEIGHTS } = await import("../src/lib/admirror/scoring.ts");

const refitFailures = [];
const requireThat = (condition, description) => {
  if (!condition) refitFailures.push(description);
};

const COMPONENTS = Object.keys(EBOS_WEIGHTS);

// 0. The re-fit's copy of the shipped weighting must BE the shipped weighting.
//    It is duplicated so the fit module carries no runtime import, and a silent
//    drift here would mean the screen shows one weighting while boards rank on
//    another.
requireThat(
  COMPONENTS.length === Object.keys(DEFAULT_WEIGHTS).length &&
    COMPONENTS.every((key) => DEFAULT_WEIGHTS[key] === EBOS_WEIGHTS[key]),
  "The re-fit's default weighting has drifted from the score's own. The screen would show one weighting while the ranking used another.",
);

const sample = (index, days, over = {}) => ({
  shippedAdId: `ad-${index}`,
  label: `Ad ${index}`,
  components: {
    duration_visible: (index % 10) / 10,
    variant_repetition: ((index * 3) % 10) / 10,
    evidenced_rank: ((index * 7) % 10) / 10,
    recency: ((index * 5) % 10) / 10,
    platform_breadth: ((index * 2) % 10) / 10,
  },
  costIndex: 80 + ((index * 11) % 60),
  daysLive: days,
  measured: true,
  ...over,
});

const many = (count, days, over) =>
  Array.from({ length: count }, (unused, index) => sample(index, days, over));

// 1. Below the threshold: a refusal, and no weighting to look at.
const shortSample = fitWeights(many(MIN_ADS_FOR_REFIT - 1, 30), EBOS_WEIGHTS);
requireThat(
  shortSample.enough === false && shortSample.proposal === undefined,
  `A fit on ${MIN_ADS_FOR_REFIT - 1} ads produced a proposal. Below ${MIN_ADS_FOR_REFIT} it must refuse and show no weighting at all.`,
);

// 2. An ad with results but no time to settle cannot vote. A day-one reading
//    measures the launch, not the angle.
const tooNewToVote = fitWeights(many(MIN_ADS_FOR_REFIT + 20, MIN_DAYS_FOR_REFIT - 1), EBOS_WEIGHTS);
requireThat(
  tooNewToVote.enough === false && tooNewToVote.usable === 0,
  `Ads with fewer than ${MIN_DAYS_FOR_REFIT} days of results were counted toward a fit.`,
);
requireThat(
  refitReadiness(many(MIN_ADS_FOR_REFIT + 20, MIN_DAYS_FOR_REFIT - 1)).tooYoung ===
    MIN_ADS_FOR_REFIT + 20,
  "Ads that are merely too new were not reported as too new, so the screen cannot tell the user which part of the gap closes on its own.",
);

// 3. A missing cost is not a neutral one — averaging it in would drag every
//    weight toward nothing.
const noCost = fitWeights(many(MIN_ADS_FOR_REFIT + 10, 30, { costIndex: null }), EBOS_WEIGHTS);
requireThat(
  noCost.enough === false && noCost.usable === 0,
  "Ads with no reported cost per result were treated as usable evidence. A missing number is not a neutral one.",
);

// 4. Nor is an unmeasured ad. Shipping something is not evidence it worked.
const unreported = fitWeights(many(MIN_ADS_FOR_REFIT + 10, 30, { measured: false }), EBOS_WEIGHTS);
requireThat(
  unreported.enough === false && qualifying(many(MIN_ADS_FOR_REFIT + 10, 30, { measured: false })).length === 0,
  "Shipped-but-unreported ads were allowed to vote on the weighting. Shipping is not evidence of working.",
);

// 5. Above the threshold there is a proposal, and its vector is a real vector.
const fitted = fitWeights(many(MIN_ADS_FOR_REFIT + 30, 21), EBOS_WEIGHTS);
requireThat(fitted.enough === true, "A fit on a sufficient, varied sample refused to propose anything.");
if (fitted.enough) {
  const { proposal } = fitted;
  requireThat(
    weightsSum(proposal.toWeights) === 1,
    "A proposed weighting did not sum to 1. A vector summing to anything else silently rescales every score it touches.",
  );
  requireThat(
    COMPONENTS.every((key) => proposal.toWeights[key] >= MIN_COMPONENT_WEIGHT - 0.0005),
    "A proposed weighting pushed a component below its floor, effectively switching a signal off with nothing on screen to say so.",
  );
  requireThat(
    COMPONENTS.every((key) => proposal.toWeights[key] <= MAX_COMPONENT_WEIGHT + 0.0005),
    "A proposed weighting let one signal exceed its cap and take over the ranking.",
  );
  requireThat(
    proposal.sampleSize >= MIN_ADS_FOR_REFIT,
    "A proposal reported a sample size below the threshold it is supposed to enforce.",
  );
  requireThat(
    proposal.evidence.length === COMPONENTS.length && proposal.summary.length > 0,
    "A proposal arrived without its full per-component evidence. A weighting with no visible provenance is exactly what this product refuses everywhere else.",
  );
  requireThat(
    proposal.evidence.every((fit) => fit.correlation === null || fit.n >= 3),
    "A component was given a correlation on fewer than three paired points.",
  );
  requireThat(
    proposal.fitQuality !== "strong",
    `A bare-minimum sample was graded a strong fit. "Strong" must be unreachable at ${MIN_ADS_FOR_REFIT + 30} ads.`,
  );
}

// 6. A merely PROPOSED vector is inert: the live weighting is read from the
//    accepted row only, so with nothing accepted the ranking must fall back to
//    AdMirror's own weighting. This is the never-auto-apply guarantee.
requireThat(
  parseWeights(null) === null && parseWeights("") === null,
  "An absent stored weighting did not read as absent, so the ranking could silently run on something nobody accepted.",
);
requireThat(
  isDefaultWeights({ ...EBOS_WEIGHTS }),
  "AdMirror's own weighting did not recognise itself as the default, so the screen cannot tell the user which weighting is running.",
);

// 7. A half-written or hand-edited vector is refused outright rather than
//    silently dropping a component to zero.
requireThat(
  parseWeights('{"duration_visible":0.5,"recency":"nonsense"}') === null &&
    parseWeights('{"duration_visible":0.5}') === null,
  "A partly-unreadable stored weighting was accepted. A vector missing a component would remove that signal from the ranking invisibly.",
);
const goodVector = parseWeights(JSON.stringify(EBOS_WEIGHTS));
requireThat(
  goodVector !== null && weightsSum(goodVector) === 1,
  "A well-formed stored weighting failed to parse back into a vector summing to 1.",
);

// 8. The correlation refuses itself rather than returning a confident NaN.
requireThat(
  correlate([1, 2], [3, 4]) === null && correlate([1, 1, 1, 1], [2, 5, 9, 3]) === null,
  "The correlation returned a number for two points, or for a component with no spread. Neither can explain anything.",
);

// 9. And the normaliser holds under a lopsided input.
requireThat(
  weightsSum(
    normaliseWeights({
      duration_visible: 9,
      variant_repetition: 0.0001,
      evidenced_rank: 0.0001,
      recency: 0.0001,
      platform_breadth: 0.0001,
    }),
  ) === 1,
  "The weighting normaliser produced a vector that does not sum to 1.",
);

if (refitFailures.length > 0) {
  console.error("The weight re-fit's promises are broken:\n");
  for (const failure of refitFailures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  "Wording check passed: no forbidden metric claims, the three-sweep rule holds " +
    "(1-2 comparable absences stay soft, 3 reach the claim, non-comparable sweeps never do), " +
    "the measured half refuses a verdict on thin volume, on a too-new ad, and with no baseline, " +
    `and the weight re-fit shows nothing below ${MIN_ADS_FOR_REFIT} measured ads, never applies itself, and always proposes a vector summing to 1.`,
);
