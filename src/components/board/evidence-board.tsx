"use client";

/**
 * THE CONTACT SHEET — every collected ad as a film frame, and the gate below it.
 *
 * Frames are grouped by ANGLE, not by advertiser, so one company's repeated
 * creative can't own the sheet. Picking a frame draws a grease-pencil ring around
 * it — the one place red is allowed besides the press itself — and the selection
 * survives a refresh, because losing a gate decision to an accidental reload is
 * infuriating.
 *
 * The sheet fills the width it is given: at a wide desktop that's five or six
 * frames across, the way a real sheet is read. Reading columns are capped inside
 * the teardown, not here.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { forceGeneration } from "@/app/actions/gate";
import { usePersistentSelection } from "@/hooks/use-persistent-selection";
import { AdRender } from "@/components/rack/ad-render";
import { CoverageBand } from "@/components/rack/coverage";
import { MetricChip } from "@/components/rack/metric";
import { Counter, EdgeCode, Plate } from "@/components/rack/plate";
import { MatrixPicker } from "@/components/board/matrix-picker";
import { TeardownDrawer } from "@/components/board/teardown-drawer";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import {
  DEFAULT_MATRIX,
  describeSpec,
  MATRIX_CAP,
  priceMatrix,
  type MatrixChoice,
} from "@/lib/admirror/matrix";
import { asProvenance } from "@/lib/admirror/provenance";
import { readReach } from "@/lib/admirror/reach";
import { StatusChip } from "@/components/watch/status-strip";
import type { AdStatusState, MatchRule } from "@/lib/admirror/watchtower";
import { RANK_CAPTION, type CoverageResult } from "@/lib/admirror/scoring";
import type { EvidenceRow, RunRow, ScoreRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

/**
 * One ad's standing across captures, as the board needs it.
 *
 * `rankDelta` is null whenever there is no previous COMPARABLE capture to move
 * against — and the card then draws a dash. A zero there would claim "no
 * movement", which is a different statement from "nothing to compare to", and
 * the second one is the truth more often than the first.
 */
export type BoardHistory = {
  state: AdStatusState;
  absences: number;
  rankDelta: number | null;
  capturesSeen: number;
  matchRule?: MatchRule;
  basis?: {
    snapshotLabel?: string;
    capturedAt?: string;
    comparable?: boolean;
    previousLabel?: string | null;
    counterNote?: string;
  };
};

