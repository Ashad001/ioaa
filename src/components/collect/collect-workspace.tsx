"use client";

/**
 * S3 — the collection workspace.
 *
 * WHAT CHANGED AND WHY. This used to be a capture tool: the user's job was to
 * open searches and type ads in. Collection is now automatic, so this screen's
 * job is REVIEW — see what the sweep brought back, spot what it missed, and add
 * anything by hand.
 *
 * The manual composer stays fully functional and is NOT hidden away as legacy.
 * The sweep is best-effort: a blocked search, a small market or a page that
 * changed shape all leave real gaps, and the only honest answer to a gap is a
 * first-class way to fill it yourself.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { closeBatch } from "@/app/actions/evidence";
import { resweep } from "@/app/actions/autopilot";
import { CaptureComposer } from "@/components/collect/capture-composer";
import { CapturedList } from "@/components/collect/captured-list";
import { SavedSearches } from "@/components/collect/saved-searches";
import { CoverageMeter } from "@/components/rack/coverage";
import { Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import type { CoverageResult } from "@/lib/admirror/scoring";
import type { BatchRow, EvidenceRow, RunRow, SearchRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

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
  const [composerOpen, setComposerOpen] = useState(items.length === 0);

  const activeSearch = searches.find((row) => row.id === activeSearchId) ?? null;
  const sweptCount = items.filter(
    (item) => item.libraryUrlProvenance === "swept_from_public_library",
  ).length;

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
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <Plate className="block">Collected ads</Plate>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {sweptCount > 0
                ? `${sweptCount} read from the public Library${
                    items.length > sweptCount ? ` · ${items.length - sweptCount} added by you` : ""
                  }`
                : "Nothing collected automatically yet — add what you see below."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resweep(run.id);
                if (!result.ok) toast.error(result.error);
                else toast.success("Swept again — anything new is on the board.");
                router.refresh();
              })
            }
          >
            <RefreshCw size={13} strokeWidth={1.7} />
            <span className="min-w-0 truncate">{pending ? "Sweeping…" : "Sweep again"}</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <CapturedList runId={run.id} items={items} />
        </div>

        <div className="border-t border-border bg-card/20">
          <button
            type="button"
            onClick={() => setComposerOpen((value) => !value)}
            className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-card/60"
          >
            <span className="min-w-0">
              <Plate className="block">Add an ad yourself</Plate>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                For anything the sweep couldn&rsquo;t reach, or an ad you spotted in the wild.
              </span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={1.8}
              className={cn(
                "shrink-0 text-muted-foreground transition-transform duration-150 ease-out",
                composerOpen && "rotate-180",
              )}
            />
          </button>

          {composerOpen ? (
            <CaptureComposer
              runId={run.id}
              searchReferenceId={activeSearchId}
              searchLabel={
                activeSearch ? `${activeSearch.competitorName} · ${activeSearch.country}` : null
              }
              market={
                activeSearch?.country
                  ? `${run.marketLabel} (${activeSearch.country})`
                  : run.marketLabel
              }
              language={activeSearch?.language ?? ""}
              itemCount={items.length}
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t border-border bg-card/30 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <CoverageMeter
          coverage={coverage}
          header={
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <Plate className="min-w-0 truncate">{batch?.label ?? "Collection"}</Plate>
              <span className="plate shrink-0 text-rack-engrave">
                {batch?.state === "closed" ? "ranked" : "open"}
              </span>
            </div>
          }
          footer={
            <div className="border-t border-border px-4 py-4">
              {batch?.state === "closed" ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/runs/${run.id}/board`)}
                  >
                    See the ranked board
                  </Button>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    This collection is scored and torn down. Sweep again any time to pull in newer
                    ads and compare.
                  </p>
                </>
              ) : (
                <>
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
                    {pending ? "Ranking what was collected…" : "Rank this collection"}
                  </Button>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    Ranking deduplicates, scores and tears down every ad here — collected or added by
                    you, scored the same way.
                  </p>
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
