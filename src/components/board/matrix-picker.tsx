"use client";

/**
 * The matrix panel on the gate.
 *
 * The brief's rule is that the cost is shown BEFORE the press, not after, and
 * that the default is the smallest test that can actually be read: three hooks
 * on one shared body, plus the statics those frames give away free.
 */
import { Layers2, Image as ImageIcon, Type } from "lucide-react";

import { Plate } from "@/components/rack/plate";
import { Switch } from "@/components/ui/switch";
import { MATRIX_CAP, priceMatrix, type MatrixChoice } from "@/lib/admirror/matrix";
import { cn } from "@/lib/utils";

const ROWS: {
  key: keyof MatrixChoice;
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
    detail: "Doubles the videos. Worth it only when the same angle appears in two formats in your evidence.",
  },
  {
    key: "includeCopyVariants",
    icon: Type,
    label: "Three copy options per ad",
    detail: "Text only — alternative primary text on the same angle, ready to paste.",
  },
];

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

  return (
    <div className="min-w-0 rounded-sm border border-border bg-rack-rail/60">
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
