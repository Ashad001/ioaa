"use server";

/**
 * The weight re-fit's write side: propose a new weighting, accept one, decline one.
 *
 * THE GUARANTEE THIS FILE EXISTS TO KEEP. Proposing is separate from applying,
 * in different actions, behind a state column, because a scoring model that
 * retunes itself on forty noisy samples ranks garbage with total confidence and
 * leaves nothing on screen to explain it. `proposeWeightRefit` writes a row that
 * changes nothing; only `acceptWeightProposal` makes it live, and only when a
 * person clicks it.
 *
 * Every action loads the session and filters by that user's id. A weighting is a
 * per-account artefact and a proposal id from the browser is not a permission
 * check — so the row is matched on its id AND the signed-in user, always.
 */
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { weightProposal } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { getAcceptedWeights, getRefitSamples } from "@/lib/admirror/queries";
import { fitWeights, parseWeights } from "@/lib/admirror/refit";
import { EBOS_WEIGHTS } from "@/lib/admirror/scoring";

export type RefitActionResult =
  | { ok: true; state: "proposed" | "accepted" | "declined" | "not_enough"; message: string }
  | { ok: false; error: string };

function fail(error: unknown): RefitActionResult {
  return { ok: false, error: describeDataError(error, "saving").message };
}

function touch() {
  revalidatePath("/results");
  revalidatePath("/patterns");
}

/**
 * Run the fit and, if there is enough evidence, record a proposal.
 *
 * Below the threshold this deliberately writes NOTHING and returns the refusal.
 * A stored "we looked and there wasn't enough" row would only become a number on
 * screen for someone to act on, which is exactly what the threshold prevents.
 */
export async function proposeWeightRefit(): Promise<RefitActionResult> {
  try {
    const user = await requireUser();
    const samples = await getRefitSamples(user.id);
    const accepted = await getAcceptedWeights(user.id);
    const current =
      (accepted ? parseWeights(accepted.toWeights) : null) ?? { ...EBOS_WEIGHTS };

    const outcome = fitWeights(samples, current);
    if (!outcome.enough) {
      return { ok: true, state: "not_enough", message: outcome.reason };
    }

    const { proposal } = outcome;

    // Supersede any earlier undecided proposal rather than stacking two on the
    // screen: the user should only ever be asked about the current best fit.
    await db
      .update(weightProposal)
      .set({ state: "declined", decidedAt: new Date() })
      .where(and(eq(weightProposal.userId, user.id), eq(weightProposal.state, "proposed")));

    await db.insert(weightProposal).values({
      userId: user.id,
      state: "proposed",
      fromWeights: JSON.stringify(proposal.fromWeights),
      toWeights: JSON.stringify(proposal.toWeights),
      sampleSize: String(proposal.sampleSize),
      fitQuality: proposal.fitQuality,
      evidence: JSON.stringify({
        components: proposal.evidence,
        minDaysLive: proposal.minDaysLive,
        headline: proposal.headline,
        unchanged: proposal.unchanged,
      }),
      summary: proposal.summary,
    });

    touch();
    return {
      ok: true,
      state: "proposed",
      message: proposal.unchanged
        ? `AdMirror compared ${proposal.sampleSize} of your own measured ads and found nothing worth changing. That is a real answer — it's on the Results screen.`
        : `A weighting fitted to ${proposal.sampleSize} of your own measured ads is ready for you to look at. Nothing has changed yet.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Make a proposal live.
 *
 * Only one row per user may be `accepted`, so the previous one is demoted in the
 * same breath — two accepted vectors would make "which weighting is running"
 * unanswerable. Existing scores are NOT recomputed: they were computed under the
 * weighting in force at the time and each one stores the vector it used, so
 * rewriting them would falsify the record of what the user actually decided on.
 * New collections and re-sweeps pick the new weighting up.
 */
export async function acceptWeightProposal(proposalId: string): Promise<RefitActionResult> {
  try {
    const user = await requireUser();

    const [row] = await db
      .select()
      .from(weightProposal)
      .where(and(eq(weightProposal.id, proposalId), eq(weightProposal.userId, user.id)))
      .limit(1);
    if (!row) throw new Error("That weighting doesn't exist, or it isn't yours.");
    if (row.state === "accepted") {
      return { ok: true, state: "accepted", message: "That weighting is already the one in use." };
    }

    await db
      .update(weightProposal)
      .set({ state: "declined", decidedAt: new Date() })
      .where(
        and(
          eq(weightProposal.userId, user.id),
          eq(weightProposal.state, "accepted"),
          ne(weightProposal.id, proposalId),
        ),
      );

    await db
      .update(weightProposal)
      .set({ state: "accepted", decidedAt: new Date() })
      .where(and(eq(weightProposal.id, proposalId), eq(weightProposal.userId, user.id)));

    touch();
    return {
      ok: true,
      state: "accepted",
      message:
        "Your own results now set the weighting. Boards already ranked keep the weighting they were ranked under — the next collection uses this one.",
    };
  } catch (error) {
    return fail(error);
  }
}

/** Decline, keeping the row as history so the same weak fit isn't re-offered as new. */
export async function declineWeightProposal(proposalId: string): Promise<RefitActionResult> {
  try {
    const user = await requireUser();
    const [row] = await db
      .select()
      .from(weightProposal)
      .where(and(eq(weightProposal.id, proposalId), eq(weightProposal.userId, user.id)))
      .limit(1);
    if (!row) throw new Error("That weighting doesn't exist, or it isn't yours.");

    await db
      .update(weightProposal)
      .set({ state: "declined", decidedAt: new Date() })
      .where(and(eq(weightProposal.id, proposalId), eq(weightProposal.userId, user.id)));

    touch();
    return {
      ok: true,
      state: "declined",
      message: "Left as it was. AdMirror keeps ranking on the weighting you already had.",
    };
  } catch (error) {
    return fail(error);
  }
}

/** Go back to the weighting AdMirror shipped with, from a user's own decision. */
export async function revertToDefaultWeights(): Promise<RefitActionResult> {
  try {
    const user = await requireUser();
    await db
      .update(weightProposal)
      .set({ state: "declined", decidedAt: new Date() })
      .where(and(eq(weightProposal.userId, user.id), eq(weightProposal.state, "accepted")));

    touch();
    return {
      ok: true,
      state: "declined",
      message: "Back to AdMirror's own weighting. Your results are still on file if you want to fit it again.",
    };
  } catch (error) {
    return fail(error);
  }
}
