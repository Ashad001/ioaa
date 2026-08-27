import "server-only";

/**
 * Work a page does on first open, safe to run DURING render.
 *
 * These are deliberately NOT server actions. An action calls `revalidatePath`,
 * and Next refuses that during render — so calling one from a page body throws at
 * runtime while type-checking perfectly. The page reads fresh data itself
 * immediately afterwards, so no revalidation is needed here anyway.
 *
 * NOTE ON WHAT MOVED OUT OF HERE. Competitors used to be INVENTED in this file
 * from the brand name and market. They are now DISCOVERED by sweeping the public
 * Ad Library for the words the brand's own site uses — a real lookup, which
 * takes seconds and must not happen inside a render. That work lives in the
 * autopilot action and is kicked off from the console by the runner component.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { evidenceBatch, run, runStep } from "@/db/schema";
import { deriveDossier } from "@/lib/admirror/pipeline";

async function setStep(runId: string, name: string, state: string, detail?: string) {
  const patch: Record<string, unknown> = { state };
  if (detail !== undefined) patch.detail = detail;
  if (state === "running") patch.startedAt = new Date();
  if (state === "done") patch.finishedAt = new Date();
  await db
    .update(runStep)
    .set(patch)
    .where(and(eq(runStep.runId, runId), eq(runStep.name, name)));
}

/**
 * Step 2 only — a brand read good enough to render the console immediately, so
 * the page is never blank while discovery runs. Idempotent.
 */
export async function ensureResearch(current: typeof run.$inferSelect) {
  if (current.dossier) {
    // A run started from a website already carries its site read; only fill in
    // the derived dossier fields if they are missing.
    try {
      const stored = JSON.parse(current.dossier) as Record<string, unknown>;
      if (stored.positioning) return;
    } catch {
      // Unreadable dossier — fall through and rewrite it.
    }
  }

  const objectives = current.objectives.split(",").filter(Boolean);
  const dossier = deriveDossier({
    brandName: current.brandName,
    brandWebsite: current.brandWebsite,
    marketLabel: current.marketLabel,
    objectives,
  });

  let existing: Record<string, unknown> = {};
  try {
    existing = current.dossier ? (JSON.parse(current.dossier) as Record<string, unknown>) : {};
  } catch {
    existing = {};
  }

  await db
    .update(run)
    .set({
      dossier: JSON.stringify({ ...existing, ...dossier }),
      stepCursor: current.stepCursor === "1" ? "2" : current.stepCursor,
      updatedAt: new Date(),
    })
    .where(eq(run.id, current.id));
  await setStep(current.id, "BRAND_RESEARCH", "done", "Positioning, audience and voice");
}

/**
 * An open capture, so the review screen is immediately usable. CLOSING one is
 * the deliberate act; opening one never needs to be.
 */
export async function ensureOpenBatch(runId: string, label: string) {
  const [existing] = await db
    .select()
    .from(evidenceBatch)
    .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(evidenceBatch)
    .values({ runId, label, state: "open" })
    .returning();
  return created;
}
