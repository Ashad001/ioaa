"use server";

/**
 * Reading the live fetch ticker from the browser.
 *
 * One tiny action, called on an interval while a sweep is running, so the
 * console can show the number of ads ACTUALLY READ as they arrive. Every value
 * it returns was counted from a page that came back — there is no estimate here
 * and no timer-driven bar, because a progress bar that keeps climbing while a
 * search sits blocked teaches the user to distrust every other number too.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { run } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { IDLE_PROGRESS, readProgress, type ProgressSnapshot } from "@/lib/admirror/progress";

export async function fetchProgress(runId: string): Promise<ProgressSnapshot> {
  const user = await requireUser();

  // The run must belong to the caller. A record id from the browser is not a
  // permission check, so ownership is verified before anything is returned.
  const [owned] = await db
    .select({ id: run.id })
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, user.id)))
    .limit(1);
  if (!owned) return IDLE_PROGRESS;

  return readProgress(runId);
}
