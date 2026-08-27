import "server-only";

/**
 * Recording a sweep into the watchtower.
 *
 * Called once, at the moment a capture closes — from the manual close and from
 * the autopilot alike, so a run cannot have a ranked board with no history behind
 * it. Everything here is idempotent on the batch: closing the same batch twice
 * updates the same snapshot rather than inventing a second look at the market.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  adObservation,
  adScore,
  adStatus,
  competitor,
  evidenceBatch,
  evidenceItem,
  periodBriefing,
  searchReference,
  snapshot,
  watchTarget,
} from "@/db/schema";
import {
  adIdentity,
  assetHashOf,
  comparableHashOf,
  computeWatchtowerDiff,
  copyHashOf,
  declaredFiltersFor,
  deriveStatus,
  shouldSendDigest,
  writeBriefing,
  type AdStatusState,
  type DeclaredFilters,
  type SnapshotSide,
} from "./watchtower";

function parseFilters(raw: string): DeclaredFilters {
  try {
    const parsed = JSON.parse(raw) as Partial<DeclaredFilters>;
    return {
      searchIds: parsed.searchIds ?? [],
      countries: parsed.countries ?? [],
      languages: parsed.languages ?? [],
      mediaTypes: parsed.mediaTypes ?? [],
      activeStatuses: parsed.activeStatuses ?? [],
    };
  } catch {
    return { searchIds: [], countries: [], languages: [], mediaTypes: [], activeStatuses: [] };
  }
}

function sideOf(row: typeof snapshot.$inferSelect): SnapshotSide {
  return {
    id: row.id,
    label: row.label,
    capturedAt: row.capturedAt,
    itemCount: Number(row.itemCount) || 0,
    coverageScore: row.coverageScore === null ? null : Number(row.coverageScore),
    coverageBand: row.coverageBand,
    comparableHash: row.comparableHash,
    filters: parseFilters(row.declaredFilters),
  };
}

/**
 * File a closed capture as a snapshot, advance every ad's status, and write the
 * period briefing.
 *
 * Returns the briefing id so the caller can point the user at it. Never throws
 * into the close path: a run whose board is ready must not fail to open because
 * its history could not be filed.
 */
