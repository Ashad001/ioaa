import "server-only";

/**
 * Read-side queries. Every one takes the signed-in user's id and filters by it —
 * a query without that filter returns everybody's rows and type-checks fine.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  adScore,
  competitor,
  creativeVariant,
  evidenceBatch,
  evidenceItem,
  gateDecision,
  run,
  runStep,
  searchReference,
} from "@/db/schema";

export async function getRun(runId: string, userId: string) {
  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getSteps(runId: string) {
  const rows = await db.select().from(runStep).where(eq(runStep.runId, runId));
  return rows.sort((a, b) => Number(a.stepNumber) - Number(b.stepNumber));
}

export async function getCompetitors(runId: string) {
  return db.select().from(competitor).where(eq(competitor.runId, runId));
}

export async function getSearches(runId: string) {
  return db
    .select()
    .from(searchReference)
    .where(eq(searchReference.runId, runId))
    .orderBy(asc(searchReference.createdAt));
}

export async function getBatches(runId: string) {
  return db
    .select()
    .from(evidenceBatch)
    .where(eq(evidenceBatch.runId, runId))
    .orderBy(desc(evidenceBatch.createdAt));
}

export async function getOpenBatch(runId: string) {
  const [row] = await db
    .select()
    .from(evidenceBatch)
    .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
    .limit(1);
  return row ?? null;
}

export async function getItems(runId: string, batchId?: string) {
  const where = batchId
    ? and(eq(evidenceItem.runId, runId), eq(evidenceItem.batchId, batchId))
    : eq(evidenceItem.runId, runId);
  return db.select().from(evidenceItem).where(where).orderBy(asc(evidenceItem.createdAt));
}

export async function getScores(runId: string) {
  return db.select().from(adScore).where(eq(adScore.runId, runId));
}

export async function getVariants(runId: string) {
  return db
    .select()
    .from(creativeVariant)
    .where(eq(creativeVariant.runId, runId))
    .orderBy(asc(creativeVariant.createdAt));
}

export async function getGate(runId: string) {
  const [row] = await db
    .select()
    .from(gateDecision)
    .where(eq(gateDecision.runId, runId))
    .orderBy(desc(gateDecision.decidedAt))
    .limit(1);
  return row ?? null;
}

export async function listRunsForUser(userId: string) {
  return db.select().from(run).where(eq(run.userId, userId)).orderBy(desc(run.updatedAt));
}

export type EvidenceRow = Awaited<ReturnType<typeof getItems>>[number];
export type ScoreRow = Awaited<ReturnType<typeof getScores>>[number];
export type StepRow = Awaited<ReturnType<typeof getSteps>>[number];
export type SearchRow = Awaited<ReturnType<typeof getSearches>>[number];
export type BatchRow = Awaited<ReturnType<typeof getBatches>>[number];
export type CompetitorRow = Awaited<ReturnType<typeof getCompetitors>>[number];
export type VariantRow = Awaited<ReturnType<typeof getVariants>>[number];
export type RunRow = NonNullable<Awaited<ReturnType<typeof getRun>>>;
