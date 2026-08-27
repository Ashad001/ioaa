"use client";

/**
 * One shipped ad, its real numbers, and the reading — or the refusal.
 *
 * THE REFUSAL IS RENDERED WITH THE SAME WEIGHT AS A VERDICT, and it appears
 * INSTEAD of one, never alongside. That is the point: a greyed-out verdict with a
 * "low confidence" note beside it still gets read as a verdict, remembered as a
 * verdict, and repeated as one. So when the volume isn't there the card says what
 * it needs and shows the raw counts, and there is no way to press past it.
 *
 * The card also always names WHAT it compared against. "Beat your average" means
 * nothing until you know whether that average is the figure the user typed in or
 * the middle of their own other ads — those are different claims.
 */
import { useState, useTransition } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleSlash,
  Hourglass,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { unmarkShipped } from "@/app/actions/outcome";
import { EdgeCode, Lamp, Panel, Plate, type LampState } from "@/components/rack/plate";
import { IndexBar } from "@/components/results/index-strip";
import { ReportForm } from "@/components/results/report-form";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  STAGE_COPY,
  VERDICT_COPY,
  fmtCount,
  type Diagnosis,
} from "@/lib/admirror/outcome";
import { cn } from "@/lib/utils";

const VERDICT_LAMP: Record<Diagnosis["verdict"], LampState> = {
  outperformed: "live",
  inline: "done",
  underperformed: "alert",
  insufficient_data: "cold",
};

const ANGLE_COPY: Record<Diagnosis["angleVerdict"], string> = {
  transferred: "The borrowed angle carried over into your brand.",
  did_not_transfer: "The borrowed angle didn't carry over here.",
  cannot_say: "Nothing to say about the borrowed angle yet.",
};

export type ResultCardData = {
  id: string;
  runId: string;
  label: string;
  brandName: string;
  marketLabel: string;
  hookMechanism: string;
  formatLabel: string;
  assetKind: string;
  launchedOn: string | null;
  readOn: string | null;
  readingCount: number;
  diagnosis: Diagnosis;
  /** True when this variant inherited a competitor angle we can link back to. */
  hasSource: boolean;
};

