import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EvidenceBoard } from "@/components/board/evidence-board";
import { RunNav } from "@/components/run/run-nav";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { computeCoverage, type ScoreItem } from "@/lib/admirror/scoring";
import {
  getBatches,
  getCompetitors,
  getItems,
  getRun,
  getScores,
  getSteps,
  getVariants,
} from "@/lib/admirror/queries";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, batches, competitors, scores, variants] = await Promise.all([
    getSteps(id),
    getBatches(id),
    getCompetitors(id),
    getScores(id),
    getVariants(id),
  ]);

  const closed = batches.filter((batch) => batch.state === "closed");
  const latest = closed[0] ?? null;
  const items = latest ? await getItems(id, latest.id) : [];

  const scoreItems: ScoreItem[] = items.map((item) => ({
    id: item.id,
    visibleStartDate: item.visibleStartDate,
    visibleResultRank: item.visibleResultRank ? Number(item.visibleResultRank) : null,
    platformCount: item.platforms ? item.platforms.split(",").filter(Boolean).length : null,
    variantCount: 1,
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

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · board
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="HUMAN_GATE" />}
      actions={
        <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/collect`} />}><span className="min-w-0 truncate">Collected ads</span></Button>
      }
    >
      <PaneHeader
        title="Evidence board"
        hint="Grouped by angle, so one advertiser's repeats don't own the board."
        actions={
          closed.length > 1 ? (
            <Button variant="secondary" size="sm" render={<Link href={`/runs/${id}/timeline`} />}><span className="min-w-0 truncate">Compare sweeps</span></Button>
          ) : null
        }
      />
      <SourceModeNotice
        detail={
          latest
            ? `${latest.label} · ${items.length} ads · collected ${capturedOn} · coverage ${coverage.band} (${coverage.score.toFixed(2)})`
            : undefined
        }
      />
      <EvidenceBoard
        run={current}
        items={items}
        scores={scores}
        coverage={coverage}
        alreadyGenerated={variants.length > 0}
      />
    </RackShell>
  );
}
