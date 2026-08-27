"use client";

/**
 * THE STANDING LIST — every ad the watchtower has ever read, and where it stands.
 *
 * Two things are load-bearing on this screen:
 *
 *   1. A status stronger than "observed" is ALWAYS one click from its own basis:
 *      which sweeps, on which dates, under which conditions. A claim about an
 *      ad's fate with no visible evidence is exactly the fabrication this product
 *      exists not to commit.
 *   2. Rank movement appears only against a COMPARABLE previous sweep. No prior
 *      comparable reading means a dash — never a zero, which would read as
 *      "didn't move".
 */
import { useMemo, useState } from "react";
import { ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { EdgeCode, Lamp, Plate, type LampState } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdStatusRow } from "@/lib/admirror/queries";
import {
  STATUS_LABEL,
  STATUS_NOTE,
  THREE_COMPARABLE_RULE,
  type AdStatusState,
} from "@/lib/admirror/watchtower";
import { cn } from "@/lib/utils";

const STATE_LAMP: Record<AdStatusState, LampState> = {
  observed: "live",
  not_observed_recently: "hold",
  likely_no_longer_active: "cold",
};

type Basis = {
  rule?: string;
  comparable?: boolean;
  comparabilityNote?: string | null;
  snapshots?: { id: string; label: string; capturedAt: string | null; comparableHash: string }[];
};

function parseBasis(raw: string): Basis {
  try {
    return (JSON.parse(raw || "{}") ?? {}) as Basis;
  } catch {
    return {};
  }
}

function stamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const FILTERS: { value: "all" | AdStatusState; label: string }[] = [
  { value: "all", label: "All" },
  { value: "observed", label: "Observed" },
  { value: "not_observed_recently", label: "Not observed recently" },
  { value: "likely_no_longer_active", label: "Likely gone" },
];

export function AdHistory({ statuses }: { statuses: AdStatusRow[] }) {
  const [filter, setFilter] = useState<"all" | AdStatusState>("all");
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<AdStatusState, number>();
    for (const row of statuses) {
      const state = row.state as AdStatusState;
      map.set(state, (map.get(state) ?? 0) + 1);
    }
    return map;
  }, [statuses]);

  const shown = useMemo(
    () => (filter === "all" ? statuses : statuses.filter((row) => row.state === filter)),
    [filter, statuses],
  );

  if (statuses.length === 0) {
    return (
      <div className="max-w-[58ch] px-4 py-8 sm:px-6">
        <Plate className="block">No history yet</Plate>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          History starts at the second sweep. One reading is a photograph; two are the
          beginning of a record.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <EdgeCode>{String(statuses.length).padStart(3, "0")} ads tracked</EdgeCode>
          <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
            {counts.get("observed") ?? 0} observed ·{" "}
            {counts.get("not_observed_recently") ?? 0} not observed recently
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? "secondary" : "ghost"}
              className="min-w-0"
              onClick={() => setFilter(option.value)}
            >
              <span className="min-w-0 truncate">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {shown.map((row) => {
          const state = row.state as AdStatusState;
          const basis = parseBasis(row.basis);
          const latest = row.latestRank ? Number(row.latestRank) : null;
          const previous = row.previousRank ? Number(row.previousRank) : null;
          const movement =
            latest !== null && previous !== null ? previous - latest : null;
          const expanded = open === row.id;

          return (
            <li key={row.id} className="min-w-0">
              <div className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-6">
                <Lamp state={STATE_LAMP[state]} className="mt-1.5" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-foreground">
                    {row.advertiser || "Advertiser not captured"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.headline || "No headline was read"}
                  </p>
                </div>

                {/* Movement, only against a comparable prior sweep. */}
                <div className="w-[74px] shrink-0 text-right">
                  {movement === null ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span />}
                        className="tabular inline-flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <Minus size={12} strokeWidth={1.8} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        <p>
                          No comparable earlier sweep to measure against, so there is no
                          movement to show. A dash, not a zero.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      className={cn(
                        "tabular inline-flex items-center gap-1 text-xs",
                        movement > 0
                          ? "text-lamp-live"
                          : movement < 0
                            ? "text-lamp-alert"
                            : "text-muted-foreground",
                      )}
                    >
                      {movement > 0 ? (
                        <TrendingUp size={12} strokeWidth={1.8} />
                      ) : movement < 0 ? (
                        <TrendingDown size={12} strokeWidth={1.8} />
                      ) : (
                        <Minus size={12} strokeWidth={1.8} />
                      )}
                      {movement === 0 ? "held" : `${Math.abs(movement)}`}
                    </span>
                  )}
                </div>

                <div className="hidden w-[190px] min-w-0 shrink-0 sm:block">
                  <span
                    className={cn(
                      "plate block truncate",
                      state === "observed"
                        ? "text-lamp-live"
                        : state === "not_observed_recently"
                          ? "text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[state]}
                  </span>
                  <span className="tabular block truncate text-[11px] text-muted-foreground">
                    last read {stamp(row.lastObservedAt?.toISOString())}
                  </span>
                </div>

                {/* Any claim stronger than "observed" carries its basis one click away. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : row.id)}
                >
                  <span className="min-w-0 truncate">Basis</span>
                  <ChevronDown
                    size={13}
                    strokeWidth={1.8}
                    className={cn("shrink-0 transition-transform", expanded && "rotate-180")}
                  />
                </Button>
              </div>

              {expanded ? (
                <div className="border-t border-border/50 bg-rack-rail/40 px-4 py-3.5 sm:px-6">
                  <div className="max-w-[70ch] min-w-0">
                    <Plate className="block">{STATUS_LABEL[state]}</Plate>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85">
                      {STATUS_NOTE[state]}
                    </p>
                    {basis.rule ? (
                      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        {basis.rule}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                      <div className="min-w-0">
                        <Plate className="block">First read</Plate>
                        <span className="tabular text-[13px]">
                          {stamp(row.firstObservedAt?.toISOString())}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Plate className="block">Last read</Plate>
                        <span className="tabular text-[13px]">
                          {stamp(row.lastObservedAt?.toISOString())}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Plate className="block">Comparable misses</Plate>
                        <span className="tabular text-[13px]">{row.consecutiveAbsences}</span>
                      </div>
                    </div>

                    {basis.snapshots && basis.snapshots.length > 0 ? (
                      <ul className="mt-3 space-y-1 border-t border-border/50 pt-3">
                        {basis.snapshots.map((snap) => (
                          <li
                            key={snap.id}
                            className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground"
                          >
                            <EdgeCode className="shrink-0">{stamp(snap.capturedAt)}</EdgeCode>
                            <span className="min-w-0 truncate">{snap.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <p className="mt-3 border-t border-border/50 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                      {THREE_COMPARABLE_RULE}
                    </p>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
