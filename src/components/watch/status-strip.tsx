"use client";

/**
 * THE STATUS CHIP — where one ad stands across captures, wherever it appears.
 *
 * One component, used by the board and the watchtower alike, because the wording
 * of a status claim must not vary by screen: that is exactly how a soft reading
 * ("not observed in this capture") hardens into a hard one ("this ad stopped")
 * on the surface nobody reviewed.
 *
 * Any claim beyond "observed" carries its basis in the tooltip: which capture,
 * on what date, whether the two were comparable, and how many comparable
 * captures have actually missed it. The three-capture rule is stated there too,
 * so the threshold is visible at the moment the claim is made.
 */
import { Eye, EyeOff, MinusCircle } from "lucide-react";

import { Lamp, Plate, type LampState } from "@/components/rack/plate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ABSENCES_FOR_LIKELY_INACTIVE,
  MATCH_RULE_LABEL,
  STATUS_LABEL,
  STATUS_NOTE,
  THREE_COMPARABLE_RULE,
  type AdStatusState,
  type MatchRule,
} from "@/lib/admirror/watchtower";
import { cn } from "@/lib/utils";

const STATE_LAMP: Record<AdStatusState, LampState> = {
  observed: "live",
  not_observed_recently: "hold",
  likely_no_longer_active: "cold",
};

const STATE_TONE: Record<AdStatusState, string> = {
  observed: "text-lamp-live border-lamp-live/40",
  not_observed_recently: "text-primary border-primary/45",
  likely_no_longer_active: "text-muted-foreground border-rack-seam",
};

const STATE_ICON: Record<AdStatusState, typeof Eye> = {
  observed: Eye,
  not_observed_recently: EyeOff,
  likely_no_longer_active: MinusCircle,
};

const SHORT_LABEL: Record<AdStatusState, string> = {
  observed: "observed",
  not_observed_recently: "not seen",
  likely_no_longer_active: "likely gone",
};

export type StatusBasis = {
  snapshotLabel?: string;
  capturedAt?: string;
  comparable?: boolean;
  previousLabel?: string | null;
  counterNote?: string;
};

export function StatusChip({
  state,
  absences,
  basis,
  matchRule,
  className,
}: {
  state: AdStatusState;
  absences: number;
  basis?: StatusBasis;
  matchRule?: MatchRule;
  className?: string;
}) {
  const Icon = STATE_ICON[state];

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          "plate inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-[3px] border px-1.5 py-[3px] leading-none",
          STATE_TONE[state],
          className,
        )}
      >
        <Icon size={10} strokeWidth={1.9} className="shrink-0" />
        <span className="min-w-0 truncate">{SHORT_LABEL[state]}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        <p className="font-medium">{STATUS_LABEL[state]}</p>
        <p className="mt-1 text-xs opacity-85">{STATUS_NOTE[state]}</p>

        {basis?.counterNote ? (
          <p className="mt-1.5 text-xs opacity-85">{basis.counterNote}</p>
        ) : null}

        <div className="mt-2 space-y-0.5 text-xs opacity-80">
          {basis?.snapshotLabel ? (
            <p>
              Latest capture: {basis.snapshotLabel}
              {basis.capturedAt ? ` · ${basis.capturedAt}` : ""}
            </p>
          ) : null}
          {basis?.previousLabel ? <p>Compared against: {basis.previousLabel}</p> : null}
          {basis?.comparable === false ? (
            <p>
              Those two captures weren&rsquo;t comparable, so this absence did not move the
              count.
            </p>
          ) : null}
          <p>
            Comparable captures that missed it: {absences} of {ABSENCES_FOR_LIKELY_INACTIVE}{" "}
            needed for a stronger claim.
          </p>
          {matchRule ? <p>Tracked across captures because it {MATCH_RULE_LABEL[matchRule]}.</p> : null}
        </div>

        <p className="mt-2 border-t border-current/15 pt-1.5 text-[11px] opacity-70">
          {THREE_COMPARABLE_RULE}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The same status as a full row — used where there is room to spell it out. */
export function StatusRow({
  state,
  absences,
  note,
}: {
  state: AdStatusState;
  absences: number;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Lamp state={STATE_LAMP[state]} className="mt-1.5" />
      <div className="min-w-0">
        <Plate className="block">{STATUS_LABEL[state]}</Plate>
        <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-muted-foreground">
          {note ?? STATUS_NOTE[state]}
        </p>
        <p className="tabular mt-1 text-[11px] text-muted-foreground">
          {absences} of {ABSENCES_FOR_LIKELY_INACTIVE} comparable captures missed it.
        </p>
      </div>
    </div>
  );
}
