/**
 * THE FIVE STAGES THE USER ACTUALLY HAS.
 *
 * WHY THIS EXISTS. The engine runs fifteen internal steps, and the rail used to
 * print all fifteen. Thirteen of them are stages the user neither influences nor
 * looks at — "Normalise", "Angle transfer", "Motion", "Checks" — and each one
 * was a row that lit up, meant nothing to them, and pushed the two rows that DO
 * matter ("your turn" and "your ads are ready") off the top of their attention.
 * A progress list is only useful if every line is a place the person can stand.
 *
 * So the internal steps are unchanged — the engine still records all fifteen, and
 * the timeline still shows them for anyone who wants the detail — but the rail
 * now shows the five stages where the user either DOES something or READS
 * something. A stage's state is rolled up from its members, worst-first, so a
 * failure or a "your turn" can never be hidden by a sibling that finished.
 */

import type { StepName } from "./pipeline";

export type StageId = "site" | "market" | "their-ads" | "angles" | "your-ads";

export type StageDef = {
  n: number;
  id: StageId;
  title: string;
  /** What this stage means for the user, in their words. */
  detail: string;
  /** Who moves it forward. */
  actor: "auto" | "you";
  /** The internal steps this stage rolls up. */
  steps: StepName[];
  /** Where the stage lives, relative to /runs/[id]. "" is the run root. */
  href: string;
};

export const STAGES: StageDef[] = [
  {
    n: 1,
    id: "site",
    title: "Your site",
    detail: "Read for what you sell and where",
    actor: "you",
    steps: ["INTAKE", "BRAND_RESEARCH"],
    href: "",
  },
  {
    n: 2,
    id: "market",
    title: "Who's advertising",
    detail: "Rivals found running live ads",
    actor: "auto",
    steps: ["COMPETITOR_MAP", "DISCOVERY_PLAN"],
    href: "",
  },
  {
    n: 3,
    id: "their-ads",
    title: "Their live ads",
    detail: "Collected with artwork and reach",
    actor: "auto",
    steps: ["EVIDENCE_INTAKE", "EVIDENCE_NORMALIZE"],
    href: "collect",
  },
  {
    n: 4,
    id: "angles",
    title: "The angles",
    detail: "Ranked, torn down — then your call",
    actor: "you",
    steps: ["EVIDENCE_RANK", "TEARDOWN", "HUMAN_GATE"],
    href: "board",
  },
  {
    n: 5,
    id: "your-ads",
    title: "Your ads",
    detail: "Three variants and a test plan",
    actor: "auto",
    steps: ["ANGLE_TRANSFER", "SCRIPT", "FIRST_FRAME", "MOTION", "POST", "DELIVER"],
    href: "creative",
  },
];

export type StageState = "pending" | "running" | "blocked_on_user" | "done" | "failed";

/**
 * Roll a stage up from its steps. WORST STATE WINS, deliberately: a stage that
 * needs the user, or that failed, must surface even when a later member step
 * happens to be marked done.
 */
export function rollUp(
  stage: StageDef,
  byName: Map<string, { state: string; detail: string }>,
): { state: StageState; detail: string } {
  const rows = stage.steps.map((name) => byName.get(name)).filter(Boolean) as Array<{
    state: string;
    detail: string;
  }>;

  if (rows.length === 0) return { state: "pending", detail: stage.detail };

  const failed = rows.find((row) => row.state === "failed");
  if (failed) return { state: "failed", detail: failed.detail || stage.detail };

  const blocked = rows.find((row) => row.state === "blocked_on_user");
  if (blocked) return { state: "blocked_on_user", detail: blocked.detail || stage.detail };

  const running = rows.find((row) => row.state === "running");
  if (running) return { state: "running", detail: running.detail || stage.detail };

  const done = rows.filter((row) => row.state === "done");
  if (done.length === rows.length) {
    // The last member's own detail is the most informative summary of the stage.
    const last = done[done.length - 1];
    return { state: "done", detail: last.detail || stage.detail };
  }

  if (done.length > 0) {
    return { state: "running", detail: done[done.length - 1].detail || stage.detail };
  }

  return { state: "pending", detail: stage.detail };
}

/** Which stage a given page belongs to, so the rail can mark it active. */
export const STAGE_FOR_STEP: Partial<Record<string, StageId>> = Object.fromEntries(
  STAGES.flatMap((stage) => stage.steps.map((step) => [step, stage.id])),
);
