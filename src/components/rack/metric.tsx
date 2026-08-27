/**
 * <Metric> — the only way a number or a captured fact is rendered in AdMirror.
 *
 * `provenance` is a REQUIRED prop with no default. That is deliberate and it is
 * the mechanism, not a style choice: a fact whose origin nobody declared cannot
 * be displayed at all, so the interface physically cannot claim to know something
 * it doesn't. A field nobody captured renders as "not captured" — never a zero,
 * never blank.
 */
import type { ReactNode } from "react";

import { PROVENANCE_META, type ProvenanceKind } from "@/lib/admirror/provenance";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BADGE_STYLE: Record<ProvenanceKind, string> = {
  observed_in_user_evidence: "bg-lamp-live/18 text-lamp-live border border-lamp-live/45",
  // Meta's own published figure — the strongest claim in the app, so it is the
  // only badge that reads as filled and lit rather than outlined.
  published_by_meta: "bg-primary text-primary-foreground border border-primary",
  swept_from_public_library: "bg-chart-1/16 text-chart-1 border border-chart-1/45",
  read_in_your_browser: "bg-chart-2/16 text-chart-2 border border-chart-2/45",
  user_asserted: "bg-transparent text-primary border border-primary/60",
  derived_from_evidence: "bg-transparent text-chart-2 border border-chart-2/55",
  model_interpretation: "bg-transparent text-muted-foreground border border-dashed border-rack-seam",
  unknown: "bg-muted/60 text-muted-foreground border border-transparent",
};

export function ProvenanceBadge({
  provenance,
  detail,
  className,
}: {
  provenance: ProvenanceKind;
  detail?: string;
  className?: string;
}) {
  const meta = PROVENANCE_META[provenance];
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          "plate inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-[3px] leading-none",
          BADGE_STYLE[provenance],
          className,
        )}
      >
        {meta.short}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="font-medium">{meta.label}</p>
        <p className="mt-1 text-xs opacity-85">{meta.explain}</p>
        {detail ? <p className="mt-1 text-xs opacity-85">{detail}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function Metric({
  value,
  label,
  provenance,
  source,
  capturedAt,
  derivation,
  className,
  emphasise = false,
}: {
  /** null renders as "not captured" — that is the honest state, so it is allowed. */
  value: ReactNode | null;
  label: string;
  provenance: ProvenanceKind;
  source?: string;
  capturedAt?: string;
  derivation?: string;
  className?: string;
  emphasise?: boolean;
}) {
  const missing = value === null || value === undefined || value === "";
  const kind: ProvenanceKind = missing ? "unknown" : provenance;

  // A user-asserted figure may only be shown with its source and capture time.
  const qualifier =
    kind === "user_asserted"
      ? [source, capturedAt].filter(Boolean).join(" · ") || "entered by you"
      : kind === "derived_from_evidence"
        ? derivation
        : source;

  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      <div className="min-w-0 flex-1">
        <span className="plate block truncate text-rack-engrave">{label}</span>
        <span
          className={cn(
            "tabular mt-0.5 block truncate",
            emphasise ? "text-[15px] text-foreground" : "text-[13.5px] text-foreground/90",
            missing && "text-muted-foreground italic",
          )}
        >
          {missing ? "not captured" : value}
        </span>
        {qualifier && !missing ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{qualifier}</span>
        ) : null}
      </div>
      <ProvenanceBadge provenance={kind} detail={derivation} className="mt-3" />
    </div>
  );
}

/** A compact inline chip version — for card footers where space is tight. */
export function MetricChip({
  children,
  provenance,
  detail,
}: {
  children: ReactNode;
  provenance: ProvenanceKind;
  detail?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-[3px] border border-border/80 bg-secondary/45 py-1 pl-2 pr-1">
      <span className="tabular min-w-0 truncate text-xs text-foreground/90">{children}</span>
      <ProvenanceBadge provenance={provenance} detail={detail} />
    </span>
  );
}
