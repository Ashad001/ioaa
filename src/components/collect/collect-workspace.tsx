"use client";

/**
 * S3 — the capture workspace. Three panes: saved searches, the composer, the
 * live coverage meter. The selected search is held here so committing an item
 * doesn't lose it.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { closeBatch } from "@/app/actions/evidence";
import { CaptureComposer } from "@/components/collect/capture-composer";
import { CapturedList } from "@/components/collect/captured-list";
import { SavedSearches } from "@/components/collect/saved-searches";
import { CoverageMeter } from "@/components/rack/coverage";
import { Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import type { CoverageResult } from "@/lib/admirror/scoring";
import type { BatchRow, EvidenceRow, RunRow, SearchRow } from "@/lib/admirror/queries";

export function CollectWorkspace({
  run,
  searches,
  items,
  batch,
  coverage,
}: {
  run: RunRow;
  searches: SearchRow[];
  items: EvidenceRow[];
  batch: BatchRow | null;
  coverage: CoverageResult;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSearchId, setActiveSearchId] = useState<string | null>(searches[0]?.id ?? null);

  const activeSearch = searches.find((row) => row.id === activeSearchId) ?? null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_296px]">
      <div className="flex min-w-0 flex-col border-b border-border bg-card/30 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
        <SavedSearches
          runId={run.id}
          searches={searches}
          activeSearchId={activeSearchId}
          onSelect={setActiveSearchId}
        />
      </div>

      <div className="flex min-w-0 flex-col lg:h-full lg:min-h-0">
        <CaptureComposer
          runId={run.id}
          searchReferenceId={activeSearchId}
          searchLabel={
            activeSearch ? `${activeSearch.competitorName} · ${activeSearch.country}` : null
          }
          market={activeSearch?.country ? `${run.marketLabel} (${activeSearch.country})` : run.marketLabel}
          language={activeSearch?.language ?? ""}
          itemCount={items.length}
        />
        <div className="flex min-h-0 flex-col border-t border-border bg-card/20 lg:flex-[2] lg:overflow-y-auto">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <Plate className="min-w-0 truncate">In this capture</Plate>
            <span className="tabular shrink-0 text-[11px] text-muted-foreground">{items.length}</span>
          </div>
          <CapturedList runId={run.id} items={items} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t border-border bg-card/30 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <CoverageMeter
          coverage={coverage}
          header={
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <Plate className="min-w-0 truncate">{batch?.label ?? "Capture"}</Plate>
              <span className="plate shrink-0 text-rack-engrave">open</span>
            </div>
          }
          footer={
            <div className="border-t border-border px-4 py-4">
              <Button
                className="w-full"
                disabled={pending || items.length === 0 || !batch}
                onClick={() =>
                  startTransition(async () => {
                    if (!batch) return;
                    const result = await closeBatch({ runId: run.id, batchId: batch.id });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    router.push(`/runs/${run.id}/board`);
                  })
                }
              >
                {pending ? "Ranking what you captured…" : "Close capture & rank"}
              </Button>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                Closing deduplicates, scores and tears down what you submitted. You can open another
                capture later and compare them.
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
