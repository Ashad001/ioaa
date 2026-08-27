"use server";

/**
 * Step 9 (the human gate) and steps 10–15 (generation).
 *
 * `force` proceeds past WARNINGS — thin coverage, a partial view. It never
 * bypasses a BLOCK: a similarity failure or an unsubstantiated claim stops the
 * variant, and the UI says which. That asymmetry is the point of the gate.
 *
 * The matrix the user picks at the gate is priced BEFORE they commit and stored
 * with the decision, so the run record shows what was asked for as well as what
 * came out.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { adScore, creativeVariant, evidenceBatch, evidenceItem, gateDecision, run, runStep } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { angleTransfer, buildTestPlan, buildVariants, runGates, FORMAT_LABELS } from "@/lib/admirror/generate";
import {
  buildRoundedPlan,
  DEFAULT_MATRIX,
  MATRIX_CAP,
  priceMatrix,
  type MatrixChoice,
} from "@/lib/admirror/matrix";
import { deriveDossier, type Dossier } from "@/lib/admirror/pipeline";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  return { ok: false, error: describeDataError(error, "saving").message };
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

export async function forceGeneration(input: {
  runId: string;
  selectedItemIds: string[];
  force: boolean;
  matrix?: MatrixChoice;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [current] = await db
      .select()
      .from(run)
      .where(and(eq(run.id, input.runId), eq(run.userId, user.id)))
      .limit(1);
    if (!current) return { ok: false, error: "That run doesn't exist, or it isn't yours." };

    if (input.selectedItemIds.length === 0) {
      return { ok: false, error: "Tick at least one angle before generating." };
    }

    const matrix: MatrixChoice = input.matrix ?? DEFAULT_MATRIX;
    const cost = priceMatrix(matrix, input.selectedItemIds.length);
    if (cost.overCap) {
      return {
        ok: false,
        error: `That comes to ${cost.total} assets and the cap is ${MATRIX_CAP} per press. Drop an angle or turn off the contrasting format.`,
      };
    }

    const selected = await db
      .select()
      .from(evidenceItem)
      .where(
        and(eq(evidenceItem.runId, input.runId), inArray(evidenceItem.id, input.selectedItemIds)),
      );
    if (selected.length === 0) {
      return { ok: false, error: "Those angles are no longer in this run." };
    }

    const [batch] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, input.runId), eq(evidenceBatch.state, "closed")))
      .orderBy(asc(evidenceBatch.closedAt))
      .limit(1);

    const coverageScore = batch?.coverageScore ?? "0";
    const coverageBand = batch?.coverageBand ?? "thin";

    // Thin coverage is a WARNING. The user may proceed; we record that they did,
    // and every downstream screen says the angle came from a partial view.
    if (coverageBand === "thin" && !input.force) {
      return {
        ok: false,
        error:
          "Coverage is thin. You can still proceed — tick “Generate anyway” and AdMirror will record that this angle came from a partial view.",
      };
    }

    await db.insert(gateDecision).values({
      runId: input.runId,
      selectedItemIds: input.selectedItemIds.join(","),
      coverageAtGate: coverageScore,
      coverageBandAtGate: coverageBand,
      forced: input.force,
      matrix: JSON.stringify({ choice: matrix, cost }),
    });

    await setStep(input.runId, "HUMAN_GATE", "done", `${selected.length} angle${selected.length === 1 ? "" : "s"} selected`);
    await db
      .update(run)
      .set({ status: "GENERATING", stepCursor: "9", updatedAt: new Date() })
      .where(eq(run.id, input.runId));

    const dossier: Dossier = current.dossier
      ? (JSON.parse(current.dossier) as Dossier)
      : deriveDossier({
          brandName: current.brandName,
          brandWebsite: current.brandWebsite,
          marketLabel: current.marketLabel,
          objectives: current.objectives.split(",").filter(Boolean),
        });

    await db.delete(creativeVariant).where(eq(creativeVariant.runId, input.runId));

    for (const step of ["ANGLE_TRANSFER", "SCRIPT", "FIRST_FRAME", "MOTION", "POST"]) {
      await setStep(input.runId, step, "running");
    }

    const formats: ("primary" | "contrast")[] = matrix.contrastFormat
      ? ["primary", "contrast"]
      : ["primary"];
    const objective = current.objectives.split(",").filter(Boolean)[0] ?? "Direct response";

    let generated = 0;
    let blocked = 0;
    let statics = 0;

    for (const item of selected) {
      const { brief } = angleTransfer({
        itemId: item.id,
        headline: item.headline,
        bodyCopy: item.bodyCopy,
        ctaLabel: item.ctaLabel,
        modality: item.modality,
        brandName: current.brandName,
        marketLabel: current.marketLabel,
        voice: dossier.voice,
      });

      const cells = formats.flatMap((formatAxis) =>
        buildVariants({
          brief,
          brandName: current.brandName,
          marketLabel: current.marketLabel,
          ctaLabel: item.ctaLabel,
          formatAxis,
          includeStatics: matrix.includeStatics,
          includeCopyVariants: matrix.includeCopyVariants,
        }),
      );

      const motionCells = cells.filter((cell) => cell.assetKind === "video");
      const testPlan = buildTestPlan({ brief, variants: cells });
      const roundedPlan = buildRoundedPlan({
        hookLabels: motionCells
          .filter((cell) => cell.formatAxis === "primary")
          .map((cell) => cell.hookLabel),
        formatLabels: formats.map((axis) => FORMAT_LABELS[axis]),
        angle: brief.angle,
        objective,
        hasCostData: false,
      });

      const sourceCopy = `${item.headline} ${item.bodyCopy}`.trim();

      for (const variant of cells) {
        const gates = runGates({
          generated: `${variant.hookLine} ${variant.primaryText}`,
          sourceCopy,
          brandName: current.brandName,
          destination: current.brandWebsite,
        });
        const isBlocked = gates.some((gate) => gate.state === "block");
        if (isBlocked) blocked += 1;
        else if (variant.assetKind === "static") statics += 1;
        else generated += 1;

        await db.insert(creativeVariant).values({
          runId: input.runId,
          sourceItemId: item.id,
          variantIndex: String(variant.index),
          hookLabel: variant.hookLabel,
          hookLine: variant.hookLine,
          script: JSON.stringify(variant.script),
          firstFramePrompt: variant.firstFramePrompt,
          motionPrompt: variant.motionPrompt,
          primaryText: variant.primaryText,
          headline: variant.headline,
          ctaLabel: variant.ctaLabel,
          assetKind: variant.assetKind,
          formatAxis: variant.formatAxis,
          sharedBodyKey: variant.sharedBodyKey,
          altCopy: JSON.stringify(variant.altCopy),
          gates: JSON.stringify({
            results: gates,
            testPlan,
            roundedPlan,
            angleBrief: brief,
            matrix: { choice: matrix, cost },
          }),
          state: isBlocked ? "blocked" : "ready",
          testRole: variant.testRole,
        });
      }
    }

    await setStep(input.runId, "ANGLE_TRANSFER", "done", "Their angle, rewritten as your brief");
    await setStep(input.runId, "SCRIPT", "done", "Hook, beats and on-screen text written");
    await setStep(input.runId, "FIRST_FRAME", "done", "Opening-frame brief ready to render");
    await setStep(
      input.runId,
      "MOTION",
      "done",
      statics > 0
        ? `${generated} motion brief${generated === 1 ? "" : "s"} · ${statics} static${statics === 1 ? "" : "s"} from the same frames`
        : "Motion brief ready to render",
    );
    await setStep(
      input.runId,
      "POST",
      "done",
      blocked > 0 ? `${generated + statics} cleared · ${blocked} held by a gate` : `${generated + statics} cleared every gate`,
    );
    await setStep(
      input.runId,
      "DELIVER",
      "done",
      `${generated + statics} asset${generated + statics === 1 ? "" : "s"}, a test plan and a provenance record`,
    );

    await db
      .update(run)
      .set({ status: "DELIVERED", stepCursor: "15", updatedAt: new Date() })
      .where(eq(run.id, input.runId));

    revalidatePath(`/runs/${input.runId}`);
    revalidatePath(`/runs/${input.runId}/creative`);
    revalidatePath(`/runs/${input.runId}/deliver`);
    revalidatePath("/library");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function loadScores(runId: string) {
  return db.select().from(adScore).where(eq(adScore.runId, runId));
}
