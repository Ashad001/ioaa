"use client";

/**
 * Your own account averages — the thing every verdict in the loop is measured
 * against.
 *
 * WHY THIS PANEL EXISTS AT ALL. A 22% hold rate is strong in one account and
 * weak in another, so an absolute rate cannot produce a verdict. AdMirror has
 * exactly two honest comparisons available: the averages the user types here, and
 * the middle of the user's own other ads. It has NO third option — there is no
 * industry benchmark it could know, and inventing one would be the same sin as
 * inventing a competitor's spend.
 *
 * So when both are missing, the app says "nothing to compare this to yet" rather
 * than reaching for a number. This panel is how the user removes that state.
 */
import { useState, useTransition } from "react";
import { Check, Gauge } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { saveBaseline } from "@/app/actions/outcome";
import { Panel, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BaselineRow } from "@/lib/admirror/queries";

export function BaselinePanel({
  baseline,
  activeBasis,
}: {
  baseline: BaselineRow | null;
  /** What the app is comparing against RIGHT NOW, so the panel can say so. */
  activeBasis: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState({
    thumbstopPct: baseline?.thumbstopPct ?? "",
    holdPct: baseline?.holdPct ?? "",
    clickThroughPct: baseline?.clickThroughPct ?? "",
    costPerResult: baseline?.costPerResult ?? "",
    currency: baseline?.currency ?? "",
    basisNote: baseline?.basisNote ?? "",
  });

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const save = () => {
    startTransition(async () => {
      const result = await saveBaseline(fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your averages are saved. Every reading is indexed against them now.");
      router.refresh();
    });
  };

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Gauge size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">Your own normal</span>
        </span>
      }
    >
      <div className="min-w-0 px-4 py-4">
        <p className="max-w-[58ch] text-[12.5px] leading-relaxed text-muted-foreground">
          Type your account&rsquo;s own averages and every reading gets indexed against
          them. Leave them blank and AdMirror compares against the middle of your own
          other ads instead — it will never compare you to an industry figure, because
          there isn&rsquo;t one it could honestly know.
        </p>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <PctField
            id="base-thumbstop"
            label="Scroll-stop rate"
            hint="Views that watched a quarter"
            value={fields.thumbstopPct}
            onChange={set("thumbstopPct")}
          />
          <PctField
            id="base-hold"
            label="Hold rate"
            hint="Of those, how many reached three-quarters"
            value={fields.holdPct}
            onChange={set("holdPct")}
          />
          <PctField
            id="base-click"
            label="Click rate"
            value={fields.clickThroughPct}
            onChange={set("clickThroughPct")}
          />
          <div className="min-w-0">
            <Label htmlFor="base-cost" className="plate block text-rack-engrave">
              <span className="min-w-0 truncate">Cost per result</span>
            </Label>
            <div className="mt-1.5 flex min-w-0 gap-2">
              <Input
                id="base-cost"
                inputMode="decimal"
                value={fields.costPerResult}
                onChange={(event) => set("costPerResult")(event.target.value)}
                placeholder="—"
                className="tabular min-w-0 flex-1"
              />
              <Input
                aria-label="Currency"
                value={fields.currency}
                onChange={(event) => set("currency")(event.target.value)}
                placeholder="AED"
                className="w-20 shrink-0"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <Label htmlFor="base-note" className="plate block text-rack-engrave">
            <span className="min-w-0 truncate">Where these came from</span>
          </Label>
          <Input
            id="base-note"
            value={fields.basisNote}
            onChange={(event) => set("basisNote")(event.target.value)}
            placeholder="Last 90 days, all campaigns"
            className="mt-1.5"
          />
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending} variant="secondary">
            <Check size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">{pending ? "Saving…" : "Save my averages"}</span>
          </Button>
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <Plate className="block">Comparing against now</Plate>
          <p className="mt-1 max-w-[58ch] text-[11.5px] leading-relaxed text-muted-foreground">
            {activeBasis}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function PctField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="plate block text-rack-engrave">
        <span className="min-w-0 truncate">{label}</span>
      </Label>
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="—"
          className="tabular min-w-0 flex-1"
        />
        <span className="shrink-0 text-[13px] text-muted-foreground">%</span>
      </div>
      {hint ? (
        <p className="mt-1 min-w-0 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
