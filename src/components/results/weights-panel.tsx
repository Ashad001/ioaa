"use client";

/**
 * The weighting the opportunity score runs on — and the one your own results
 * argue for instead.
 *
 * WHY THIS SCREEN LOOKS LIKE A DECISION AND NOT A SETTING. Everything else in
 * IOAA.AI is either evidence or a refusal. This is the one place where the app
 * has an opinion about its own arithmetic, so it has to show the whole argument:
 * the five weights before, the five after, how many of the user's ads voted, how
 * consistent the pattern was, and the sentence about what a correlation across
 * one account cannot prove. Then two buttons. No auto-apply, no "recommended"
 * badge nudging a click.
 *
 * BELOW THE THRESHOLD THERE ARE NO NUMBERS. Not a preview, not a greyed-out
 * vector. A weighting on screen is a thing people act on, and the only honest way
 * to say "there isn't enough data" is to have nothing to look at.
 */
import { useTransition } from "react";
import { Check, ScaleIcon, Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  acceptWeightProposal,
  declineWeightProposal,
  proposeWeightRefit,
  revertToDefaultWeights,
} from "@/app/actions/refit";
import { EdgeCode, Panel, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import {
  COMPONENT_LABEL,
  DIRECTION_COPY,
  FIT_QUALITY_COPY,
  MIN_ADS_FOR_REFIT,
  MIN_DAYS_FOR_REFIT,
  REFIT_CANNOT_PROVE,
  REFIT_NEVER_AUTO_RULE,
  REFIT_RULE,
  fmtCorrelation,
  fmtWeight,
  fmtWeightDelta,
  type ComponentFit,
  type FitQuality,
} from "@/lib/admirror/refit";
import type { EbosComponent, EbosWeights } from "@/lib/admirror/scoring";
import { cn } from "@/lib/utils";

export type WeightsPanelData = {
  /** The vector the ranking is using right now. */
  active: EbosWeights;
  /** True when that is IOAA.AI's own shipped weighting rather than a fitted one. */
  activeIsDefault: boolean;
  /** When the live weighting was accepted, already formatted server-side. */
  activeSince: string | null;
  /** The undecided proposal, if there is one. Inert until accepted. */
  open: {
    id: string;
    fromWeights: EbosWeights;
    toWeights: EbosWeights;
    sampleSize: number;
    minDaysLive: number;
    fitQuality: FitQuality;
    evidence: ComponentFit[];
    headline: string;
    summary: string;
    /** True when the honest answer is "your weighting is already about right". */
    unchanged: boolean;
  } | null;
  /** How many of the user's ads could vote today, and how many more are needed. */
  usable: number;
  tooYoung: number;
  /** How many ads were excluded because the angle they came from isn't traceable. */
  untraceable: number;
};

const QUALITY_TONE: Record<FitQuality, string> = {
  weak: "text-muted-foreground",
  moderate: "text-chart-2",
  strong: "text-lamp-live",
};

export function WeightsPanel({ data }: { data: WeightsPanelData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't save.");
        return;
      }
      toast.success(result.message ?? "Saved.");
      router.refresh();
    });
  };

  const enough = data.usable >= MIN_ADS_FOR_REFIT;
  const missing = Math.max(0, MIN_ADS_FOR_REFIT - data.usable);

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <ScaleIcon size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">What the score weighs</span>
        </span>
      }
    >
      <div className="min-w-0 px-4 py-4">
        <p className="max-w-[58ch] text-[12.5px] leading-relaxed text-muted-foreground">
          The opportunity score is five things about a collected ad, added up in
          proportions IOAA.AI chose. Once enough of your own ads have real results
          behind them, those proportions can be fitted to what actually worked for you
          instead — and only if you say so.
        </p>

        {/* THE LIVE VECTOR. Always visible, whether fitted or not: the user should
            never have to wonder which weighting their boards were ranked under. */}
        <div className="mt-4 min-w-0 rounded-sm border border-border/70 bg-film-edge/[0.05] p-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <Plate className="block">In use now</Plate>
            <EdgeCode>
              {data.activeIsDefault
                ? "IOAA.AI's own weighting"
                : `Fitted to you${data.activeSince ? ` · ${data.activeSince}` : ""}`}
            </EdgeCode>
          </div>
          <ul className="mt-2.5 min-w-0 space-y-1.5">
            {(Object.keys(data.active) as EbosComponent[]).map((key) => (
              <li key={key} className="flex min-w-0 items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/85">
                  {COMPONENT_LABEL[key]}
                </span>
                <span
                  aria-hidden
                  className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-border/70"
                >
                  <span
                    className="block h-full rounded-full bg-chart-2"
                    style={{ width: `${Math.min(100, data.active[key] * 200)}%` }}
                  />
                </span>
                <span className="tabular w-12 shrink-0 text-right text-[12.5px] text-foreground">
                  {fmtWeight(data.active[key])}
                </span>
              </li>
            ))}
          </ul>
          {!data.activeIsDefault ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2.5"
              disabled={pending}
              onClick={() => run(revertToDefaultWeights)}
            >
              <Undo2 size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Go back to IOAA.AI&rsquo;s weighting</span>
            </Button>
          ) : null}
        </div>

        {/* THE PROPOSAL, or the refusal. Never both, and never a preview of one
            while the other applies. */}
        {data.open ? (
          <ProposalBlock
            open={data.open}
            pending={pending}
            onAccept={() => run(() => acceptWeightProposal(data.open!.id))}
            onDecline={() => run(() => declineWeightProposal(data.open!.id))}
          />
        ) : enough ? (
          <div className="mt-4 min-w-0 border-t border-border/70 pt-4">
            <Plate className="block">Fit it to your results</Plate>
            <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-muted-foreground">
              {data.usable} of your own ads have {MIN_DAYS_FOR_REFIT}+ days of results and a
              traceable source angle — enough to compare what the score saw against what
              your ads actually cost. IOAA.AI will show you the proposed weighting and
              change nothing until you accept it.
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={pending}
              onClick={() => run(proposeWeightRefit)}
            >
              <Sparkles size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Work out a weighting from my results</span>
            </Button>
          </div>
        ) : (
          <div className="mt-4 min-w-0 border-t border-border/70 pt-4">
            <Plate className="block">Not enough to fit yet</Plate>
            <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-foreground/85">
              {missing} more of your own ads need results before IOAA.AI will propose a
              different weighting.
              {data.tooYoung > 0
                ? ` ${data.tooYoung} you've already reported are still too new to count, so part of that gap closes on its own.`
                : ""}
              {data.untraceable > 0
                ? ` ${data.untraceable} shipped ${data.untraceable === 1 ? "ad isn't" : "ads aren't"} linked back to a collected angle, so ${data.untraceable === 1 ? "it can't" : "they can't"} vote on what the score should weigh.`
                : ""}
            </p>
            <p className="mt-2.5 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
              {REFIT_RULE}
            </p>
          </div>
        )}

        <p className="mt-4 max-w-[58ch] border-t border-border/70 pt-3 text-[12px] leading-relaxed text-muted-foreground">
          {REFIT_NEVER_AUTO_RULE}
        </p>
      </div>
    </Panel>
  );
}