export function EvidenceBoard({
  run,
  items,
  scores,
  coverage,
  alreadyGenerated,
  history,
}: {
  run: RunRow;
  items: EvidenceRow[];
  scores: ScoreRow[];
  coverage: CoverageResult;
  alreadyGenerated: boolean;
  /** Keyed by evidence item id. Empty on a first-ever capture. */
  history?: Record<string, BoardHistory>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<MatrixChoice>(DEFAULT_MATRIX);
  // The spec sheet starts closed. It is configuration with a sane default, and
  // it opens over the board rather than inside the bar.
  const [specOpen, setSpecOpen] = useState(false);

  // Selection is held in session storage, so a refresh mid-decision doesn't wipe it.
  const { selected, toggle, clear } = usePersistentSelection(`admirror.gate.${run.id}`);

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

  const selectedItemIds = selected.filter((id) => items.some((item) => item.id === id));
  const recommendedItemId = clusters[0]?.items[0]?.id ?? null;

  // Opening an approved board should never leave the only next action disabled.
  // The best-ranked frame is a starting recommendation, not a hidden decision:
  // the user can replace it with any other frame before pressing the gate.
  useEffect(() => {
    if (!recommendedItemId || selectedItemIds.length > 0) return;
    if (selected.length > 0) {
      clear();
      return;
    }
    toggle(recommendedItemId);
  }, [clear, recommendedItemId, selected.length, selectedItemIds.length, toggle]);

  const inspectingItem = items.find((item) => item.id === inspecting) ?? null;
  const cost = priceMatrix(matrix, Math.max(1, selectedItemIds.length));

  /**
   * WHY THE PRESS IS UNAVAILABLE — stated next to the press itself.
   *
   * The cap is correct and stays exactly where it is. What was missing was its
   * explanation: the only place the numbers appeared was inside the spec sheet,
   * which is folded by default, so a greyed-out button with no reason beside it
   * read as a broken app rather than a decision the user can fix in one move.
   * Every reason therefore names the numbers AND the way out.
   */
  const blockedReason =
    selectedItemIds.length === 0
      ? "Pick at least one angle — tick a frame above and the press opens."
      : cost.overCap
        ? [
            `${cost.total} assets from ${selectedItemIds.length} angle${
              selectedItemIds.length === 1 ? "" : "s"
            } — over the ${MATRIX_CAP} cap for one press.`,
            matrix.contrastFormat
              ? "Pick fewer angles, or turn off the customer-filmed cut."
              : matrix.includeStatics
                ? "Pick fewer angles, or turn off the statics."
                : "Pick fewer angles.",
          ].join(" ")
        : null;
  const withArt = items.filter((item) => Boolean(item.creativeUrl ?? item.artefactUrl)).length;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6 xl:px-8">
          {clusters.length === 0 ? (
            <div className="max-w-[56ch] py-10">
              <Plate className="block">Nothing on the sheet yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                This is the expected state before anything has been read, not an error. Head back to
                the collected ads and let the reading finish.
              </p>
              <Button className="mt-4" onClick={() => router.push(`/runs/${run.id}/collect`)}>
                Collect more
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex min-w-0 flex-wrap items-end gap-x-8 gap-y-4 border-b border-border/70 pb-4">
                <Counter value={items.length} label="Frames on the sheet" />
                <Counter value={withArt} label="With artwork" />
                <Counter value={clusters.length} label="Distinct angles" />
                <Counter value={selectedItemIds.length} label="You've picked" />
              </div>

              <div className="space-y-7">
                {clusters.map((cluster) => (
                  <section key={cluster.key} className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <Layers size={13} strokeWidth={1.6} className="shrink-0 text-rack-engrave" />
                      <h2 className="min-w-0 truncate text-[13.5px] font-medium tracking-[-0.01em]">
                        {cluster.label}
                      </h2>
                      <span aria-hidden className="h-px min-w-0 flex-1 bg-border/70" />
                      <EdgeCode className="shrink-0">
                        {cluster.items.length} {cluster.items.length === 1 ? "frame" : "frames"}
                      </EdgeCode>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {cluster.items.map((item) => {
                        const score = scoreByItem.get(item.id) ?? null;
                        const platforms = item.platforms.split(",").filter(Boolean);
                        const isSelected = selectedItemIds.includes(item.id);
                        const hasArt = Boolean(item.creativeUrl ?? item.artefactUrl);
                        const past = history?.[item.id] ?? null;
                        return (
                          <article
                            key={item.id}
                            className={cn(
                              "group flex min-w-0 flex-col rounded-sm border bg-film-base transition-all duration-200 ease-out",
                              isSelected
                                ? "border-primary shadow-[0_0_0_2px_var(--primary)]"
                                : "border-border/80 hover:border-rack-engrave",
                            )}
                          >
                            {/* The frame itself — the whole reason for this screen. */}
                            <button
                              type="button"
                              onClick={() => toggle(item.id)}
                              aria-pressed={isSelected}
                              aria-label={`Use the angle from ${item.advertiser || "this ad"}`}
                              className="relative block min-w-0 cursor-pointer p-2"
                            >
                              <AdRender
                                headline={item.headline}
                                bodyCopy={item.bodyCopy}
                                ctaLabel={item.ctaLabel}
                                advertiser={item.advertiser}
                                artefactUrl={item.artefactUrl}
                                artefactType={item.artefactType}
                                creativeUrl={item.creativeUrl}
                                isVideo={item.isVideo}
                                videoUrl={item.videoUrl}
                                videoDuration={item.videoDuration}
                                modality={item.modality}
                              />
                              <span
                                className={cn(
                                  "absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border-2 transition-colors duration-150 ease-out",
                                  isSelected
                                    ? "border-primary bg-primary/25"
                                    : "border-white/45 bg-film-base/50 group-hover:border-white/80",
                                )}
                              >
                                {/* A marker, not a control — the whole frame is
                                    the button, and a button inside a button is
                                    invalid and unreachable by keyboard. */}
                                {isSelected ? (
                                  <Check size={12} strokeWidth={3} className="text-primary" />
                                ) : null}
                              </span>
                            </button>

                            {/* The edge print: who ran it, and what we hold. */}
                            <div className="min-w-0 px-3 pb-2">
                              <div className="flex min-w-0 items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground">
                                  {item.advertiser || "Advertiser not captured"}
                                </span>
                                {score ? (
                                  <EdgeCode className="shrink-0">
                                    {Number(score.ebos).toFixed(0)}
                                  </EdgeCode>
                                ) : null}
                              </div>
                              <div className="mt-1 flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                                  {item.visibleStartDate
                                    ? `Since ${item.visibleStartDate}`
                                    : "Start date not shown"}
                                </span>
                                {hasArt ? (
                                  <ImageIcon
                                    size={11}
                                    strokeWidth={1.7}
                                    className="shrink-0 text-film-edge"
                                  />
                                ) : null}
                              </div>
                              {/* REACH. Meta's own published figure where it
                                  exists; an explicit "not published" where it
                                  doesn't. Never a zero standing in for silence. */}
                              <div className="mt-1.5 min-w-0">
                                {(() => {
                                  const reach = readReach(
                                    item.impressionsLower,
                                    item.impressionsUpper,
                                  );
                                  return reach.published ? (
                                    <MetricChip
                                      provenance="published_by_meta"
                                      detail={reach.full}
                                    >
                                      {reach.short} reached
                                    </MetricChip>
                                  ) : (
                                    <span className="block truncate text-[11px] text-muted-foreground/70">
                                      Reach not published
                                    </span>
                                  );
                                })()}
                              </div>
                              {platforms.length > 0 ? (
                                <div className="mt-1.5 min-w-0">
                                  <MetricChip provenance={asProvenance(item.platformsProvenance)}>
                                    {platforms
                                      .map((key) => PLATFORM_LABELS[key] ?? key)
                                      .join(" · ")}
                                  </MetricChip>
                                </div>
                              ) : null}
                              {past ? (
                                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                                  <StatusChip
                                    state={past.state}
                                    absences={past.absences}
                                    basis={past.basis}
                                    matchRule={past.matchRule}
                                  />
                                  <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                                    {past.capturesSeen} capture{past.capturesSeen === 1 ? "" : "s"}
                                    {" · "}
                                    {past.rankDelta === null
                                      ? "— no comparable capture before this"
                                      : past.rankDelta === 0
                                        ? "same place in the results"
                                        : past.rankDelta > 0
                                          ? `up ${past.rankDelta} in the results`
                                          : `down ${Math.abs(past.rankDelta)} in the results`}
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5">
                              <button
                                type="button"
                                onClick={() => setInspecting(item.id)}
                                className="plate min-w-0 truncate text-rack-engrave underline decoration-rack-seam transition-colors hover:text-foreground"
                              >
                                Why it works
                              </button>
                              {item.libraryUrl ? (
                                <a
                                  href={item.libraryUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  Library
                                  <ExternalLink size={10} strokeWidth={1.8} />
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
            </>
          )}
        </div>
      </div>

      {/* THE DECISION BAR — one row tall, and only ever one row tall.
          The spec sheet used to live INSIDE this bar, which is why the bar grew
          to cover the frames it sits under: a panel in the flow makes the rail
          as tall as the panel. It now floats above the bar on its own layer, so
          the bar measures exactly its own row whether the sheet is open or not. */}
      {clusters.length > 0 ? (
        <div className="sticky bottom-0 z-30 shrink-0 border-t border-border bg-rack-rail/95 backdrop-blur-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6 xl:px-8">
            <div className="min-w-0">
              <Plate className="block truncate">{RANK_CAPTION}</Plate>
              <p className="tabular mt-1 truncate text-[12px] text-muted-foreground">
                {selectedItemIds.length} angle{selectedItemIds.length === 1 ? "" : "s"} picked ·{" "}
                {describeSpec(matrix)}
              </p>
            </div>

            <CoverageBand band={coverage.band} score={coverage.score} />

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <Popover open={specOpen} onOpenChange={setSpecOpen}>
                <PopoverTrigger render={<Button variant="secondary" className="shrink-0" />}>
                  <SlidersHorizontal size={13} strokeWidth={1.8} />
                  <span className="min-w-0 truncate">What gets made · {cost.total}</span>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  sideOffset={10}
                  className="max-h-[60dvh] w-[360px] overflow-y-auto bg-transparent p-0 shadow-xl ring-0"
                >
                  <MatrixPicker
                    choice={matrix}
                    onChange={setMatrix}
                    angleCount={Math.max(1, selectedItemIds.length)}
                  />
                </PopoverContent>
              </Popover>
              {alreadyGenerated ? (
                <Button variant="ghost" onClick={() => router.push(`/runs/${run.id}/creative`)}>
                  <span className="min-w-0 truncate">See your ads</span>
                </Button>
              ) : null}
              <Button
                size="lg"
                className="shrink-0"
                disabled={pending || Boolean(blockedReason)}
                aria-describedby={blockedReason ? "gate-blocked-reason" : undefined}
                onClick={() =>
                  startTransition(async () => {
                    const result = await forceGeneration({
                      runId: run.id,
                      selectedItemIds,
                      // Thin coverage is a warning, not a wall: the caveat is
                      // recorded and shown on every asset instead.
                      force: true,
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
                {pending ? "Writing your ads…" : "Make my ads from these"}
              </Button>
            </div>

            {/* The reason sits with the press, never behind the fold. */}
            {blockedReason ? (
              <p
                id="gate-blocked-reason"
                role="status"
                className="w-full min-w-0 text-[12px] leading-relaxed text-lamp-alert"
              >
                {blockedReason}
                {cost.overCap && !specOpen ? (
                  <button
                    type="button"
                    onClick={() => setSpecOpen(true)}
                    className="ml-1.5 underline decoration-lamp-alert/60 underline-offset-2 transition-colors hover:text-foreground"
                  >
                    Open what gets made
                  </button>
                ) : null}
              </p>
            ) : null}
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
