import "server-only";

/**
 * Read-side queries. Every one takes the signed-in user's id and filters by it —
 * a query without that filter returns everybody's rows and type-checks fine.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accountBaseline,
  adObservation,
  adScore,
  adStatus,
  competitor,
  creativeVariant,
  evidenceBatch,
  evidenceItem,
  gateDecision,
  hookPattern,
  ownAd,
  periodBriefing,
  run,
  runStep,
  searchReference,
  shippedAd,
  shippedResult,
  snapshot,
  watchTarget,
  weightProposal,
} from "@/db/schema";
import {
  NO_BASELINE,
  baselineFromOwnAds,
  deriveRates,
  indexAgainst,
  num,
  statedBaseline,
  toReading,
  type ReportedReading,
} from "@/lib/admirror/outcome";
import { parseWeights, type RefitSample } from "@/lib/admirror/refit";
import { EBOS_WEIGHTS, type EbosComponent, type EbosWeights } from "@/lib/admirror/scoring";

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


/* ─────────────────────────── the watchtower ─────────────────────────── */

/** Every dated sweep of a run, newest first. */
export async function getSnapshots(runId: string) {
  return db
    .select()
    .from(snapshot)
    .where(eq(snapshot.runId, runId))
    .orderBy(desc(snapshot.capturedAt));
}

/** Each ad's standing status across every sweep of the run. */
export async function getAdStatuses(runId: string) {
  return db
    .select()
    .from(adStatus)
    .where(eq(adStatus.runId, runId))
    .orderBy(desc(adStatus.updatedAt));
}

/** One sweep's observations — what was read, and what was missed. */
export async function getObservations(runId: string, snapshotId: string) {
  return db
    .select()
    .from(adObservation)
    .where(and(eq(adObservation.runId, runId), eq(adObservation.snapshotId, snapshotId)))
    .orderBy(asc(adObservation.advertiser));
}

/** The period briefings, newest first. */
export async function getBriefings(runId: string) {
  return db
    .select()
    .from(periodBriefing)
    .where(eq(periodBriefing.runId, runId))
    .orderBy(desc(periodBriefing.createdAt));
}

export async function getWatch(runId: string) {
  const [row] = await db
    .select()
    .from(watchTarget)
    .where(eq(watchTarget.runId, runId))
    .limit(1);
  return row ?? null;
}

/** Every standing watch belonging to one person — the watchtower index. */
export async function listWatchesForUser(userId: string) {
  return db
    .select({
      watch: watchTarget,
      run,
    })
    .from(watchTarget)
    .innerJoin(run, eq(watchTarget.runId, run.id))
    .where(eq(watchTarget.userId, userId))
    .orderBy(asc(watchTarget.nextReminderAt));
}

export type SnapshotRow = Awaited<ReturnType<typeof getSnapshots>>[number];
export type AdStatusRow = Awaited<ReturnType<typeof getAdStatuses>>[number];
export type ObservationRow = Awaited<ReturnType<typeof getObservations>>[number];
export type BriefingRow = Awaited<ReturnType<typeof getBriefings>>[number];
export type WatchRow = NonNullable<Awaited<ReturnType<typeof getWatch>>>;

/* ── The closed loop ──────────────────────────────────────────────────────────
 * These read the user's OWN measured data. Every one filters on `userId` and not
 * merely on a run or record id: an id came from the browser and is not a
 * permission check. The own-brand tables are separate from the evidence tables by
 * design, so none of these can leak a measured figure onto a competitor card.
 * ────────────────────────────────────────────────────────────────────────────── */

/** Every ad this person has shipped, newest first, with its latest reading. */
export async function listShippedForUser(userId: string) {
  const ads = await db
    .select({ ad: shippedAd, run })
    .from(shippedAd)
    .innerJoin(run, eq(shippedAd.runId, run.id))
    .where(eq(shippedAd.userId, userId))
    .orderBy(desc(shippedAd.createdAt));

  if (ads.length === 0) return [];

  const readings = await db
    .select()
    .from(shippedResult)
    .where(eq(shippedResult.userId, userId))
    .orderBy(desc(shippedResult.readOn));

  const byAd = new Map<string, typeof readings>();
  for (const row of readings) {
    const list = byAd.get(row.shippedAdId);
    if (list) list.push(row);
    else byAd.set(row.shippedAdId, [row]);
  }

  return ads.map(({ ad, run: runRow }) => {
    const history = byAd.get(ad.id) ?? [];
    return { ad, run: runRow, latest: history[0] ?? null, history };
  });
}

/** The shipped ads belonging to ONE run — the deliver screen's own list. */
export async function getShippedForRun(runId: string, userId: string) {
  return db
    .select()
    .from(shippedAd)
    .where(and(eq(shippedAd.runId, runId), eq(shippedAd.userId, userId)))
    .orderBy(desc(shippedAd.createdAt));
}