/**
 * The side-by-side argument.
 *
 * Old and new sit on the same rows so a change is a horizontal read, and every
 * row carries its own sample size — a weight moved on 13 ads and a weight moved
 * on 60 are different claims and must not look identical.
 */
function ProposalBlock({
  open,
  pending,
  onAccept,
  onDecline,
}: {
  open: NonNullable<WeightsPanelData["open"]>;
  pending: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const quality = FIT_QUALITY_COPY[open.fitQuality];

  return (
    <div className="mt-4 min-w-0 border-t border-border/70 pt-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Plate className="block">
          {open.unchanged ? "Fitted — nothing worth changing" : "Proposed — not applied"}
        </Plate>
        <span className={cn("plate shrink-0", QUALITY_TONE[open.fitQuality])}>
          {quality.label}
        </span>
      </div>

      {/* An unchanged fit is a real finding, not a failure — so it gets said
          plainly rather than dressed up as a change the user should accept. */}
      <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-foreground">
        {open.unchanged
          ? "Your own results already match the weighting in use. Nothing moved far enough to be worth changing — which is a genuine answer, not a failed fit."
          : open.headline || open.summary}
      </p>

      <dl className="mt-3 flex min-w-0 flex-wrap gap-x-6 gap-y-2">
        <div className="min-w-0">
          <dt className="plate text-rack-engrave">Your ads</dt>
          <dd className="tabular text-[13px] text-foreground">{open.sampleSize}</dd>
        </div>
        <div className="min-w-0">
          <dt className="plate text-rack-engrave">Shortest run</dt>
          <dd className="tabular text-[13px] text-foreground">{open.minDaysLive} days</dd>
        </div>
      </dl>

      <div className="mt-3 min-w-0 overflow-hidden rounded-sm border border-border/70">
        <div className="flex min-w-0 items-center gap-2 border-b border-border/70 bg-film-edge/[0.06] px-2.5 py-1.5">
          <span className="plate min-w-0 flex-1 truncate text-rack-engrave">Component</span>
          <span className="plate w-11 shrink-0 text-right text-rack-engrave">Now</span>
          <span className="plate w-11 shrink-0 text-right text-rack-engrave">New</span>
        </div>
        <ul className="min-w-0 divide-y divide-border/60">
          {open.evidence.map((fit) => {
            const moved = Math.abs(fit.toWeight - fit.fromWeight) >= 0.005;
            return (
              <li key={fit.component} className="min-w-0 px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                    {COMPONENT_LABEL[fit.component]}
                  </span>
                  <span className="tabular w-11 shrink-0 text-right text-[12.5px] text-muted-foreground">
                    {fmtWeight(fit.fromWeight)}
                  </span>
                  <span
                    className={cn(
                      "tabular w-11 shrink-0 text-right text-[12.5px]",
                      moved ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {fmtWeight(fit.toWeight)}
                  </span>
                </div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
                    {DIRECTION_COPY[fit.direction]}
                  </span>
                  <span aria-hidden className="text-[11px] text-border">
                    ·
                  </span>
                  <span className="tabular shrink-0 text-[11.5px] text-muted-foreground">
                    {fit.n} {fit.n === 1 ? "ad" : "ads"}
                  </span>
                  {fit.correlation !== null ? (
                    <>
                      <span aria-hidden className="text-[11px] text-border">
                        ·
                      </span>
                      <span className="tabular shrink-0 text-[11.5px] text-muted-foreground">
                        r {fmtCorrelation(fit.correlation)}
                      </span>
                    </>
                  ) : null}
                  <span aria-hidden className="text-[11px] text-border">
                    ·
                  </span>
                  <span className="tabular shrink-0 text-[11.5px] text-muted-foreground">
                    {fmtWeightDelta(fit.fromWeight, fit.toWeight)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
        {quality.note}
      </p>
      <p className="mt-2 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
        {REFIT_CANNOT_PROVE}
      </p>

      <div className="mt-3.5 flex min-w-0 flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={onAccept}>
          <Check size={13} strokeWidth={1.7} />
          <span className="min-w-0 truncate">
            {open.unchanged ? "Accept anyway" : "Use this weighting"}
          </span>
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={onDecline}>
          <X size={13} strokeWidth={1.7} />
          <span className="min-w-0 truncate">Keep what I have</span>
        </Button>
      </div>
    </div>
  );
}
