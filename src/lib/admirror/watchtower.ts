/**
 * THE WATCHTOWER — honest change over time.
 *
 * One sweep is a photograph of one afternoon. The intelligence a marketer
 * actually pays for is the derivative: what appeared, what stopped appearing,
 * whose angle is being repeated harder. This module computes that derivative,
 * and it is built around a single rule:
 *
 *   AN AD MISSING FROM A SWEEP IS NOT AN OBSERVATION ABOUT META.
 *   IT IS AN OBSERVATION ABOUT THE SWEEP.
 *
 * Everything follows from that. Two sweeps made under different conditions are
 * NOT comparable, and a non-comparable sweep may not advance an absence counter —
 * a search run against a different country has produced no evidence about an
 * ad's status, and pretending otherwise is how software invents a disappearance
 * and reports it as fact. Three consecutive COMPARABLE absences are required
 * before this app will say "likely no longer active", and even then it shows the
 * captures the claim rests on.
 *
 * Pure functions only — no database, no network — so the honesty rules can be
 * reasoned about and asserted in CI without either.
 */
import { createHash } from "node:crypto";

import type { EvidenceRow, SearchRow } from "./queries";

/* ────────────────────────────────────────────────────────────────────────────
 * The three states, and the words each one is allowed to use
 * ──────────────────────────────────────────────────────────────────────────── */

export type AdStatusState = "observed" | "not_observed_recently" | "likely_no_longer_active";

export const STATUS_LABEL: Record<AdStatusState, string> = {
  observed: "Observed in the latest sweep",
  not_observed_recently: "Not observed in the latest sweep",
  likely_no_longer_active: "Likely no longer active",
};

export const STATUS_NOTE: Record<AdStatusState, string> = {
  observed: "Read from the public Ad Library in the most recent comparable sweep.",
  not_observed_recently:
    "Absent from the latest sweep. That is not the same as an ad ending — it may simply not have been read this time.",
  likely_no_longer_active:
    "Absent from three consecutive comparable sweeps. Still a reading of our own sweeps, never a statement from Meta.",
};

/** The sentence that must travel with every absence, everywhere it appears. */
export const NOT_OBSERVED_WORDING =
  "Not observed in the latest submitted snapshot. Absence from a sweep is a fact about the sweep, not about the advertiser.";

export const ABSENCES_FOR_LIKELY_INACTIVE = 3;

export const THREE_COMPARABLE_RULE =
  "An ad is only called likely no longer active after three consecutive comparable sweeps have missed it. A sweep run with different filters never counts towards that.";

/* ────────────────────────────────────────────────────────────────────────────
 * Comparability — the question each sweep asked
 * ──────────────────────────────────────────────────────────────────────────── */

export type DeclaredFilters = {
  searchIds: string[];
  countries: string[];
  languages: string[];
  mediaTypes: string[];
  activeStatuses: string[];
};

const EMPTY_FILTERS: DeclaredFilters = {
  searchIds: [],
  countries: [],
  languages: [],
  mediaTypes: [],
  activeStatuses: [],
};

const unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

/**
 * The conditions a sweep ran under, derived from the searches it actually drew
 * from — not from every search on the run, or a search added afterwards would
 * retroactively make an old sweep non-comparable.
 */
export function declaredFiltersFor(input: {
  items: { searchReferenceId: string | null }[];
  searches: SearchRow[];
}): DeclaredFilters {
  const used = new Set(
    input.items.map((item) => item.searchReferenceId).filter(Boolean) as string[],
  );
  const relevant =
    used.size > 0 ? input.searches.filter((row) => used.has(row.id)) : input.searches;

  return {
    searchIds: unique(relevant.map((row) => row.id)),
    countries: unique(relevant.map((row) => row.country)),
    languages: unique(relevant.map((row) => row.language)),
    mediaTypes: unique(relevant.map((row) => row.mediaType)),
    activeStatuses: unique(relevant.map((row) => row.activeStatus)),
  };
}

