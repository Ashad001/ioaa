import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Telescope } from "lucide-react";

import { EvidenceBoard, type BoardHistory } from "@/components/board/evidence-board";
import { OwnRow, type OwnRowData } from "@/components/board/own-row";
import { RunNav } from "@/components/run/run-nav";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { computeCoverage, type ScoreItem } from "@/lib/admirror/scoring";
import {
  adIdentity,
  type AdStatusState,
  type MatchRule,
} from "@/lib/admirror/watchtower";
import {
  getAdStatuses,
  getBatches,
  getCompetitors,
  getItems,
  getObservations,
  getOwnAds,
  getRun,
  getScores,
  getSnapshots,
  getSteps,
  getVariants,
} from "@/lib/admirror/queries";

type Basis = {
  rule?: string;
  comparable?: boolean;
  snapshots?: { id: string; label: string; capturedAt: string | null }[];
};

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/start");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, batches, competitors, scores, variants, statuses, snapshots, ownAds] =
    await Promise.all([
      getSteps(id),
      getBatches(id),
      getCompetitors(id),
      getScores(id),
      getVariants(id),
      getAdStatuses(id),
      getSnapshots(id),
      getOwnAds(id, user.id),
    ]);

  // The user's own ads come from their OWN table, never the evidence batch — so
  // they cannot reach `scoreItems` below, cannot enter a percentile base, and
  // cannot move a competitor's opportunity score. That separation is the reason
  // a measured number and a derived score can safely appear on one screen.
  const ownRows: OwnRowData[] = ownAds.map((row) => ({
    id: row.id,
    label: row.label,
    headline: row.headline,
    bodyCopy: row.bodyCopy,
    ctaLabel: row.ctaLabel,
    assetKind: row.assetKind,
    impressions: row.impressions,
    clicks: row.clicks,
    results: row.results,
    resultLabel: row.resultLabel,
    amountSpent: row.amountSpent,
    currency: row.currency,
    videoPlays: row.videoPlays,
    watched25: row.watched25,
    watched75: row.watched75,
    daysLive: row.daysLive,
  }));

  const closed = batches.filter((batch) => batch.state === "closed");
  const latest = closed[0] ?? null;
  const items = latest ? await getItems(id, latest.id) : [];

  const scoreItems: ScoreItem[] = items.map((item) => ({
    id: item.id,
    visibleStartDate: item.visibleStartDate,
    visibleResultRank: item.visibleResultRank ? Number(item.visibleResultRank) : null,
    platformCount: item.platforms ? item.platforms.split(",").filter(Boolean).length : null,
    variantCount: Number(item.adVariantCount) || 1,
    publishedReach: item.impressionsLower ? Number(item.impressionsLower) || null : null,
    observedAt: item.observedAt,
    hasCreativeArtefact: Boolean(item.artefactUrl),
    hasLibraryUrl: Boolean(item.libraryUrl),
    advertiser: item.advertiser,
  }));

  const coverage = latest?.coverageScore
    ? {
        ...computeCoverage(scoreItems, competitors.filter((c) => !c.pruned).map((c) => c.name)),
        score: Number(latest.coverageScore),
        band: (latest.coverageBand ?? "thin") as "thin" | "partial" | "substantial",
      }
    : computeCoverage(scoreItems, competitors.filter((c) => !c.pruned).map((c) => c.name));

  const capturedOn = latest?.closedAt
    ? latest.closedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  /**
   * Each frame's standing across captures.
   *
   * `rankDelta` stays null unless there is a previous COMPARABLE capture to move
   * against — the card then draws a dash rather than a zero, because "nothing to
   * compare to" and "did not move" are different claims and the first one is
   * true far more often.
   */
  const newest = snapshots[0] ?? null;
  const observations = newest ? await getObservations(id, newest.id) : [];
  const ruleByKey = new Map(observations.map((row) => [row.adKey, row.matchRule as MatchRule]));
  const statusByKey = new Map(statuses.map((row) => [row.adKey, row]));

  const history: Record<string, BoardHistory> = {};
  for (const item of items) {
    const { adKey } = adIdentity(item);
    const row = statusByKey.get(adKey);
    if (!row) continue;

    let basis: Basis = {};
    try {
      basis = JSON.parse(row.basis || "{}") as Basis;
    } catch {
      basis = {};
    }
    const stamps = basis.snapshots ?? [];
    const latestStamp = stamps[stamps.length - 1] ?? null;
    const previousStamp = stamps.length > 1 ? stamps[0] : null;

    const latestRank = row.latestRank ? Number(row.latestRank) : null;
    const previousRank = row.previousRank ? Number(row.previousRank) : null;

    history[item.id] = {
      state: row.state as AdStatusState,
      absences: Number(row.consecutiveAbsences) || 0,
      rankDelta:
        latestRank !== null && previousRank !== null ? previousRank - latestRank : null,
      capturesSeen: stamps.length || 1,
      matchRule: ruleByKey.get(adKey),
      basis: {
        snapshotLabel: latestStamp?.label,
        capturedAt: latestStamp?.capturedAt
          ? new Date(latestStamp.capturedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : undefined,
        comparable: basis.comparable,
        previousLabel: previousStamp?.label ?? null,
        counterNote: basis.rule,
      },
    };
  }

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · board
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="HUMAN_GATE" />}
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/watch`} />}>
            <Telescope size={13} strokeWidth={1.7} />
            <span className="min-w-0 truncate">Watchtower</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/collect`} />}>
            <span className="min-w-0 truncate">Collected ads</span>
          </Button>
        </>
      }
    >
      <PaneHeader
        title="Evidence board"
        hint="Grouped by angle, so one advertiser's repeats don't own the board."
        actions={
          closed.length > 1 ? (
            <Button variant="secondary" size="sm" render={<Link href={`/runs/${id}/timeline`} />}>
              <span className="min-w-0 truncate">Compare sweeps</span>
            </Button>
          ) : null
        }
      />
      <SourceModeNotice
        detail={
          latest
            ? `${latest.label} · ${items.length} ads · collected ${capturedOn} · coverage ${coverage.band} (${coverage.score.toFixed(2)})${
                snapshots.length > 1
                  ? ` · sweep ${snapshots.length} on record, movement shown against the previous comparable sweep`
                  : ""
              }`
            : undefined
        }
      />
      <div className="min-w-0 border-b border-border px-4 py-4 sm:px-6">
        <OwnRow runId={id} ads={ownRows} />
      </div>
      <EvidenceBoard
        run={current}
        items={items}
        scores={scores}
        coverage={coverage}
        alreadyGenerated={variants.length > 0}
        history={history}
      />
    </RackShell>
  );
}
