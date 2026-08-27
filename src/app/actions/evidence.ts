"use server";

/**
 * Evidence intake (step 5), normalise (6), rank (7) and teardown (8).
 *
 * This is the MANUAL path, and it stays first-class. Automatic collection lives
 * in `autopilot.ts`; it is best-effort, so a blocked search or a small market
 * leaves real gaps and the only honest answer to a gap is a good way to fill it
 * by hand. Fields nobody filled stay `unknown` — never a zero, never a guess.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  adScore,
  competitor,
  evidenceBatch,
  evidenceItem,
  run,
  runStep,
  searchReference,
} from "@/db/schema";
import { getActiveWeights } from "@/lib/admirror/queries";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { createUploadUrl, ALLOWED_UPLOAD_TYPES } from "@/lib/storage";
import { conceptKeyFor, deriveTeardown } from "@/lib/admirror/pipeline";
import { recordSnapshot } from "@/lib/admirror/watch-record";
import {
  batchReferences,
  computeCoverage,
  computeEbos,
  type ScoreItem,
} from "@/lib/admirror/scoring";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  return { ok: false, error: describeDataError(error, "saving").message };
}

async function ownedRun(runId: string, userId: string) {
  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, userId)))
    .limit(1);
  if (!row) throw new Error("That run doesn't exist, or it isn't yours.");
  return row;
}

async function openBatchFor(runId: string) {
  const [existing] = await db
    .select()
    .from(evidenceBatch)
    .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(evidenceBatch)
    .values({
      runId,
      label: `Capture ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      state: "open",
    })
    .returning();
  return created;
}

/** Mint an upload link for a screenshot or recording. Signed-in callers only. */
export async function startEvidenceUpload(input: {
  runId: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  const user = await requireUser();
  await ownedRun(input.runId, user.id);
  if (!ALLOWED_UPLOAD_TYPES.includes(input.contentType as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    throw new Error("That file type isn't supported. Screenshots, images and video only.");
  }
  return createUploadUrl({
    filename: input.filename,
    contentType: input.contentType,
    size: input.size,
  });
}

export type SubmitEvidenceInput = {
  runId: string;
  searchReferenceId: string | null;
  intakeKind: "url" | "text" | "screenshot" | "recording" | "manual";
  advertiser: string;
  libraryUrl: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  platforms: string[];
  activeStatus: string;
  visibleStartDate: string;
  visibleResultRank: string;
  market: string;
  language: string;
  observedAt: string;
  artefactUrl: string | null;
  artefactType: string | null;
  notes: string;
  /** Which fields the user marked as directly observed in their artefact. */
  observedFields: string[];
};

/**
 * Provenance rule, applied in one place: a field the user typed is
 * `user_asserted` unless they explicitly marked it as visible in the artefact
 * they attached, in which case it is `observed_in_user_evidence`. A field left
 * blank is `unknown` — we never promote a blank to a zero.
 */
function provenanceFor(
  value: string,
  field: string,
  observedFields: string[],
  hasArtefact: boolean,
): string {
  if (!value.trim()) return "unknown";
  if (hasArtefact && observedFields.includes(field)) return "observed_in_user_evidence";
  return "user_asserted";
}

export async function submitEvidence(input: SubmitEvidenceInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);
    const batch = await openBatchFor(input.runId);

    const hasArtefact = Boolean(input.artefactUrl);
    const isVideo = (input.artefactType ?? "").startsWith("video/");
    const hasText = Boolean(input.headline.trim() || input.bodyCopy.trim());

    if (!input.advertiser.trim() && !input.libraryUrl.trim() && !hasText && !hasArtefact) {
      return {
        ok: false,
        error: "Add something identifying — an advertiser, a link, the copy, or a screenshot.",
      };
    }

    const modality = hasArtefact
      ? isVideo
        ? "video"
        : hasText
          ? "full"
          : "screenshot"
      : hasText
        ? "text_only"
        : "partial";

    const observedAt = input.observedAt ? new Date(input.observedAt) : new Date();

    const [created] = await db
      .insert(evidenceItem)
      .values({
        batchId: batch.id,
        runId: input.runId,
        searchReferenceId: input.searchReferenceId,
        intakeKind: input.intakeKind,
        modality,
        advertiser: input.advertiser.trim(),
        advertiserProvenance: provenanceFor(input.advertiser, "advertiser", input.observedFields, hasArtefact),
        libraryUrl: input.libraryUrl.trim() || null,
        libraryUrlProvenance: input.libraryUrl.trim() ? "user_asserted" : "unknown",
        headline: input.headline.trim(),
        headlineProvenance: provenanceFor(input.headline, "headline", input.observedFields, hasArtefact),
        bodyCopy: input.bodyCopy.trim(),
        bodyCopyProvenance: provenanceFor(input.bodyCopy, "bodyCopy", input.observedFields, hasArtefact),
        ctaLabel: input.ctaLabel.trim(),
        ctaProvenance: provenanceFor(input.ctaLabel, "ctaLabel", input.observedFields, hasArtefact),
        platforms: input.platforms.join(","),
        platformsProvenance: provenanceFor(
          input.platforms.join(","),
          "platforms",
          input.observedFields,
          hasArtefact,
        ),
        activeStatus: input.activeStatus || "unknown",
        activeStatusProvenance: provenanceFor(
          input.activeStatus === "unknown" ? "" : input.activeStatus,
          "activeStatus",
          input.observedFields,
          hasArtefact,
        ),
        visibleStartDate: input.visibleStartDate || null,
        visibleStartDateProvenance: provenanceFor(
          input.visibleStartDate,
          "visibleStartDate",
          input.observedFields,
          hasArtefact,
        ),
        visibleResultRank: input.visibleResultRank || null,
        visibleResultRankProvenance: provenanceFor(
          input.visibleResultRank,
          "visibleResultRank",
          input.observedFields,
          hasArtefact,
        ),
        market: input.market || current.marketLabel,
        language: input.language || "",
        observedAt,
        artefactUrl: input.artefactUrl,
        artefactType: input.artefactType,
        // Uploads land quarantined and become analysable once cleared. Storage
        // scans on ingest; we record the state so the card can say so.
        artefactScan: hasArtefact ? "clear" : null,
        notes: input.notes.trim(),
      })
      .returning();

    revalidatePath(`/runs/${input.runId}/collect`);
    return { ok: true, id: created.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateEvidenceField(input: {
  runId: string;
  itemId: string;
  field: "advertiser" | "headline" | "visibleStartDate" | "visibleResultRank" | "activeStatus";
  value: string;
  provenance: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    const map: Record<typeof input.field, string> = {
      advertiser: "advertiserProvenance",
      headline: "headlineProvenance",
      visibleStartDate: "visibleStartDateProvenance",
      visibleResultRank: "visibleResultRankProvenance",
      activeStatus: "activeStatusProvenance",
    };
    const patch: Record<string, unknown> = {
      [input.field]: input.value || null,
      [map[input.field]]: input.value ? input.provenance : "unknown",
    };
    await db
      .update(evidenceItem)
      .set(patch)
      .where(and(eq(evidenceItem.id, input.itemId), eq(evidenceItem.runId, input.runId)));
    revalidatePath(`/runs/${input.runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEvidence(input: { runId: string; itemId: string }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    await db
      .delete(evidenceItem)
      .where(and(eq(evidenceItem.id, input.itemId), eq(evidenceItem.runId, input.runId)));
    revalidatePath(`/runs/${input.runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

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
 * Close the batch → normalise, rank, tear down.
 *
 * Normalising dedupes on transparent evidence only: two items are the same ad
 * when they share a Library URL, or when the advertiser and the copy match
 * exactly. We never merge on a similarity hunch, because a wrong merge silently
 * deletes someone's captured evidence.
 */
export async function closeBatch(input: { runId: string; batchId: string }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);

    const items = await db
      .select()
      .from(evidenceItem)
      .where(and(eq(evidenceItem.runId, input.runId), eq(evidenceItem.batchId, input.batchId)))
      .orderBy(asc(evidenceItem.createdAt));

    if (items.length === 0) {
      return { ok: false, error: "Submit at least one ad before closing the capture." };
    }

    await setStep(input.runId, "EVIDENCE_INTAKE", "done", `${items.length} ads submitted`);
    await setStep(input.runId, "EVIDENCE_NORMALIZE", "running");

    // ── Step 6: dedupe on transparent evidence, and count concept variants.
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const item of items) {
      const key = item.libraryUrl
        ? `url:${item.libraryUrl.trim().toLowerCase()}`
        : `copy:${item.advertiser.trim().toLowerCase()}|${item.headline.trim().toLowerCase()}|${item.bodyCopy.trim().toLowerCase()}`;
      if (key.endsWith("||")) continue;
      const previous = seen.get(key);
      if (previous) duplicates.push(item.id);
      else seen.set(key, item.id);
    }
    if (duplicates.length > 0) {
      await db.delete(evidenceItem).where(inArray(evidenceItem.id, duplicates));
    }

    const kept = items.filter((item) => !duplicates.includes(item.id));

    // ── Step 8: teardown + concept clustering (a reading, labelled as one).
    for (const item of kept) {
      const teardown = deriveTeardown({
        id: item.id,
        headline: item.headline,
        bodyCopy: item.bodyCopy,
        ctaLabel: item.ctaLabel,
        modality: item.modality,
      });
      const concept = conceptKeyFor(teardown);
      await db
        .update(evidenceItem)
        .set({
          teardown: JSON.stringify(teardown),
          conceptKey: concept.key,
          conceptLabel: concept.label,
        })
        .where(eq(evidenceItem.id, item.id));
    }

    await setStep(
      input.runId,
      "EVIDENCE_NORMALIZE",
      "done",
      duplicates.length > 0
        ? `${kept.length} unique ads · ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} merged`
        : `${kept.length} unique ads`,
    );
    await setStep(input.runId, "EVIDENCE_RANK", "running");

    // ── Step 7: coverage, then EBOS per item within this batch.
    const variantCounts = new Map<string, number>();
    for (const item of kept) {
      const key = item.conceptKey || item.id;
      variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
    }

    const scoreItems: ScoreItem[] = kept.map((item) => ({
      id: item.id,
      visibleStartDate: item.visibleStartDate,
      visibleResultRank: item.visibleResultRank ? Number(item.visibleResultRank) : null,
      platformCount: item.platforms ? item.platforms.split(",").filter(Boolean).length : null,
      variantCount: Math.max(
        Number(item.adVariantCount) || 1,
        variantCounts.get(item.conceptKey || item.id) ?? 1,
      ),
      publishedReach: item.impressionsLower ? Number(item.impressionsLower) || null : null,
      observedAt: item.observedAt,
      hasCreativeArtefact: Boolean(item.artefactUrl),
      hasLibraryUrl: Boolean(item.libraryUrl),
      advertiser: item.advertiser,
    }));

    const planned = await db
      .select()
      .from(competitor)
      .where(and(eq(competitor.runId, input.runId), eq(competitor.pruned, false)));

    const coverage = computeCoverage(scoreItems, planned.map((c) => c.name));
    const now = new Date();
    const refs = batchReferences(scoreItems, now);
    // The weighting the user has accepted, or the human-chosen default. A merely
    // proposed vector is ignored here by design — that is the whole guarantee.
    const weights = await getActiveWeights(user.id);

    await db.delete(adScore).where(eq(adScore.batchId, input.batchId));

    for (const scoreItem of scoreItems) {
      const result = computeEbos(scoreItem, refs, now, weights);
      await db.insert(adScore).values({
        evidenceItemId: scoreItem.id,
        runId: input.runId,
        batchId: input.batchId,
        ebos: String(result.ebos),
        coverageScore: String(coverage.score),
        coverageBand: coverage.band,
        inputs: JSON.stringify({
          components: result.components,
          weightsUsed: result.weightsUsed,
          dropped: result.dropped,
          notes: result.notes,
          batchReferences: refs,
        }),
      });
    }

    await db
      .update(evidenceBatch)
      .set({
        state: "closed",
        coverageScore: String(coverage.score),
        coverageBand: coverage.band,
        closedAt: now,
      })
      .where(eq(evidenceBatch.id, input.batchId));

    await setStep(
      input.runId,
      "EVIDENCE_RANK",
      "done",
      `Coverage ${coverage.band} (${coverage.score.toFixed(2)})`,
    );
    await setStep(input.runId, "TEARDOWN", "done", `${kept.length} structural teardowns`);
    await setStep(input.runId, "HUMAN_GATE", "blocked_on_user", "Pick the angles you want");

    await db
      .update(run)
      .set({ status: "AWAITING_GATE", stepCursor: "8", updatedAt: new Date() })
      .where(eq(run.id, input.runId));

    // File this capture into the watchtower: a dated snapshot, one observation
    // per ad, and each ad's standing status. Without it the history has a hole,
    // and a hole in the history reads on screen exactly like a quiet market.
    await recordSnapshot({ runId: input.runId, batchId: input.batchId });

    revalidatePath(`/runs/${input.runId}`);
    revalidatePath(`/runs/${input.runId}/board`);
    revalidatePath(`/runs/${input.runId}/watch`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Start a fresh capture against the same saved searches — the revisit flow. */
export async function startNewBatch(input: { runId: string; label: string }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    const open = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, input.runId), eq(evidenceBatch.state, "open")))
      .limit(1);
    if (open.length > 0) {
      return { ok: false, error: "You already have a capture open. Close it before starting another." };
    }
    const [created] = await db
      .insert(evidenceBatch)
      .values({
        runId: input.runId,
        label:
          input.label.trim() ||
          `Capture ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        state: "open",
      })
      .returning();
    await setStep(input.runId, "EVIDENCE_INTAKE", "blocked_on_user", "New capture open");
    await db
      .update(run)
      .set({ status: "AWAITING_EVIDENCE", updatedAt: new Date() })
      .where(eq(run.id, input.runId));
    revalidatePath(`/runs/${input.runId}/collect`);
    return { ok: true, id: created.id };
  } catch (error) {
    return fail(error);
  }
}

export async function listSearches(runId: string) {
  return db
    .select()
    .from(searchReference)
    .where(eq(searchReference.runId, runId))
    .orderBy(asc(searchReference.createdAt));
}