/** Equal hash = the same question was asked, so a difference is a real one. */
export function comparableHashOf(filters: DeclaredFilters): string {
  const canonical = [
    filters.searchIds.join(","),
    filters.countries.join(","),
    filters.languages.join(","),
    filters.mediaTypes.join(","),
    filters.activeStatuses.join(","),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * WHICH condition differs, in plain words.
 *
 * Refusing to compare without saying why is useless to the person holding the
 * screen — they cannot fix a mismatch they can't see.
 */
export function explainConditionGap(
  older: DeclaredFilters,
  newer: DeclaredFilters,
): string[] {
  const gaps: string[] = [];

  const dropped = older.searchIds.filter((id) => !newer.searchIds.includes(id)).length;
  const added = newer.searchIds.filter((id) => !older.searchIds.includes(id)).length;
  if (dropped > 0 || added > 0) {
    const parts: string[] = [];
    if (dropped > 0) parts.push(`${dropped} search${dropped === 1 ? "" : "es"} not repeated`);
    if (added > 0) parts.push(`${added} search${added === 1 ? "" : "es"} added`);
    gaps.push(`The set of searches isn't the same (${parts.join(", ")}).`);
  }

  const compare = (label: string, a: string[], b: string[]) => {
    if (a.join(",") === b.join(",")) return;
    gaps.push(`${label} changed: ${a.join(", ") || "none"} → ${b.join(", ") || "none"}.`);
  };
  compare("Country", older.countries, newer.countries);
  compare("Language", older.languages, newer.languages);
  compare("Media filter", older.mediaTypes, newer.mediaTypes);
  compare("Active-status filter", older.activeStatuses, newer.activeStatuses);

  return gaps;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ad identity across sweeps
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Matched in order of how much the USER can verify: the Library link they can
 * click, then the exact copy they can read, then advertiser + headline. The rule
 * that matched is stored and shown — a match nobody can check is a difference
 * nobody will trust.
 */
export type MatchRule = "library_link" | "identical_copy" | "advertiser_and_headline";

export const MATCH_RULE_LABEL: Record<MatchRule, string> = {
  library_link: "matched on its Ad Library link",
  identical_copy: "matched on identical ad copy",
  advertiser_and_headline: "matched on advertiser and headline",
};

const normalise = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const shortHash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

export function adIdentity(item: EvidenceRow): { adKey: string; matchRule: MatchRule } {
  if (item.libraryUrl && item.libraryUrl.trim()) {
    return { adKey: `link:${normalise(item.libraryUrl)}`, matchRule: "library_link" };
  }
  const body = normalise(item.bodyCopy);
  if (body.length >= 24) {
    return {
      adKey: `copy:${normalise(item.advertiser)}|${shortHash(body)}`,
      matchRule: "identical_copy",
    };
  }
  return {
    adKey: `pair:${normalise(item.advertiser)}|${normalise(item.headline)}`,
    matchRule: "advertiser_and_headline",
  };
}

export function copyHashOf(item: EvidenceRow): string {
  const body = normalise(item.bodyCopy);
  return body ? shortHash(body) : "";
}

export function assetHashOf(item: EvidenceRow): string {
  const source = (item.creativeUrl ?? item.artefactUrl ?? "").trim();
  return source ? shortHash(source) : "";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Status derivation — the only place the three-sweep rule lives
 * ──────────────────────────────────────────────────────────────────────────── */

export type DeriveStatusInput = {
  previousAbsences: number;
  previousState: AdStatusState;
  observed: boolean;
  /** False when this sweep asked a different question than the last one. */
  comparable: boolean;
};

export type DeriveStatusResult = {
  state: AdStatusState;
  consecutiveAbsences: number;
  /** Why the counter moved, or didn't. Kept for the basis panel. */
  movedBy: string;
};

export function deriveStatus(input: DeriveStatusInput): DeriveStatusResult {
  if (input.observed) {
    return {
      state: "observed",
      consecutiveAbsences: 0,
      movedBy: "Read in this sweep, so the absence count resets to zero.",
    };
  }

  if (!input.comparable) {
    // THE GUARD. A sweep under different conditions is not evidence about this
    // ad, so the counter is frozen rather than advanced.
    return {
      state: input.previousAbsences > 0 ? input.previousState : "observed",
      consecutiveAbsences: input.previousAbsences,
      movedBy:
        "This sweep wasn't comparable to the last one, so its absence proves nothing and the count is unchanged.",
    };
  }

  const absences = input.previousAbsences + 1;
  if (absences >= ABSENCES_FOR_LIKELY_INACTIVE) {
    return {
      state: "likely_no_longer_active",
      consecutiveAbsences: absences,
      movedBy: `Absent from ${absences} consecutive comparable sweeps.`,
    };
  }
  return {
    state: "not_observed_recently",
    consecutiveAbsences: absences,
    movedBy: `Absent from ${absences} comparable sweep${absences === 1 ? "" : "s"} — below the ${ABSENCES_FOR_LIKELY_INACTIVE} needed to call it likely gone.`,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Signals — only what the evidence supports
 * ──────────────────────────────────────────────────────────────────────────── */

export type SignalKind =
  | "NEW_CONCEPT"
  | "REPETITION_UP"
  | "COPY_CHANGED"
  | "CREATIVE_CHANGED"
  | "LONG_RUNNING"
  | "NOT_OBSERVED"
  | "NEW_ADVERTISER"
  | "COVERAGE_DROP";

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  NEW_CONCEPT: "New angle in this sweep",
  REPETITION_UP: "Repeated harder in collected evidence",
  COPY_CHANGED: "Copy changed",
  CREATIVE_CHANGED: "Creative changed",
  LONG_RUNNING: "Running a long time",
  NOT_OBSERVED: "Not observed in the latest sweep",
  NEW_ADVERTISER: "Advertiser not on your map",
  COVERAGE_DROP: "Your sweep read less than last time",
};

export type Signal = {
  id: string;
  kind: SignalKind;
  label: string;
  subject: string;
  note: string;
  /** 1 low · 3 high. Drives the verdict and the digest decision. */
  weight: number;
};

export type Development = {
  what: string;
  who: string;
  interpretation: string;
  kind: "new" | "repeated" | "changed" | "absent";
  signalIds: string[];
};

export const VERDICT_LABEL = {
  quiet: "Quiet period",
  normal: "Some movement",
  active: "Active period",
  not_comparable: "Not comparable",
} as const;

export type Verdict = keyof typeof VERDICT_LABEL;

/* ────────────────────────────────────────────────────────────────────────────
 * The diff between two sweeps
 * ──────────────────────────────────────────────────────────────────────────── */

export type SnapshotSide = {
  id: string;
  label: string;
  capturedAt: Date | null;
  itemCount: number;
  coverageScore: number | null;
  coverageBand: string | null;
  comparableHash: string;
  filters: DeclaredFilters;
};

export type WatchtowerDiff = {
  comparable: boolean;
  /** Null when the sweeps are comparable. */
  comparabilityNote: string | null;
  conditionGaps: string[];
  coverageDropped: boolean;
  coverageNote: string;
  signals: Signal[];
  /** adKey → the rule that tied it to the earlier sweep. */
  matchRules: Record<string, MatchRule>;
  /** Present in the newer sweep only. */
  newlyObserved: { adKey: string; advertiser: string; headline: string }[];
  /** Present in the older sweep only. NEVER described as stopped. */
  notObserved: { adKey: string; advertiser: string; headline: string }[];
  /** True when there is no earlier sweep at all — a first look, not a change. */
  firstSweep: boolean;
};

type Indexed = {
  adKey: string;
  matchRule: MatchRule;
  advertiser: string;
  headline: string;
  conceptKey: string;
  conceptLabel: string;
  copyHash: string;
  assetHash: string;
  visibleStartDate: string | null;
};

function indexItems(items: EvidenceRow[]): Map<string, Indexed> {
  const out = new Map<string, Indexed>();
  for (const item of items) {
    const { adKey, matchRule } = adIdentity(item);
    if (out.has(adKey)) continue;
    out.set(adKey, {
      adKey,
      matchRule,
      advertiser: item.advertiser || "Advertiser not captured",
      headline: item.headline || "—",
      conceptKey: item.conceptKey || item.id,
      conceptLabel: item.conceptLabel || "Uncategorised angle",
      copyHash: copyHashOf(item),
      assetHash: assetHashOf(item),
      visibleStartDate: item.visibleStartDate,
    });
  }
  return out;
}

function conceptTotals(items: EvidenceRow[]) {
  const counts = new Map<string, { count: number; label: string }>();
  for (const item of items) {
    const key = item.conceptKey || item.id;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, label: item.conceptLabel || "Uncategorised angle" });
  }
  return counts;
}

export function computeWatchtowerDiff(input: {
  older: SnapshotSide | null;
  newer: SnapshotSide;
  olderItems: EvidenceRow[];
  newerItems: EvidenceRow[];
  mappedAdvertisers: string[];
}): WatchtowerDiff {
  const firstSweep = input.older === null;
  const conditionGaps = input.older
    ? explainConditionGap(input.older.filters, input.newer.filters)
    : [];
  // A first sweep is not "non-comparable" — there is simply nothing to compare
  // it to yet, and those two states must not be conflated on screen.
  const comparable = firstSweep ? true : conditionGaps.length === 0;

  const olderIndex = indexItems(input.olderItems);
  const newerIndex = indexItems(input.newerItems);

  const signals: Signal[] = [];
  let counter = 0;
  const push = (signal: Omit<Signal, "id">) => {
    counter += 1;
    signals.push({ ...signal, id: `S${counter}` });
  };

  /* Coverage FIRST — it decides what everything below is worth. */
  const olderCoverage = input.older?.coverageScore ?? null;
  const newerCoverage = input.newer.coverageScore;
  const coverageDropped =
    olderCoverage !== null && newerCoverage !== null && newerCoverage < olderCoverage - 0.1;

  if (coverageDropped && olderCoverage !== null && newerCoverage !== null) {
    push({
      kind: "COVERAGE_DROP",
      label: SIGNAL_LABEL.COVERAGE_DROP,
      subject: "This sweep",
      note:
        `Coverage fell from ${olderCoverage.toFixed(2)} to ${newerCoverage.toFixed(2)}. ` +
        "A thinner sweep looks exactly like a quiet market — rule that out before reading anything below as news.",
      weight: 3,
    });
  }

  const describeSide = (side: SnapshotSide | null) =>
    !side
      ? "no earlier sweep"
      : side.coverageScore !== null
        ? `${side.coverageBand ?? "unknown"} (${side.coverageScore.toFixed(2)}, ${side.itemCount} ads)`
        : `not recorded (${side.itemCount} ads)`;

  const coverageNote = firstSweep
    ? `First sweep on record: ${describeSide(input.newer)}. There is nothing earlier to compare it against yet.`
    : `Earlier sweep: ${describeSide(input.older)}. This sweep: ${describeSide(input.newer)}.${
        coverageDropped ? " Coverage dropped, which explains most quiet periods before the market does." : ""
      }`;

  /* Newly observed, and whether the ANGLE itself is new. */
  const olderConcepts = new Set([...olderIndex.values()].map((row) => row.conceptKey));
  const olderAdvertisers = new Set([...olderIndex.values()].map((row) => normalise(row.advertiser)));
  const mapped = new Set(input.mappedAdvertisers.map(normalise));

  const newlyObserved: WatchtowerDiff["newlyObserved"] = [];
  for (const row of newerIndex.values()) {
    if (olderIndex.has(row.adKey)) continue;
    newlyObserved.push({ adKey: row.adKey, advertiser: row.advertiser, headline: row.headline });

    if (firstSweep) continue;

    const conceptIsNew = !olderConcepts.has(row.conceptKey);
    push({
      kind: conceptIsNew ? "NEW_CONCEPT" : "REPETITION_UP",
      label: conceptIsNew ? SIGNAL_LABEL.NEW_CONCEPT : "Another ad under a known angle",
      subject: `${row.advertiser} — ${row.headline}`,
      note: conceptIsNew
        ? `A ${row.conceptLabel.toLowerCase()} angle that wasn't in the earlier sweep. One new ad is a hypothesis, not a trend.`
        : "Another ad under an angle already on the board.",
      weight: conceptIsNew ? 3 : 1,
    });

    if (!mapped.has(normalise(row.advertiser)) && !olderAdvertisers.has(normalise(row.advertiser))) {
      push({
        kind: "NEW_ADVERTISER",
        label: SIGNAL_LABEL.NEW_ADVERTISER,
        subject: row.advertiser,
        note: "This advertiser isn't on your competitor map. Worth adding if they're really a rival.",
        weight: 2,
      });
    }
  }

  /* Changed copy and creative, on ads present in both sweeps. */
  const matchRules: Record<string, MatchRule> = {};
  for (const row of newerIndex.values()) {
    const before = olderIndex.get(row.adKey);
    if (!before) continue;
    matchRules[row.adKey] = row.matchRule;

    if (before.copyHash && row.copyHash && before.copyHash !== row.copyHash) {
      push({
        kind: "COPY_CHANGED",
        label: SIGNAL_LABEL.COPY_CHANGED,
        subject: `${row.advertiser} — ${row.headline}`,
        note: `Same ad (${MATCH_RULE_LABEL[row.matchRule]}), different text. Often an offer or a claim changing.`,
        weight: 2,
      });
    }
    if (before.assetHash && row.assetHash && before.assetHash !== row.assetHash) {
      push({
        kind: "CREATIVE_CHANGED",
        label: SIGNAL_LABEL.CREATIVE_CHANGED,
        subject: `${row.advertiser} — ${row.headline}`,
        note: `Same ad (${MATCH_RULE_LABEL[row.matchRule]}), a different creative was read.`,
        weight: 2,
      });
    }
  }

  /* Repetition, measured over collected evidence and named as such. */
  if (!firstSweep) {
    const olderTotals = conceptTotals(input.olderItems);
    const newerTotals = conceptTotals(input.newerItems);
    for (const [key, entry] of newerTotals) {
      const before = olderTotals.get(key)?.count ?? 0;
      if (before > 0 && entry.count >= before * 3 && entry.count - before >= 2) {
        push({
          kind: "REPETITION_UP",
          label: SIGNAL_LABEL.REPETITION_UP,
          subject: entry.label,
          note: `${before} → ${entry.count} collected variants of this angle. A repeated angle is something the market appears to be leaning on; one new ad is not.`,
          weight: 3,
        });
      }
    }
  }

  /* Absences — the bucket whose wording matters most. */
  const notObserved: WatchtowerDiff["notObserved"] = [];
  for (const row of olderIndex.values()) {
    if (newerIndex.has(row.adKey)) continue;
    matchRules[row.adKey] = row.matchRule;
    notObserved.push({ adKey: row.adKey, advertiser: row.advertiser, headline: row.headline });
    push({
      kind: "NOT_OBSERVED",
      label: SIGNAL_LABEL.NOT_OBSERVED,
      subject: `${row.advertiser} — ${row.headline}`,
      note: comparable
        ? `${NOT_OBSERVED_WORDING} This counts as one comparable absence.`
        : `${NOT_OBSERVED_WORDING} These sweeps aren't comparable, so it doesn't even count as that.`,
      weight: comparable ? 2 : 1,
    });
  }

  /* Duration, read off the Library and never inferred. */
  const capturedAt = input.newer.capturedAt ?? new Date();
  for (const row of newerIndex.values()) {
    if (!row.visibleStartDate) continue;
    const started = new Date(row.visibleStartDate);
    if (Number.isNaN(started.getTime())) continue;
    const days = Math.floor((capturedAt.getTime() - started.getTime()) / 86_400_000);
    if (days < 90) continue;
    push({
      kind: "LONG_RUNNING",
      label: SIGNAL_LABEL.LONG_RUNNING,
      subject: `${row.advertiser} — ${row.headline}`,
      note: `Visibly started ${days} days before this sweep. Duration read off the Library — no spend or result is implied by it.`,
      weight: 2,
    });
  }

  return {
    comparable,
    comparabilityNote: comparable ? null : conditionGaps.join(" "),
    conditionGaps,
    coverageDropped,
    coverageNote,
    signals,
    matchRules,
    newlyObserved,
    notObserved,
    firstSweep,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The briefing
 * ──────────────────────────────────────────────────────────────────────────── */

export type Briefing = {
  comparable: boolean;
  comparabilityNote: string | null;
  coverageNote: string;
  headline: string;
  verdict: Verdict;
  developments: Development[];
  actions: { action: string; rationale: string }[];
  captureSuggestions: string[];
  limitations: string;
};

/**
 * Turn a diff into the words a marketing lead reads.
 *
 * The restraint here is deliberate and it is the feature: a quiet period says so
 * rather than manufacturing a narrative from three low-weight changes. A
 * briefing that cries wolf gets filtered to spam, and then the one that mattered
 * is missed too.
 */
export function writeBriefing(input: {
  diff: WatchtowerDiff;
  older: SnapshotSide | null;
  newer: SnapshotSide;
  missingAdvertisers: string[];
}): Briefing {
  const { diff } = input;

  const meaningful = diff.signals.filter((signal) => signal.kind !== "COVERAGE_DROP");
  const heavy = meaningful.filter((signal) => signal.weight >= 3);

  const verdict: Verdict = diff.firstSweep
    ? "quiet"
    : !diff.comparable
      ? "not_comparable"
      : heavy.length >= 3
        ? "active"
        : meaningful.length >= 3 || heavy.length >= 1
          ? "normal"
          : "quiet";

  const headline = (() => {
    if (diff.firstSweep) return "First sweep on record — nothing to compare yet";
    if (!diff.comparable) return "These sweeps aren't comparable";
    if (diff.coverageDropped && verdict === "quiet") {
      return "Quiet period — but this sweep also read less than the last one";
    }
    if (verdict === "quiet") return "Quiet period in collected evidence";
    if (verdict === "active") {
      const first = heavy[0];
      return first
        ? `${heavy.length} notable moves — starting with ${first.subject}`
        : "An active period";
    }
    const first = meaningful[0];
    return first
      ? `Some movement: ${first.label.toLowerCase()} — ${first.subject}`
      : "Some movement in collected evidence";
  })();

  const developments: Development[] = meaningful
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((signal) => ({
      what: signal.label,
      who: signal.subject,
      interpretation: signal.note,
      kind:
        signal.kind === "NOT_OBSERVED"
          ? "absent"
          : signal.kind === "REPETITION_UP"
            ? "repeated"
            : signal.kind === "COPY_CHANGED" || signal.kind === "CREATIVE_CHANGED"
              ? "changed"
              : "new",
      signalIds: [signal.id],
    }));

  /**
   * At most TWO actions, each tied to something in the evidence. A briefing that
   * ends in nine recommendations has made no recommendation.
   */
  const actions: { action: string; rationale: string }[] = [];
  if (!diff.comparable) {
    actions.push({
      action: "Re-run the sweep with the same searches and filters",
      rationale:
        "Until two sweeps ask the same question, nothing here counts towards an ad's history.",
    });
  } else {
    const newConcept = diff.signals.find((signal) => signal.kind === "NEW_CONCEPT");
    if (newConcept) {
      actions.push({
        action: `Look at the new angle: ${newConcept.subject}`,
        rationale: "A genuinely new angle in the market is the strongest signal available here.",
      });
    }
    const repetition = diff.signals.find((signal) => signal.kind === "REPETITION_UP");
    if (repetition && actions.length < 2) {
      actions.push({
        action: `Consider testing against ${repetition.subject}`,
        rationale:
          "A repeated angle is the closest thing to a result this evidence can show — no figures exist to confirm it.",
      });
    }
  }

  const captureSuggestions: string[] = [];
  if (!diff.comparable) {
    captureSuggestions.push(
      "Keep the same country and language filters next time so the comparison counts.",
    );
  }
  if (diff.coverageDropped) {
    captureSuggestions.push("Let the sweep read further — this one collected fewer ads than the last.");
  }
  if (input.newer.itemCount < 12) {
    captureSuggestions.push(
      "Add another competitor or two: under a dozen ads is a thin basis for any ranking.",
    );
  }
  for (const name of input.missingAdvertisers.slice(0, 3)) {
    captureSuggestions.push(`${name} is on your map but contributed no ads — check that search.`);
  }

  return {
    comparable: diff.comparable,
    comparabilityNote: diff.comparabilityNote,
    coverageNote: diff.coverageNote,
    headline,
    verdict,
    developments,
    actions: actions.slice(0, 2),
    captureSuggestions,
    limitations:
      "Both sweeps are what this app read from the public Ad Library on two occasions — not a census of anybody's advertising. " +
      "No performance figures appear anywhere because Meta publishes none for ordinary commercial ads.",
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cadence and digests
 * ──────────────────────────────────────────────────────────────────────────── */

/** When to look again. A reminder, not a fetch schedule. */
export function nextReminderFrom(lastLookedAt: Date, cadenceDays: number): Date {
  const next = new Date(lastLookedAt);
  next.setDate(next.getDate() + cadenceDays);
  return next;
}

export const CADENCE_OPTIONS = [
  { days: 7, label: "Weekly", note: "For a fast market with several active advertisers." },
  { days: 14, label: "Fortnightly", note: "The default — long enough for creative to actually change." },
  { days: 30, label: "Monthly", note: "For a slow market, or a run you're keeping warm." },
] as const;

/** A digest goes out only when the period earned one. */
export function shouldSendDigest(briefing: Briefing): { send: boolean; reason: string } {
  if (briefing.verdict === "quiet") {
    return {
      send: false,
      reason:
        "The period was quiet. An email about nothing is how a digest teaches people to ignore it.",
    };
  }
  if (briefing.verdict === "not_comparable") {
    return {
      send: false,
      reason:
        "The sweeps weren't comparable, so there is no change to report — only a sweep worth redoing.",
    };
  }
  return { send: true, reason: "The period had real movement worth an email." };
}

export { EMPTY_FILTERS };