export async function getShippedAd(shippedAdId: string, userId: string) {
  const [row] = await db
    .select()
    .from(shippedAd)
    .where(and(eq(shippedAd.id, shippedAdId), eq(shippedAd.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getResultsForAd(shippedAdId: string, userId: string) {
  return db
    .select()
    .from(shippedResult)
    .where(
      and(eq(shippedResult.shippedAdId, shippedAdId), eq(shippedResult.userId, userId)),
    )
    .orderBy(desc(shippedResult.readOn));
}

export async function getBaseline(userId: string) {
  const [row] = await db
    .select()
    .from(accountBaseline)
    .where(eq(accountBaseline.userId, userId))
    .limit(1);
  return row ?? null;
}

/** The user's own ads pinned to a run's board — the "You" row. */
export async function getOwnAds(runId: string, userId: string) {
  return db
    .select()
    .from(ownAd)
    .where(and(eq(ownAd.runId, runId), eq(ownAd.userId, userId)))
    .orderBy(desc(ownAd.createdAt));
}

export async function getPatterns(userId: string) {
  return db
    .select()
    .from(hookPattern)
    .where(eq(hookPattern.userId, userId))
    .orderBy(desc(hookPattern.measuredCount));
}

export type ShippedRow = Awaited<ReturnType<typeof getShippedForRun>>[number];
export type ShippedWithRun = Awaited<ReturnType<typeof listShippedForUser>>[number];
export type ResultRow = Awaited<ReturnType<typeof getResultsForAd>>[number];
export type BaselineRow = NonNullable<Awaited<ReturnType<typeof getBaseline>>>;
export type OwnAdRow = Awaited<ReturnType<typeof getOwnAds>>[number];
export type PatternRow = Awaited<ReturnType<typeof getPatterns>>[number];

/* ── The weight re-fit ─────────────────────────────────────────────────────
 * Reading the vector the ranking actually runs on, and gathering the samples a
 * new one could be fitted from. Both filter on the user's own id: a weighting
 * belongs to one account, and a proposal is built only from that account's ads.
 * ────────────────────────────────────────────────────────────────────────── */

/** The accepted proposal, if any. Only one row per user is ever accepted. */
export async function getAcceptedWeights(userId: string) {
  const [row] = await db
    .select()
    .from(weightProposal)
    .where(and(eq(weightProposal.userId, userId), eq(weightProposal.state, "accepted")))
    .orderBy(desc(weightProposal.decidedAt))
    .limit(1);
  return row ?? null;
}

/** The newest still-undecided proposal — inert until the user accepts it. */
export async function getOpenProposal(userId: string) {
  const [row] = await db
    .select()
    .from(weightProposal)
    .where(and(eq(weightProposal.userId, userId), eq(weightProposal.state, "proposed")))
    .orderBy(desc(weightProposal.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * The vector the ranking runs on RIGHT NOW.
 *
 * Deliberately ignores anything in the `proposed` state. A proposal that could
 * change scoring before the user accepted it would make the whole
 * propose-never-apply guarantee a lie. With nothing accepted — or with a stored
 * vector that will not parse — this returns the human-chosen default.
 */
export async function getActiveWeights(userId: string): Promise<EbosWeights> {
  const accepted = await getAcceptedWeights(userId);
  if (!accepted) return { ...EBOS_WEIGHTS };
  return parseWeights(accepted.toWeights) ?? { ...EBOS_WEIGHTS };
}

/**
 * Every shipped ad that could vote in a re-fit, with its source angle's component
 * values and the user's own indexed cost per result.
 *
 * The component values come from the score row stored at collection time, not
 * from recomputing now: the user chose that angle under those numbers, and a
 * fresh computation would fit against a score nobody ever saw. An ad with no
 * traceable source angle cannot vote — there is nothing to correlate it with.
 */
export async function getRefitSamples(userId: string): Promise<RefitSample[]> {
  const ads = await db
    .select({ ad: shippedAd, run })
    .from(shippedAd)
    .innerJoin(run, eq(shippedAd.runId, run.id))
    .where(eq(shippedAd.userId, userId));

  const traceable = ads.filter(({ ad }) => Boolean(ad.sourceItemId));
  if (traceable.length === 0) return [];

  const readings = await db
    .select()
    .from(shippedResult)
    .where(eq(shippedResult.userId, userId))
    .orderBy(desc(shippedResult.readOn));

  const latestByAd = new Map<string, (typeof readings)[number]>();
  for (const row of readings) {
    if (!latestByAd.has(row.shippedAdId)) latestByAd.set(row.shippedAdId, row);
  }

  const scores = await db
    .select({ evidenceItemId: adScore.evidenceItemId, inputs: adScore.inputs })
    .from(adScore)
    .innerJoin(run, eq(adScore.runId, run.id))
    .where(eq(run.userId, userId));

  const componentsByItem = new Map<string, Partial<Record<EbosComponent, number>>>();
  for (const row of scores) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.inputs);
    } catch {
      parsed = null;
    }
    const components =
      parsed && typeof parsed === "object" && "components" in parsed
        ? (parsed as { components?: Partial<Record<EbosComponent, number>> }).components
        : undefined;
    if (components) componentsByItem.set(row.evidenceItemId, components);
  }

  // The baseline decision is made once for the whole fit, exactly as the results
  // screen makes it, so a cost index here means the same thing it means there.
  const statedRow =
    (
      await db
        .select()
        .from(accountBaseline)
        .where(eq(accountBaseline.userId, userId))
        .limit(1)
    )[0] ?? null;

  const allReadings: ReportedReading[] = [...latestByAd.values()].map(toReading);
  const baseline = statedBaseline(statedRow) ?? baselineFromOwnAds(allReadings) ?? NO_BASELINE;

  const samples: RefitSample[] = [];
  for (const { ad, run: runRow } of traceable) {
    const components = ad.sourceItemId ? componentsByItem.get(ad.sourceItemId) : undefined;
    if (!components) continue;
    const reading = latestByAd.get(ad.id);
    const rates = reading ? deriveRates(toReading(reading)) : null;
    samples.push({
      shippedAdId: ad.id,
      label: ad.label || `${runRow.brandName} — ${ad.hookMechanism}`,
      components,
      costIndex: rates
        ? indexAgainst(rates.costPerResult, baseline.costPerResult, { lowerIsBetter: true })
        : null,
      daysLive: reading ? num(reading.daysLive) : null,
      measured: Boolean(reading && num(reading.impressions) !== null),
    });
  }
  return samples;
}

export type WeightProposalRow = NonNullable<Awaited<ReturnType<typeof getOpenProposal>>>;
