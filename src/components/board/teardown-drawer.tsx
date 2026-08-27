"use client";

/**
 * The teardown drawer: how one submitted ad is built, and where every field came
 * from. This is where the machine's reasoning and its limits are inspectable —
 * including the score's own arithmetic, so a user can check it against their own
 * eyes.
 */
import { ExternalLink } from "lucide-react";

import { AdRender } from "@/components/rack/ad-render";
import { Metric } from "@/components/rack/metric";
import { EdgeCode, Plate } from "@/components/rack/plate";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EBOS_WEIGHTS, type EbosComponent } from "@/lib/admirror/scoring";
import { asProvenance } from "@/lib/admirror/provenance";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import type { Teardown } from "@/lib/admirror/pipeline";
import type { EvidenceRow, ScoreRow } from "@/lib/admirror/queries";

const COMPONENT_LABEL: Record<EbosComponent, string> = {
  published_reach: "Reach Meta published",
  duration_visible: "How long it's been visible",
  variant_repetition: "Repeated as variants",
  evidenced_rank: "Where it appeared in your capture",
  recency: "How recently you saw it",
  platform_breadth: "Platforms shown",
};

type ScoreInputs = {
  components?: Partial<Record<EbosComponent, number>>;
  weightsUsed?: Partial<Record<EbosComponent, number>>;
  dropped?: EbosComponent[];
  notes?: string[];
};

