"use client";

/**
 * WHAT GETS MADE — the spec sheet clipped to the light box before the press.
 *
 * Two things here are REQUIREMENTS, not preferences, and they sit at the top for
 * that reason: the frame SIZE and the RUNTIME. Both change the brief that gets
 * written — the size decides where the safe area is and therefore where the
 * headline can go; the runtime sets the beat clock — so choosing them after
 * generation would mean regenerating. The cost is shown BEFORE the press, never
 * after.
 */
import { Layers2, Image as ImageIcon, Type } from "lucide-react";

import { EdgeCode, Plate } from "@/components/rack/plate";
import { Switch } from "@/components/ui/switch";
import {
  DURATIONS,
  MATRIX_CAP,
  RESOLUTIONS,
  priceMatrix,
  resolutionSpec,
  type DurationKey,
  type MatrixChoice,
  type ResolutionKey,
} from "@/lib/admirror/matrix";
import { cn } from "@/lib/utils";

const ROWS: {
  key: "includeStatics" | "contrastFormat" | "includeCopyVariants";
  icon: typeof Layers2;
  label: string;
  detail: string;
}[] = [
  {
    key: "includeStatics",
    icon: ImageIcon,
    label: "Statics alongside every video",
    detail: "Built from the opening frame each video already has, so they cost nothing extra.",
  },
  {
    key: "contrastFormat",
    icon: Layers2,
    label: "Add the customer-filmed cut",
    detail:
      "Doubles the videos. Worth it only when the same angle appears in two formats in your evidence.",
  },
  {
    key: "includeCopyVariants",
    icon: Type,
    label: "Three copy options per ad",
    detail: "Text only — alternative primary text on the same angle, ready to paste.",
  },
];

const RESOLUTION_KEYS = Object.keys(RESOLUTIONS) as ResolutionKey[];
const DURATION_KEYS = Object.keys(DURATIONS).map(Number) as DurationKey[];

export function MatrixPicker({
  choice,
  onChange,
  angleCount,
}: {
  choice: MatrixChoice;
  onChange: (next: MatrixChoice) => void;
  angleCount: number;
}) {
  const cost = priceMatrix(choice, angleCount);
  const size = resolutionSpec(choice.resolution);

  return (
    <div className="min-w-0 rounded-sm border border-border bg-rack-rail">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
        <Plate className="min-w-0 truncate">What gets made</Plate>
        <span
          className={cn(
            "tabular shrink-0 text-[11.5px]",
            cost.overCap ? "text-lamp-alert" : "text-muted-foreground",
          )}
        >
          {cost.total} of {MATRIX_CAP} assets
        </span>
      </header>

      {/* The required spec: size and length. */}
      <div className="space-y-3 border-b border-border/70 px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <Plate className="min-w-0 truncate">Size</Plate>
            <EdgeCode className="shrink-0">
              {size.width}×{size.height}
            </EdgeCode>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {RESOLUTION_KEYS.map((key) => {
              const option = RESOLUTIONS[key];
              const active = choice.resolution === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...choice, resolution: key })}
                  className={cn(
                    "min-w-0 rounded-sm border px-2 py-1.5 text-left transition-colors duration-150 ease-out",
                    active
                      ? "border-primary bg-primary/[0.12]"
                      : "border-border hover:border-rack-engrave",
                  )}
                >
                  <span className="block truncate text-[11.5px] font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="tabular block truncate text-[10.5px] text-muted-foreground">
                    {option.ratio}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{size.note}</p>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <Plate className="min-w-0 truncate">Length</Plate>
            <EdgeCode className="shrink-0">{choice.durationSeconds}s</EdgeCode>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {DURATION_KEYS.map((key) => {
              const active = choice.durationSeconds === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...choice, durationSeconds: key })}
                  className={cn(
                    "tabular min-w-0 rounded-sm border px-2 py-1.5 text-[11.5px] font-medium transition-colors duration-150 ease-out",
                    active
                      ? "border-primary bg-primary/[0.12] text-foreground"
                      : "border-border text-foreground/80 hover:border-rack-engrave",
                  )}
                >
                  {key}s
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {DURATIONS[choice.durationSeconds].note}
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {ROWS.map((row) => {
          const Icon = row.icon;
          const checked = choice[row.key];
          return (
            <label
              key={row.key}
              className="flex min-w-0 cursor-pointer items-start gap-3 px-3.5 py-2.5"
            >
              <Icon
                size={14}
                strokeWidth={1.6}
                className={cn("mt-0.5 shrink-0", checked ? "text-primary" : "text-rack-engrave")}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug text-foreground/90">{row.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {row.detail}
                </p>
              </div>
              <Switch
                className="mt-0.5 shrink-0"
                checked={checked}
                onCheckedChange={(value) => onChange({ ...choice, [row.key]: Boolean(value) })}
              />
            </label>
          );
        })}
      </div>

      <footer className="border-t border-border/70 px-3.5 py-2.5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {cost.overCap
            ? `That is over the ${MATRIX_CAP}-asset cap for one press. Drop an angle or turn off the customer-filmed cut.`
            : cost.summary}
        </p>
      </footer>
    </div>
  );
}
