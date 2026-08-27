import "server-only";

/**
 * Work a page does on first open, safe to run DURING render.
 *
 * These are deliberately NOT server actions. An action calls `revalidatePath`,
 * and Next refuses that during render — so calling one from a page body throws at
 * runtime while type-checking perfectly. The page reads fresh data itself
 * immediately afterwards, so no revalidation is needed here anyway.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { competitor, evidenceBatch, run, runStep } from "@/db/schema";
import { deriveCompetitorSlots, deriveDossier } from "@/lib/admirror/pipeline";

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

/** Steps 2–3: the brand read and the competitor slots. Idempotent. */
export async function ensureResearch(current: typeof run.$inferSelect) {
  const objectives = current.objectives.split(",").filter(Boolean);

  if (!current.dossier) {
    const dossier = deriveDossier({
      brandName: current.brandName,
      brandWebsite: current.brandWebsite,
      marketLabel: current.marketLabel,
      objectives,
    });
    await db
      .update(run)
      .set({
        dossier: JSON.stringify(dossier),
        status: "COMPETITOR_MAP",
        stepCursor: "2",
        updatedAt: new Date(),
      })
      .where(eq(run.id, current.id));
    await setStep(current.id, "BRAND_RESEARCH", "done", "Positioning, audience and voice read from your brief");
  }

  const existing = await db.select().from(competitor).where(eq(competitor.runId, current.id));
  if (existing.length === 0) {
    const slots = deriveCompetitorSlots({
      brandName: current.brandName,
      marketLabel: current.marketLabel,
      objectives,
    });
    await db.insert(competitor).values(
      slots.map((slot) => ({
        runId: current.id,
        name: slot.name,
        tier: slot.tier,
        whyUseful: slot.whyUseful,
        confidence: String(slot.confidence),
      })),
    );
    await setStep(current.id, "COMPETITOR_MAP", "blocked_on_user", "Name the real companies, then build the plan");
  }
}

/**
 * An open capture, so the collect screen is immediately usable. CLOSING one is
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
  await setStep(runId, "EVIDENCE_INTAKE", "blocked_on_user", "Open the searches and submit what you find");
  return created;
}
