import "server-only";

/**
 * THE LIVE FETCH TICKER.
 *
 * One row per run, rewritten as the sweep advances, so the console can show a
 * count of ads ACTUALLY READ rather than a bar that fills on a timer.
 *
 * Why this exists at all: a progress bar driven by elapsed time is a lie with a
 * friendly face — it keeps climbing while a search sits blocked, so the user
 * learns nothing from it and trusts it anyway. Every number here was counted
 * from a page that came back.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sweepProgress } from "@/db/schema";

export type SweepPhase =
  | "idle"
  | "discovering"
  | "reading"
  | "filing"
  | "scoring"
  | "done";

/** One settled search, for the per-search list the console draws. */
export type SettledSearch = {
  label: string;
  ads: number;
  /** ok · empty · blocked · failed */
  state: string;
};

export type ProgressSnapshot = {
  phase: SweepPhase;
  searchesDone: number;
  searchesTotal: number;
  adsFound: number;
  adsNew: number;
  adsWithArt: number;
  currentLabel: string;
  settled: SettledSearch[];
  updatedAt: string | null;
  startedAt: string | null;
};

export const IDLE_PROGRESS: ProgressSnapshot = {
  phase: "idle",
  searchesDone: 0,
  searchesTotal: 0,
  adsFound: 0,
  adsNew: 0,
  adsWithArt: 0,
  currentLabel: "",
  settled: [],
  updatedAt: null,
  startedAt: null,
};

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Begin a press: reset every counter so a re-sweep never inherits stale totals. */
export async function beginProgress(
  runId: string,
  phase: SweepPhase,
  searchesTotal: number,
  currentLabel = "",
): Promise<void> {
  const now = new Date();
  const values = {
    runId,
    phase,
    searchesDone: "0",
    searchesTotal: String(searchesTotal),
    adsFound: "0",
    adsNew: "0",
    adsWithArt: "0",
    currentLabel,
    perSearch: "[]",
    startedAt: now,
    updatedAt: now,
  };
  await db
    .insert(sweepProgress)
    .values(values)
    .onConflictDoUpdate({ target: sweepProgress.runId, set: values });
}

/** Record one settled search — called the moment a page comes back. */
export async function advanceProgress(
  runId: string,
  settled: SettledSearch & { newAds: number; withArt: number },
  nextLabel: string,
): Promise<void> {
  const [current] = await db
    .select()
    .from(sweepProgress)
    .where(eq(sweepProgress.runId, runId))
    .limit(1);
  if (!current) return;

  let list: SettledSearch[] = [];
  try {
    const parsed: unknown = JSON.parse(current.perSearch);
    if (Array.isArray(parsed)) list = parsed as SettledSearch[];
  } catch {
    list = [];
  }
  list.push({ label: settled.label, ads: settled.ads, state: settled.state });

  await db
    .update(sweepProgress)
    .set({
      searchesDone: String(toNumber(current.searchesDone) + 1),
      adsFound: String(toNumber(current.adsFound) + settled.ads),
      adsNew: String(toNumber(current.adsNew) + settled.newAds),
      adsWithArt: String(toNumber(current.adsWithArt) + settled.withArt),
      currentLabel: nextLabel,
      perSearch: JSON.stringify(list.slice(-40)),
      updatedAt: new Date(),
    })
    .where(eq(sweepProgress.runId, runId));
}

/** Move to a later phase without touching the counts already earned. */
export async function setProgressPhase(
  runId: string,
  phase: SweepPhase,
  currentLabel = "",
): Promise<void> {
  await db
    .update(sweepProgress)
    .set({ phase, currentLabel, updatedAt: new Date() })
    .where(eq(sweepProgress.runId, runId));
}

/** Read the ticker. Returns the idle snapshot when a run has never swept. */
export async function readProgress(runId: string): Promise<ProgressSnapshot> {
  const [row] = await db
    .select()
    .from(sweepProgress)
    .where(eq(sweepProgress.runId, runId))
    .limit(1);
  if (!row) return IDLE_PROGRESS;

  let settled: SettledSearch[] = [];
  try {
    const parsed: unknown = JSON.parse(row.perSearch);
    if (Array.isArray(parsed)) settled = parsed as SettledSearch[];
  } catch {
    settled = [];
  }

  return {
    phase: (row.phase as SweepPhase) ?? "idle",
    searchesDone: toNumber(row.searchesDone),
    searchesTotal: toNumber(row.searchesTotal),
    adsFound: toNumber(row.adsFound),
    adsNew: toNumber(row.adsNew),
    adsWithArt: toNumber(row.adsWithArt),
    currentLabel: row.currentLabel,
    settled,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  };
}