export function ResultCard({ data }: { data: ResultCardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const { diagnosis } = data;
  const verdict = VERDICT_COPY[diagnosis.verdict];
  const refused = diagnosis.refusal !== null;

  const remove = () => {
    startTransition(async () => {
      const result = await unmarkShipped({ shippedAdId: data.id, runId: data.runId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Taken off the results list.");
      router.refresh();
    });
  };

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Lamp state={VERDICT_LAMP[diagnosis.verdict]} />
          <span className="min-w-0 truncate">{data.label}</span>
        </span>
      }
      aside={
        <span className="flex shrink-0 items-center gap-2">
          <EdgeCode className="hidden sm:inline">{data.hookMechanism || "no hook label"}</EdgeCode>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={remove}
            aria-label="Remove from results"
          >
            <Trash2 size={13} strokeWidth={1.7} />
          </Button>
        </span>
      }
    >
      <div className="min-w-0 px-4 py-4">
        {/* ── The verdict, or the refusal in its place. */}
        <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
          <span
            className={cn(
              "plate inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border px-2 py-1 leading-none",
              verdict.tone === "good" && "border-lamp-live/50 bg-lamp-live/12 text-lamp-live",
              verdict.tone === "bad" && "border-primary/50 bg-primary/10 text-primary",
              verdict.tone === "flat" && "border-chart-2/50 text-chart-2",
              verdict.tone === "quiet" && "border-dashed border-rack-seam text-muted-foreground",
            )}
          >
            {diagnosis.verdict === "outperformed" ? (
              <TrendingUp size={11} strokeWidth={1.9} className="shrink-0" />
            ) : diagnosis.verdict === "underperformed" ? (
              <TrendingDown size={11} strokeWidth={1.9} className="shrink-0" />
            ) : diagnosis.verdict === "insufficient_data" ? (
              <Hourglass size={11} strokeWidth={1.9} className="shrink-0" />
            ) : (
              <CircleSlash size={11} strokeWidth={1.9} className="shrink-0" />
            )}
            <span className="min-w-0 truncate">{verdict.label}</span>
          </span>

          <div className="min-w-0 flex-1">
            {refused ? (
              <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-foreground/85">
                {diagnosis.refusal}
              </p>
            ) : (
              <>
                <p className="plate text-rack-engrave">
                  {STAGE_COPY[diagnosis.stage].label} · {STAGE_COPY[diagnosis.stage].where}
                </p>
                {diagnosis.reading.map((line, index) => (
                  <p
                    key={index}
                    className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-foreground/85"
                  >
                    {line}
                  </p>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── The raw counts. Shown whether or not a verdict was given, because
                these are the facts and the verdict is the interpretation. */}
        <div className="mt-4 flex min-w-0 flex-wrap gap-x-6 gap-y-3 border-t border-border/60 pt-3">
          <Figure label="Views" value={fmtCount(diagnosis.impressions)} />
          <Figure
            label="Days running"
            value={diagnosis.daysLive === null ? "not reported" : String(diagnosis.daysLive)}
          />
          <Figure label="Readings filed" value={String(data.readingCount)} />
          <Figure label="Last read" value={data.readOn ?? "—"} />
          <Figure label="Format" value={data.formatLabel || "—"} />
        </div>

        {/* ── The funnel, only when there is something honest to plot. */}
        {refused ? null : (
          <div className="mt-4 grid min-w-0 gap-4 border-t border-border/60 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <IndexBar
              label="Stopped the scroll"
              question="did the first seconds work"
              index={diagnosis.indexed.thumbstop}
              rate={diagnosis.rates.thumbstop}
            />
            <IndexBar
              label="Stayed for the body"
              question="did the middle pay off the hook"
              index={diagnosis.indexed.hold}
              rate={diagnosis.rates.hold}
            />
            <IndexBar
              label="Tapped through"
              question="did the offer earn the click"
              index={diagnosis.indexed.click}
              rate={diagnosis.rates.click}
            />
            <IndexBar
              label="Cost per result"
              question="did it convert at a sane price"
              index={diagnosis.indexed.cost}
              rate={null}
            />
          </div>
        )}

        {/* ── What to change next, and the angle verdict. */}
        {diagnosis.nextMoves.length > 0 ? (
          <div className="mt-4 min-w-0 border-t border-border/60 pt-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <Plate className="min-w-0 truncate">What to change next</Plate>
              {data.hasSource ? (
                <span className="plate shrink-0 text-muted-foreground">
                  {ANGLE_COPY[diagnosis.angleVerdict]}
                </span>
              ) : null}
            </div>
            <ul className="mt-2 space-y-2">
              {diagnosis.nextMoves.map((move, index) => (
                <li key={index} className="flex min-w-0 gap-2.5">
                  <ArrowRight
                    size={13}
                    strokeWidth={1.8}
                    className="mt-[3px] shrink-0 text-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug text-foreground">
                      {move.change}
                    </span>
                    <span className="mt-0.5 block max-w-[66ch] text-[11.5px] leading-relaxed text-muted-foreground">
                      {move.why}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              render={<Link href={`/runs/${data.runId}/board`} />}
            >
              <Sparkles size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Build the next round from this</span>
            </Button>
          </div>
        ) : null}

        {/* ── What it was compared against. Never left implied. */}
        <p className="mt-4 flex min-w-0 items-start gap-2 border-t border-border/60 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <CircleAlert size={12} strokeWidth={1.7} className="mt-[3px] shrink-0" />
          <span className="min-w-0">Compared against: {diagnosis.baselineNote}</span>
        </p>

        {/* ── File another reading. */}
        <Collapsible open={addOpen} onOpenChange={setAddOpen} className="mt-3 min-w-0">
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-primary transition-opacity duration-150 ease-out hover:opacity-80"
              />
            }
          >
            <Plus size={13} strokeWidth={1.9} className="shrink-0" />
            <span className="min-w-0 truncate">
              {data.readingCount === 0 ? "Add the numbers" : "File a newer reading"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-sm border border-border bg-rack-rail/40">
              <ReportForm
                shippedAdId={data.id}
                compact
                onDone={() => setAddOpen(false)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Panel>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Plate className="block">{label}</Plate>
      <span className="tabular mt-0.5 block truncate text-[13px] text-foreground/90">{value}</span>
    </div>
  );
}
