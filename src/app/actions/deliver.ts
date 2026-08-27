"use server";

/**
 * The export actions.
 *
 * Both build their text on the server from the signed-in user's own rows — the
 * client receives a finished string and saves it. There is no route to call and
 * nothing is fetched.
 */
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { evidenceBatch, run } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { buildBrief, buildCsv } from "@/lib/admirror/deliver";
import { getItems, getVariants } from "@/lib/admirror/queries";

export type ExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string };

async function load(runId: string) {
  const user = await requireUser();
  const [current] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, user.id)))
    .limit(1);
  if (!current) return null;

  const [variants, items, batches] = await Promise.all([
    getVariants(runId),
    getItems(runId),
    db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "closed")))
      .orderBy(asc(evidenceBatch.closedAt)),
  ]);

  return { run: current, variants, items, batch: batches[0] ?? null };
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "run";
}

export async function exportBrief(runId: string): Promise<ExportResult> {
  try {
    const data = await load(runId);
    if (!data) return { ok: false, error: "That run doesn't exist, or it isn't yours." };
    if (data.variants.length === 0) {
      return { ok: false, error: "There's nothing to hand over yet — generate the variants first." };
    }
    return {
      ok: true,
      filename: `${slug(data.run.brandName)}-creative-brief.txt`,
      content: buildBrief(data),
    };
  } catch (error) {
    return { ok: false, error: describeDataError(error, "loading").message };
  }
}

export async function exportSheet(runId: string): Promise<ExportResult> {
  try {
    const data = await load(runId);
    if (!data) return { ok: false, error: "That run doesn't exist, or it isn't yours." };
    if (data.variants.length === 0) {
      return { ok: false, error: "There's nothing to hand over yet — generate the variants first." };
    }
    return {
      ok: true,
      filename: `${slug(data.run.brandName)}-creative-matrix.csv`,
      content: buildCsv(data),
    };
  } catch (error) {
    return { ok: false, error: describeDataError(error, "loading").message };
  }
}