export async function recordSnapshot(input: {
  runId: string;
  batchId: string;
}): Promise<{ snapshotId: string; briefingId: string | null } | null> {
  try {
    const [batch] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.id, input.batchId), eq(evidenceBatch.runId, input.runId)))
      .limit(1);
    if (!batch) return null;

    const [items, searches, mapped, priorSnapshots, scores] = await Promise.all([
      db
        .select()
        .from(evidenceItem)
        .where(and(eq(evidenceItem.runId, input.runId), eq(evidenceItem.batchId, input.batchId)))
        .orderBy(asc(evidenceItem.createdAt)),
      db.select().from(searchReference).where(eq(searchReference.runId, input.runId)),
      db
        .select()
        .from(competitor)
        .where(and(eq(competitor.runId, input.runId), eq(competitor.pruned, false))),
      db
        .select()
        .from(snapshot)
        .where(eq(snapshot.runId, input.runId))
        .orderBy(desc(snapshot.capturedAt)),
      db.select().from(adScore).where(eq(adScore.batchId, input.batchId)),
    ]);

    const filters = declaredFiltersFor({ items, searches });
    const hash = comparableHashOf(filters);
    const capturedAt = batch.closedAt ?? new Date();

    const existing = priorSnapshots.find((row) => row.batchId === input.batchId) ?? null;
    const previous = priorSnapshots.filter((row) => row.batchId !== input.batchId);
    const ordinal = existing ? Number(existing.ordinal) : previous.length + 1;

    const values = {
      runId: input.runId,
      batchId: input.batchId,
      label: batch.label,
      capturedAt,
      itemCount: String(items.length),
      coverageScore: batch.coverageScore,
      coverageBand: batch.coverageBand,
      comparableHash: hash,
      declaredFilters: JSON.stringify(filters),
      ordinal: String(ordinal),
    };

    let snapshotId: string;
    if (existing) {
      await db.update(snapshot).set(values).where(eq(snapshot.id, existing.id));
      snapshotId = existing.id;
    } else {
      const [created] = await db.insert(snapshot).values(values).returning();
      snapshotId = created.id;
    }

    const newer: SnapshotSide = {
      id: snapshotId,
      label: batch.label,
      capturedAt,
      itemCount: items.length,
      coverageScore: batch.coverageScore === null ? null : Number(batch.coverageScore),
      coverageBand: batch.coverageBand,
      comparableHash: hash,
      filters,
    };

    /* ── the previous snapshot, and the ads it held ── */
    const olderRow = previous[0] ?? null;
    const older = olderRow ? sideOf(olderRow) : null;
    const olderItems = olderRow
      ? await db
          .select()
          .from(evidenceItem)
          .where(
            and(eq(evidenceItem.runId, input.runId), eq(evidenceItem.batchId, olderRow.batchId)),
          )
          .orderBy(asc(evidenceItem.createdAt))
      : [];

    const diff = computeWatchtowerDiff({
      older,
      newer,
      olderItems,
      newerItems: items,
      mappedAdvertisers: mapped.map((row) => row.name),
    });

    /* ── observations: one row per ad seen in this snapshot ── */
    const rankByItem = new Map(
      [...scores]
        .sort((a, b) => Number(b.ebos) - Number(a.ebos))
        .map((score, index) => [score.evidenceItemId, index + 1]),
    );

    const conceptCounts = new Map<string, number>();
    for (const item of items) {
      const key = item.conceptKey || item.id;
      conceptCounts.set(key, (conceptCounts.get(key) ?? 0) + 1);
    }

    await db.delete(adObservation).where(eq(adObservation.snapshotId, snapshotId));

    const seenKeys = new Set<string>();
    for (const item of items) {
      const { adKey, matchRule } = adIdentity(item);
      if (seenKeys.has(adKey)) continue;
      seenKeys.add(adKey);
      await db.insert(adObservation).values({
        runId: input.runId,
        snapshotId,
        adKey,
        evidenceItemId: item.id,
        observed: true,
        advertiser: item.advertiser,
        headline: item.headline,
        conceptKey: item.conceptKey ?? "",
        conceptLabel: item.conceptLabel ?? "",
        variantCount: String(conceptCounts.get(item.conceptKey || item.id) ?? 1),
        copyHash: copyHashOf(item),
        assetHash: assetHashOf(item),
        matchRule: diff.matchRules[adKey] ?? matchRule,
      });
    }

    /* ── absences: recorded as rows, so history is a record and not a guess ── */
    for (const item of olderItems) {
      const { adKey } = adIdentity(item);
      if (seenKeys.has(adKey)) continue;
      seenKeys.add(adKey);
      await db.insert(adObservation).values({
        runId: input.runId,
        snapshotId,
        adKey,
        evidenceItemId: null,
        observed: false,
        advertiser: item.advertiser,
        headline: item.headline,
        conceptKey: item.conceptKey ?? "",
        conceptLabel: item.conceptLabel ?? "",
        variantCount: "0",
        copyHash: copyHashOf(item),
        assetHash: assetHashOf(item),
        matchRule: diff.matchRules[adKey] ?? "advertiser_and_headline",
      });
    }

    /* ── statuses: the counter that must not move on a non-comparable sweep ── */
    const statuses = await db
      .select()
      .from(adStatus)
      .where(eq(adStatus.runId, input.runId));
    const statusByKey = new Map(statuses.map((row) => [row.adKey, row]));

    const observedNow = new Map(
      items.map((item) => [adIdentity(item).adKey, item] as const),
    );

    const touched = new Set<string>([...observedNow.keys(), ...statusByKey.keys()]);
    for (const item of olderItems) touched.add(adIdentity(item).adKey);

    for (const adKey of touched) {
      const row = statusByKey.get(adKey) ?? null;
      const item = observedNow.get(adKey) ?? null;
      const observed = Boolean(item);

      // A key with no history and no sighting now is nothing to record.
      if (!row && !observed && !olderItems.some((old) => adIdentity(old).adKey === adKey)) {
        continue;
      }

      const derived = deriveStatus({
        previousAbsences: Number(row?.consecutiveAbsences ?? "0") || 0,
        previousState: (row?.state ?? "observed") as AdStatusState,
        observed,
        comparable: diff.comparable,
      });

      const reference =
        item ?? olderItems.find((old) => adIdentity(old).adKey === adKey) ?? null;

      const basis = {
        rule: derived.movedBy,
        comparable: diff.comparable,
        comparabilityNote: diff.comparabilityNote,
        snapshots: [
          older
            ? {
                id: older.id,
                label: older.label,
                capturedAt: older.capturedAt?.toISOString() ?? null,
                comparableHash: older.comparableHash,
              }
            : null,
          {
            id: newer.id,
            label: newer.label,
            capturedAt: capturedAt.toISOString(),
            comparableHash: hash,
          },
        ].filter(Boolean),
      };

      const latestRank = item ? rankByItem.get(item.id) ?? null : null;

      if (row) {
        await db
          .update(adStatus)
          .set({
            advertiser: reference?.advertiser ?? row.advertiser,
            headline: reference?.headline ?? row.headline,
            firstObservedAt: row.firstObservedAt ?? (observed ? capturedAt : null),
            lastObservedAt: observed ? capturedAt : row.lastObservedAt,
            consecutiveAbsences: String(derived.consecutiveAbsences),
            state: derived.state,
            basis: JSON.stringify(basis),
            // Movement is only meaningful against a COMPARABLE prior sweep.
            previousRank: diff.comparable ? row.latestRank : null,
            latestRank: latestRank === null ? null : String(latestRank),
            updatedAt: new Date(),
          })
          .where(eq(adStatus.id, row.id));
      } else {
        await db.insert(adStatus).values({
          runId: input.runId,
          adKey,
          advertiser: reference?.advertiser ?? "",
          headline: reference?.headline ?? "",
          firstObservedAt: observed ? capturedAt : null,
          lastObservedAt: observed ? capturedAt : null,
          consecutiveAbsences: String(derived.consecutiveAbsences),
          state: derived.state,
          basis: JSON.stringify(basis),
          previousRank: null,
          latestRank: latestRank === null ? null : String(latestRank),
        });
      }
    }

    /* ── the briefing ── */
    const contributors = new Set(
      items.map((item) => item.advertiser.trim().toLowerCase()).filter(Boolean),
    );
    const missingAdvertisers = mapped
      .map((row) => row.name)
      .filter((name) => name && !contributors.has(name.trim().toLowerCase()));

    const briefing = writeBriefing({ diff, older, newer, missingAdvertisers });
    const digest = shouldSendDigest(briefing);

    await db
      .delete(periodBriefing)
      .where(eq(periodBriefing.toSnapshotId, snapshotId));

    const [writtenBriefing] = await db
      .insert(periodBriefing)
      .values({
        runId: input.runId,
        fromSnapshotId: older?.id ?? null,
        toSnapshotId: snapshotId,
        comparable: briefing.comparable,
        comparabilityNote: briefing.comparabilityNote,
        coverageNote: briefing.coverageNote,
        headline: briefing.headline,
        verdict: briefing.verdict,
        developments: JSON.stringify(briefing.developments),
        signals: JSON.stringify(diff.signals),
        actions: JSON.stringify(briefing.actions),
        captureSuggestions: JSON.stringify(briefing.captureSuggestions),
        limitations: briefing.limitations,
        digestSent: false,
        digestSkippedReason: digest.send ? null : digest.reason,
      })
      .returning();

    /* ── the standing watch: schedule the next look ── */
    const [watch] = await db
      .select()
      .from(watchTarget)
      .where(eq(watchTarget.runId, input.runId))
      .limit(1);
    if (watch) {
      const cadence = Number(watch.cadenceDays) || 14;
      await db
        .update(watchTarget)
        .set({
          lastSnapshotId: snapshotId,
          lastLookedAt: capturedAt,
          nextReminderAt: new Date(capturedAt.getTime() + cadence * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(watchTarget.id, watch.id));
    }

    return { snapshotId, briefingId: writtenBriefing?.id ?? null };
  } catch (error) {
    // History is valuable, but never worth blocking a finished board over.
    console.error("[watchtower] could not file the snapshot", error);
    return null;
  }
}
