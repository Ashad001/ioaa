"use client";

/**
 * S4 + S5 — the evidence board and the human gate, on one screen.
 *
 * Cards are grouped by CONCEPT, not by advertiser, so one company's repeated
 * creative can't own the board. Selection state persists in the URL-free local
 * store below and survives a refresh via sessionStorage, because losing a gate
 * selection to an accidental reload is infuriating.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Layers } from "lucide-react";
import { toast } from "sonner";

import { forceGeneration } from "@/app/actions/gate";
import { usePersistentSelection } from "@/hooks/use-persistent-selection";
import { AdRender } from "@/components/rack/ad-render";
import { CoverageBand, EbosGauge } from "@/components/rack/coverage";
import { MetricChip } from "@/components/rack/metric";
import { Lamp, Plate } from "@/components/rack/plate";
import { MatrixPicker } from "@/components/board/matrix-picker";
import { TeardownDrawer } from "@/components/board/teardown-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import { DEFAULT_MATRIX, priceMatrix, type MatrixChoice } from "@/lib/admirror/matrix";
import { asProvenance } from "@/lib/admirror/provenance";
import { RANK_CAPTION, type CoverageResult } from "@/lib/admirror/scoring";
import type { EvidenceRow, RunRow, ScoreRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

const MODALITY_LABEL: Record<string, string> = {
  full: "full",
  screenshot: "screenshot",
  video: "video",
  text_only: "text only",
  partial: "partial",
};

function ordinal(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function EvidenceBoard({
  run,
  items,
  scores,
  coverage,
  alreadyGenerated,
}: {
  run: RunRow;
  items: EvidenceRow[];
  scores: ScoreRow[];
  coverage: CoverageResult;
  alreadyGenerated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [force, setForce] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<MatrixChoice>(DEFAULT_MATRIX);

  // Selection is held in session storage, so a refresh mid-decision doesn't wipe it.
  const { selected, toggle } = usePersistentSelection(`admirror.gate.${run.id}`);

  const scoreByItem = useMemo(
    () => new Map(scores.map((score) => [score.evidenceItemId, score])),
    [scores],
  );

  // Group by concept, order clusters by their best score.
  const clusters = useMemo(() => {
    const groups = new Map<string, { label: string; items: EvidenceRow[] }>();
    for (const item of items) {
      const key = item.conceptKey || item.id;
      const existing = groups.get(key);
      if (existing) existing.items.push(item);
      else groups.set(key, { label: item.conceptLabel || "Uncategorised angle", items: [item] });
    }
    return [...groups.entries()]
      .map(([key, group]) => {
        const best = group.items.reduce((top, item) => {
          const value = Number(scoreByItem.get(item.id)?.ebos ?? 0);
          return value > top ? value : top;
        }, 0);
        return { key, ...group, best };
      })
      .sort((a, b) => b.best - a.best);
  }, [items, scoreByItem]);

  const inspectingItem = items.find((item) => item.id === inspecting) ?? null;
  const cost = priceMatrix(matrix, Math.max(1, selected.length));

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6">
          {clusters.length === 0 ? (
            <div className="max-w-[56ch] py-10">
              <Plate className="block">Nothing on the board yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                This is the expected state before capture, not an error. Head back to the capture screen
                and open one of the saved searches.
              </p>
              <Button className="mt-4" onClick={() => router.push(`/runs/${run.id}/collect`)}>
                Collect more
              </Button>
            </div>
          ) : (
            <div className="space-y-7">
              {clusters.map((cluster) => (
                <section key={cluster.key}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <Layers size={14} strokeWidth={1.6} className="shrink-0 text-rack-engrave" />
                    <h2 className="min-w-0 truncate text-[14px] font-medium tracking-[-0.01em]">
                      {cluster.label}
                    </h2>
                    {cluster.items.length > 1 ? (
                      <MetricChip provenance="derived_from_evidence" detail="Counted across the ads in this collection.">
                        Repeated across {cluster.items.length} submitted variants
                      </MetricChip>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cluster.items.map((item) => {
                      const score = scoreByItem.get(item.id) ?? null;
                      const platforms = item.platforms.split(",").filter(Boolean);
                      const isSelected = selected.includes(item.id);
                      return (
                        <article
                          key={item.id}
                          className={cn(
                            "panel flex min-w-0 flex-col rounded-sm transition-shadow duration-200 ease-out",
                            isSelected && "shadow-[inset_0_0_0_1px_var(--primary)]",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggle(item.id)}
                              aria-label={`Use this angle from ${item.advertiser || "this ad"}`}
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] text-foreground">
                                {item.advertiser || "Advertiser not captured"}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {item.market || run.marketLabel}
                              </span>
                            </div>
                            <span className="plate shrink-0 rounded-[3px] border border-border px-1.5 py-[3px] text-rack-engrave">
                              {MODALITY_LABEL[item.modality] ?? item.modality}
                            </span>
                          </div>

                          <div className="px-3 pt-3">
                            <AdRender
                              headline={item.headline}
                              bodyCopy={item.bodyCopy}
                              ctaLabel={item.ctaLabel}
                              advertiser={item.advertiser}
                              artefactUrl={item.artefactUrl}
                              artefactType={item.artefactType}
                              modality={item.modality}
                            />
                          </div>

                          <div className="px-3 py-3">
                            {score ? (
                              <EbosGauge
                                ebos={Number(score.ebos)}
                                band={score.coverageBand as CoverageResult["band"]}
                                coverageScore={Number(score.coverageScore)}
                                derivation="Open the teardown to see every component, weight and drop."
                              />
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <MetricChip provenance={asProvenance(item.visibleStartDateProvenance)}>
                                {item.visibleStartDate
                                  ? `Running since ${item.visibleStartDate}`
                                  : "Start date not captured"}
                              </MetricChip>
                              {item.visibleResultRank ? (
                                <MetricChip provenance={asProvenance(item.visibleResultRankProvenance)}>
                                  Appeared {ordinal(item.visibleResultRank)} in your captured order
                                </MetricChip>
                              ) : null}
                              {platforms.length > 0 ? (
                                <MetricChip provenance={asProvenance(item.platformsProvenance)}>
                                  {platforms.map((key) => PLATFORM_LABELS[key] ?? key).join(" · ")}
                                </MetricChip>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setInspecting(item.id)}
                              className="plate min-w-0 truncate text-rack-engrave underline decoration-rack-seam transition-colors hover:text-foreground"
                            >
                              Teardown
                            </button>
                            {item.libraryUrl ? (
                              <a
                                href={item.libraryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex shrink-0 items-center gap-1 text-[11px] text-primary"
                              >
                                Ad Library
                                <ExternalLink size={11} strokeWidth={1.8} />
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The gate. Always visible once anything is on the board. */}
      {clusters.length > 0 ? (
        <div className="sticky bottom-0 z-30 border-t border-border bg-rack-rail/95 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-3.5 sm:px-6">
            <div className="grid gap-x-6 gap-y-3.5 lg:grid-cols-[minmax(0,1fr)_364px] lg:items-end">
              <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-0">
                  <Plate className="block">{RANK_CAPTION}</Plate>
                  <p className="tabular mt-1 text-[12px] text-muted-foreground">
                    {selected.length} angle{selected.length === 1 ? "" : "s"} selected · {items.length} ads
                    on the board
                  </p>
                </div>

                <CoverageBand band={coverage.band} score={coverage.score} />

                {coverage.band === "thin" ? (
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[12px] text-foreground/85">
                    <Checkbox checked={force} onCheckedChange={(value) => setForce(Boolean(value))} />
                    <span className="min-w-0">Generate anyway from a partial view</span>
                  </label>
                ) : null}

                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  {alreadyGenerated ? (
                    <Button variant="ghost" onClick={() => router.push(`/runs/${run.id}/creative`)}>
                      <span className="min-w-0 truncate">See the variants</span>
                    </Button>
                  ) : null}
                  <Button
                    size="lg"
                    className="shrink-0"
                    disabled={pending || selected.length === 0 || cost.overCap}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await forceGeneration({
                          runId: run.id,
                          selectedItemIds: selected,
                          force,
                          matrix,
                        });
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        router.push(`/runs/${run.id}/creative`);
                      })
                    }
                  >
                    <Lamp state="hold" />
                    {pending ? "Generating…" : "Force generation"}
                  </Button>
                </div>
              </div>

              <MatrixPicker
                choice={matrix}
                onChange={setMatrix}
                angleCount={Math.max(1, selected.length)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <TeardownDrawer
        item={inspectingItem}
        score={inspectingItem ? (scoreByItem.get(inspectingItem.id) ?? null) : null}
        open={Boolean(inspecting)}
        onOpenChange={(open) => setInspecting(open ? inspecting : null)}
      />
    </>
  );
}
