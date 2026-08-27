import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { ensureOpenBatch } from "@/lib/admirror/ensure";
import { CollectWorkspace } from "@/components/collect/collect-workspace";
import { RunNav } from "@/components/run/run-nav";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { computeCoverage, type ScoreItem } from "@/lib/admirror/scoring";
import {
  getCompetitors,
  getItems,
  getRun,
  getSearches,
  getSteps,
} from "@/lib/admirror/queries";

export default async function CollectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  // No open capture: start one so the screen is immediately usable. Closing a
  // capture is the deliberate act, not opening one.
  const batch = await ensureOpenBatch(
    id,
    `${current.marketLabel} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
  );

  const [steps, searches, competitors, items] = await Promise.all([
    getSteps(id),
    getSearches(id),
    getCompetitors(id),
    batch ? getItems(id, batch.id) : Promise.resolve([]),
  ]);

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

  const coverage = computeCoverage(
    scoreItems,
    competitors.filter((row) => !row.pruned).map((row) => row.name),
  );

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · capture
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="EVIDENCE_INTAKE" />}
      actions={
        <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}`} />}><span className="min-w-0 truncate">Console</span></Button>
      }
    >
      <PaneHeader
        title="Collect evidence"
        hint="Open a search, paste what you find. Nothing here is fetched from Meta."
      />
      {batch ? (
        <CollectWorkspace
          run={current}
          searches={searches}
          items={items}
          batch={batch}
          coverage={coverage}
        />
      ) : null}
    </RackShell>
  );
}
