"use client";

/**
 * The hook pattern library, as a filterable grid of cells.
 *
 * THE GREY CELL IS THE MOST IMPORTANT THING ON THIS SCREEN. A pattern built on
 * two ads would be read as knowledge, quoted in a meeting, and used to pick the
 * next month's creative. So a cell under the minimum arrives here with its
 * numbers already NULL — dropped upstream in the aggregation, not hidden by this
 * component — and it renders as a count and a reason, with nothing to misread.
 *
 * Filters are client-side because the whole library is small by nature: it is one
 * row per mechanism × format × category × market for one person, not a dataset.
 */
import { useMemo, useState } from "react";
import { Filter, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { EdgeCode, Panel, Plate } from "@/components/rack/plate";
import {
  MIN_N_FOR_PATTERN,
  PATTERN_STANDING_COPY,
  fmtIndex,
  type PatternCell,
} from "@/lib/admirror/outcome";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PatternGridCell = PatternCell & { id: string };

const ALL = "__all__";

export function PatternGrid({ cells }: { cells: PatternGridCell[] }) {
  const [category, setCategory] = useState(ALL);
  const [market, setMarket] = useState(ALL);

  const categories = useMemo(
    () => [...new Set(cells.map((cell) => cell.categoryLabel).filter(Boolean))].sort(),
    [cells],
  );
  const markets = useMemo(
    () => [...new Set(cells.map((cell) => cell.marketLabel).filter(Boolean))].sort(),
    [cells],
  );

  const shown = cells.filter(
    (cell) =>
      (category === ALL || cell.categoryLabel === category) &&
      (market === ALL || cell.marketLabel === market),
  );

  return (
    <div className="min-w-0 space-y-4">
      {(categories.length > 1 || markets.length > 1) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-sm border border-border bg-card/40 px-4 py-3">
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <Filter size={12} strokeWidth={1.8} />
            <Plate>Narrow to</Plate>
          </span>
          {categories.length > 1 ? (
            <FilterRow
              label="Category"
              options={categories}
              value={category}
              onChange={setCategory}
            />
          ) : null}
          {markets.length > 1 ? (
            <FilterRow label="Market" options={markets} value={market} onChange={setMarket} />
          ) : null}
        </div>
      )}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((cell) => (
          <Cell key={cell.id} cell={cell} />
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel label="Nothing in that slice">
          <p className="max-w-[56ch] px-4 py-5 text-[13px] leading-relaxed text-muted-foreground">
            No shipped ads match that category and market yet. Widen the filter, or ship
            something in this market and come back.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Plate className="block text-rack-engrave">{label}</Plate>
      <ToggleGroup
        className="min-w-0 flex-wrap"
        value={[value]}
        onValueChange={(next) => {
          const picked = Array.isArray(next) ? next[0] : next;
          onChange(picked || ALL);
        }}
      >
        <ToggleGroupItem value={ALL} className="min-w-0">
          <span className="min-w-0 truncate">All</span>
        </ToggleGroupItem>
        {options.map((option) => (
          <ToggleGroupItem key={option} value={option} className="min-w-0">
            <span className="min-w-0 truncate">{option}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function Cell({ cell }: { cell: PatternGridCell }) {
  const copy = PATTERN_STANDING_COPY[cell.standing];
  const thin = cell.standing === "too_thin";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-sm border bg-card/50 p-4",
        thin ? "border-dashed border-rack-seam" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] leading-snug text-foreground">{cell.mechanism}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {[cell.formatLabel, cell.categoryLabel, cell.marketLabel].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            className={cn(
              "plate inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border px-1.5 py-1 leading-none",
              cell.standing === "outperformed" && "border-lamp-live/50 bg-lamp-live/12 text-lamp-live",
              cell.standing === "underperformed" && "border-primary/50 bg-primary/10 text-primary",
              cell.standing === "inline" && "border-chart-2/50 text-chart-2",
              thin && "border-dashed border-rack-seam text-muted-foreground",
            )}
          >
            {cell.standing === "outperformed" ? (
              <TrendingUp size={11} strokeWidth={1.9} className="shrink-0" />
            ) : cell.standing === "underperformed" ? (
              <TrendingDown size={11} strokeWidth={1.9} className="shrink-0" />
            ) : (
              <Minus size={11} strokeWidth={1.9} className="shrink-0" />
            )}
            <span className="min-w-0 truncate">{copy.label}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">
            <p className="text-xs leading-relaxed">{copy.note}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {thin ? (
        <div className="mt-4 min-w-0 flex-1 border-t border-border/60 pt-3">
          <p className="max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">
            {cell.measuredCount === 0
              ? `${cell.shippedCount} shipped, none measured yet. Numbers appear once ${MIN_N_FOR_PATTERN} of them have real results.`
              : `${cell.measuredCount} of ${cell.shippedCount} measured — ${MIN_N_FOR_PATTERN} needed before a figure means anything.`}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3">
          <Stat label="Scroll-stop" value={fmtIndex(cell.thumbstopIndex)} />
          <Stat label="Held on" value={fmtIndex(cell.holdIndex)} />
          <Stat label="Clicks" value={fmtIndex(cell.clickIndex)} />
          <Stat label="Cost per result" value={fmtIndex(cell.costIndex)} />
        </div>
      )}

      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-border/60 pt-2.5">
        <EdgeCode className="min-w-0 truncate">
          {cell.measuredCount} measured · {cell.shippedCount} shipped
        </EdgeCode>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Plate className="block">{label}</Plate>
      <span className="tabular mt-0.5 block truncate text-[13.5px] text-foreground/90">
        {value}
      </span>
    </div>
  );
}
