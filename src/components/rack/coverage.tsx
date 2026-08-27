/**
 * The coverage meter and the EBOS ring.
 *
 * These two are one component in spirit: an opportunity score is meaningless
 * without knowing how complete the evidence behind it is, so the ring takes the
 * band as a REQUIRED prop and renders it inline. There is no way to draw the ring
 * alone, which is the only reliable way to keep that promise.
 */
import type { ReactNode } from "react";

import { BAND_COPY, type CoverageResult } from "@/lib/admirror/scoring";
import { Plate } from "@/components/rack/plate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BAND_TEXT: Record<CoverageResult["band"], string> = {
  thin: "text-lamp-alert",
  partial: "text-primary",
  substantial: "text-lamp-live",
};

const BAND_FILL: Record<CoverageResult["band"], string> = {
  thin: "bg-lamp-alert",
  partial: "bg-primary",
  substantial: "bg-lamp-live",
};

export function CoverageBand({
  band,
  score,
  className,
}: {
  band: CoverageResult["band"];
  score: number;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          "plate tabular inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-current/35 px-1.5 py-[3px] leading-none",
          BAND_TEXT[band],
          className,
        )}
      >
        {band} {score.toFixed(2)}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p>{BAND_COPY[band]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The opportunity score, drawn as a gauge on the panel.
 *
 * `band` and `score` are required — see the note at the top of this file.
 */
export function EbosGauge({
  ebos,
  band,
  coverageScore,
  derivation,
  size = 64,
}: {
  ebos: number;
  band: CoverageResult["band"];
  coverageScore: number;
  derivation?: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, ebos)) / 100) * circumference;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <Tooltip>
        <TooltipTrigger
          render={<div />}
          className="relative shrink-0"
          style={{ width: size, height: size }}
        >
            {/* Geometry, not an icon: a gauge needle track drawn to exact values. */}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--rack-rail)"
                strokeWidth={4}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={4}
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference - dash}`}
              />
            </svg>
            <span className="tabular absolute inset-0 flex items-center justify-center text-[15px] font-medium">
              {ebos.toFixed(0)}
            </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          <p className="font-medium">Opportunity score, within this evidence set</p>
          <p className="mt-1 text-xs opacity-85">
            {derivation ??
              "Weighted over the signals you actually captured. Anything you didn't capture is dropped, not counted as zero."}
          </p>
        </TooltipContent>
      </Tooltip>
      <div className="min-w-0">
        <Plate className="block">Coverage</Plate>
        <CoverageBand band={band} score={coverageScore} className="mt-1" />
      </div>
    </div>
  );
}

/** The live capture meter: what's in, what's missing, what to go and get. */
export function CoverageMeter({
  coverage,
  header,
  footer,
}: {
  coverage: CoverageResult;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      {header}
      <div className="border-b border-border/70 px-4 py-3.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Plate className="block">Coverage</Plate>
            <div className="tabular mt-1 text-2xl leading-none">{coverage.score.toFixed(2)}</div>
          </div>
          <CoverageBand band={coverage.band} score={coverage.score} />
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-rack-rail">
          <div
            className={cn("h-full transition-[width] duration-700 ease-out", BAND_FILL[coverage.band])}
            style={{ width: `${Math.round(coverage.score * 100)}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{BAND_COPY[coverage.band]}</p>
      </div>

      <div className="divide-y divide-border/60">
        {coverage.parts.map((part) => (
          <div key={part.label} className="flex min-w-0 items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-foreground/90">{part.label}</div>
              <div className="truncate text-[11px] text-muted-foreground">{part.detail}</div>
            </div>
            <div className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-rack-rail">
              <div
                className="h-full bg-rack-engrave transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round(part.value * 100)}%` }}
              />
            </div>
            <span className="tabular w-9 shrink-0 text-right text-xs text-muted-foreground">
              {Math.round(part.value * 100)}%
            </span>
          </div>
        ))}
      </div>

      {coverage.gaps.length > 0 ? (
        <div className="border-t border-border/70 px-4 py-3.5">
          <Plate className="block">Go and get</Plate>
          <ul className="mt-2 space-y-1.5">
            {coverage.gaps.map((gap) => (
              <li key={gap} className="flex gap-2 text-xs leading-relaxed text-foreground/85">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {footer}
    </div>
  );
}
