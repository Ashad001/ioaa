import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { CollectWorkspace } from "@/components/collect/collect-workspace";
import { RunNav } from "@/components/run/run-nav";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { computeCoverage, type ScoreItem } from "@/lib/admirror/scoring";
import {
  getBatches,
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

  const [steps, searches, competitors, batches] = await Promise.all([
    getSteps(id),
    getSearches(id),
    getCompetitors(id),
    getBatches(id),
  ]);

  // Show the collection the user most recently got: an open one if the sweep is
  // still gathering, otherwise the latest ranked one. A closed batch is the
  // NORMAL state after an automatic sweep, so defaulting to "open only" would
  // show an empty screen straight after a successful collection.
  const batch = batches.find((row) => row.state === "open") ?? batches[0] ?? null;
  const items = batch ? await getItems(id, batch.id) : [];

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
          {current.brandName} · {current.marketLabel} · collected
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="EVIDENCE_INTAKE" />}
      actions={
        <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}`} />}>
          <span className="min-w-0 truncate">Console</span>
        </Button>
      }
    >
      <PaneHeader
        title="Collected ads"
        hint="Read from the public Ad Library. Add anything it missed."
      />
      <CollectWorkspace
        run={current}
        searches={searches}
        items={items}
        batch={batch}
        coverage={coverage}
      />
    </RackShell>
  );
}