export function TeardownDrawer({
  item,
  score,
  open,
  onOpenChange,
}: {
  item: EvidenceRow | null;
  score: ScoreRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  const teardown: Teardown | null = item.teardown ? (JSON.parse(item.teardown) as Teardown) : null;
  const inputs: ScoreInputs = score?.inputs ? (JSON.parse(score.inputs) as ScoreInputs) : {};
  const platforms = item.platforms.split(",").filter(Boolean);
  const capturedAt = item.observedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="min-w-0 truncate text-[15px]">
            {item.advertiser || "Advertiser not captured"}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            {item.conceptLabel || "Structural teardown"} · captured {capturedAt}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 py-5">
          {/* The frame itself, first: the teardown is a reading OF something, and
              the something has to be on screen next to the reading. */}
          <section className="min-w-0">
            <div className="mx-auto max-w-[300px]">
              <AdRender
                headline={item.headline}
                bodyCopy={item.bodyCopy}
                ctaLabel={item.ctaLabel}
                advertiser={item.advertiser}
                artefactUrl={item.artefactUrl}
                artefactType={item.artefactType}
                creativeUrl={item.creativeUrl}
                isVideo={item.isVideo}
                modality={item.modality}
              />
            </div>
            {item.libraryUrl ? (
              <p className="mt-2 flex min-w-0 items-center justify-center gap-2">
                <EdgeCode className="shrink-0">
                  {item.libraryUrl.match(/[?&]id=(\d+)/)?.[1] ?? "no id"}
                </EdgeCode>
                <a
                  href={item.libraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Check it on the real page
                  <ExternalLink size={10} strokeWidth={1.8} />
                </a>
              </p>
            ) : null}
          </section>

          {/* Fields and their provenance */}
          <section>
            <Plate className="block">What was captured</Plate>
            <div className="mt-3 grid gap-3.5">
              <Metric
                label="Advertiser"
                value={item.advertiser || null}
                provenance={asProvenance(item.advertiserProvenance)}
                capturedAt={capturedAt}
                source={item.market || undefined}
              />
              <Metric
                label="Running since"
                value={item.visibleStartDate}
                provenance={asProvenance(item.visibleStartDateProvenance)}
                capturedAt={capturedAt}
                source="visible in the Library"
              />
              <Metric
                label="Position in your captured result order"
                value={item.visibleResultRank}
                provenance={asProvenance(item.visibleResultRankProvenance)}
                capturedAt={capturedAt}
                derivation="Result order is an ordering, not a figure Meta publishes."
              />
              <Metric
                label="Platforms shown"
                value={platforms.length > 0 ? platforms.map((k) => PLATFORM_LABELS[k] ?? k).join(" · ") : null}
                provenance={asProvenance(item.platformsProvenance)}
                capturedAt={capturedAt}
              />
              <Metric
                label="Status shown"
                value={item.activeStatus === "unknown" ? null : item.activeStatus}
                provenance={asProvenance(item.activeStatusProvenance)}
                capturedAt={capturedAt}
              />
            </div>
          </section>

          {/* The score, with its arithmetic */}
          {score ? (
            <section className="border-t border-border pt-5">
              <Plate className="block">How the score was built</Plate>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Weighted over the signals you captured. Anything you didn&rsquo;t capture is dropped and the
                remaining weights renormalised — never counted as zero.
              </p>
              <div className="mt-3 divide-y divide-border/60 rounded-sm border border-border">
                {(Object.keys(EBOS_WEIGHTS) as EbosComponent[]).map((key) => {
                  const value = inputs.components?.[key];
                  const weight = inputs.weightsUsed?.[key];
                  const isDropped = inputs.dropped?.includes(key);
                  return (
                    <div key={key} className="flex min-w-0 items-center gap-3 px-3 py-2">
                      <span
                        className={cnLabel(isDropped)}
                        title={COMPONENT_LABEL[key]}
                      >
                        {COMPONENT_LABEL[key]}
                      </span>
                      {isDropped ? (
                        <span className="plate shrink-0 text-rack-engrave">dropped</span>
                      ) : (
                        <>
                          <span className="tabular shrink-0 text-[12px] text-foreground/90">
                            {(value ?? 0).toFixed(2)}
                          </span>
                          <span className="tabular w-12 shrink-0 text-right text-[11px] text-muted-foreground">
                            ×{weight?.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {inputs.notes && inputs.notes.length > 0 ? (
                <ul className="mt-2.5 space-y-1">
                  {inputs.notes.map((note) => (
                    <li key={note} className="text-[11.5px] leading-relaxed text-muted-foreground">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* The structural read */}
          {teardown ? (
            <section className="border-t border-border pt-5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Plate>Structure</Plate>
                <span className="plate shrink-0 rounded-[3px] border border-dashed border-rack-seam px-1.5 py-[3px] text-muted-foreground">
                  a reading
                </span>
              </div>
              <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                <Field label="Hook mechanism" value={teardown.hookMechanism} />
                <Field label="Angle" value={teardown.angle} />
                <Field label="Objection handled" value={teardown.objection} />
                <Field label="Format" value={teardown.format} />
                <Field label="Offer shape" value={teardown.offerShape} />
                <Field label="CTA shape" value={teardown.ctaShape} />
              </div>

              <div className="mt-4">
                <Plate className="block">Beat order</Plate>
                <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                  {teardown.beatOrder.map((beat, index) => (
                    <li key={beat} className="flex items-center gap-1.5">
                      {index > 0 ? (
                        <span aria-hidden className="text-rack-seam">
                          →
                        </span>
                      ) : null}
                      <span className="rounded-[3px] border border-border bg-secondary/50 px-2 py-1 text-[12px]">
                        {beat}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <Plate className="block text-lamp-live">Transfers to your ad</Plate>
                  <ul className="mt-1.5 space-y-1">
                    {teardown.transferable.map((entry) => (
                      <li key={entry} className="text-[12px] leading-relaxed text-foreground/85">
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0">
                  <Plate className="block text-lamp-alert">Never transfers</Plate>
                  <ul className="mt-1.5 space-y-1">
                    {teardown.doNotTransfer.map((entry) => (
                      <li key={entry} className="text-[12px] leading-relaxed text-foreground/85">
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {/* The artefact record */}
          {item.artefactUrl ? (
            <section className="border-t border-border pt-5">
              <Plate className="block">Artefact</Plate>
              <p className="mt-2 break-all text-[11.5px] leading-relaxed text-muted-foreground">
                {item.artefactType} · scan {item.artefactScan ?? "pending"} · captured {capturedAt}
              </p>
            </section>
          ) : null}

          {item.libraryUrl ? (
            <a
              href={item.libraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 border-t border-border pt-5 text-[13px] text-primary"
            >
              <span className="min-w-0 truncate">Open this ad in the Ad Library</span>
              <ExternalLink size={13} strokeWidth={1.8} className="shrink-0" />
            </a>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function cnLabel(dropped?: boolean) {
  return dropped
    ? "min-w-0 flex-1 truncate text-[12px] text-muted-foreground line-through decoration-rack-seam"
    : "min-w-0 flex-1 truncate text-[12px] text-foreground/85";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Plate className="block">{label}</Plate>
      <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/90">{value}</p>
    </div>
  );
}
