"use client";

/**
 * Reporting what an ad actually did — raw counts, straight off the user's own
 * dashboard.
 *
 * WHY COUNTS AND NOT RATES. Asking for "your CTR" would be one field instead of
 * two, and it would also make every downstream honesty rule impossible: a rate
 * with no denominator can't be re-derived when the next reading arrives, can't be
 * checked, and — crucially — can't refuse itself for thin volume. The whole
 * "not enough views to say" protection depends on knowing the view count.
 *
 * The video boxes are optional and marked so. Without them IOAA.AI can still
 * tell you whether the ad worked; it cannot tell you WHICH PART of it worked, and
 * the panel says exactly that rather than quietly guessing.
 */
import { useState, useTransition } from "react";
import { Check, ChevronDown, Film } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { reportResult } from "@/app/actions/outcome";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_IMPRESSIONS_FOR_DIAGNOSIS } from "@/lib/admirror/outcome";
import { cn } from "@/lib/utils";

const EMPTY = {
  daysLive: "",
  impressions: "",
  reach: "",
  clicks: "",
  amountSpent: "",
  currency: "",
  results: "",
  resultLabel: "",
  videoPlays: "",
  watched25: "",
  watched75: "",
  watched100: "",
};

export function ReportForm({
  shippedAdId,
  compact = false,
  onDone,
}: {
  shippedAdId: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(EMPTY);
  const [videoOpen, setVideoOpen] = useState(false);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (!fields.impressions.trim()) {
      toast.error("Add the view count — it's what decides whether there's enough here to read.");
      return;
    }
    startTransition(async () => {
      const result = await reportResult({ shippedAdId, ...fields });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Numbers filed. The reading is below.");
      setFields(EMPTY);
      setVideoOpen(false);
      onDone?.();
      router.refresh();
    });
  };

  return (
    <div className={cn("min-w-0", compact ? "px-4 py-4" : "px-4 py-5 sm:px-6")}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          id={`imp-${shippedAdId}`}
          label="Views"
          hint="Required — everything else is weighed against this"
          value={fields.impressions}
          onChange={set("impressions")}
        />
        <NumberField
          id={`days-${shippedAdId}`}
          label="Days running"
          value={fields.daysLive}
          onChange={set("daysLive")}
        />
        <NumberField
          id={`clicks-${shippedAdId}`}
          label="Clicks"
          value={fields.clicks}
          onChange={set("clicks")}
        />
        <NumberField
          id={`spend-${shippedAdId}`}
          label="Amount spent"
          hint="Your own currency"
          value={fields.amountSpent}
          onChange={set("amountSpent")}
        />
        <NumberField
          id={`results-${shippedAdId}`}
          label="Results"
          hint="Purchases, leads — whatever you're counting"
          value={fields.results}
          onChange={set("results")}
        />
        <div className="min-w-0">
          <Label htmlFor={`rlabel-${shippedAdId}`} className="plate block text-rack-engrave">
            What counts as a result
          </Label>
          <Input
            id={`rlabel-${shippedAdId}`}
            value={fields.resultLabel}
            onChange={(event) => set("resultLabel")(event.target.value)}
            placeholder="Purchases"
            className="mt-1.5"
          />
        </div>
      </div>

      <Collapsible open={videoOpen} onOpenChange={setVideoOpen} className="mt-4 min-w-0">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
            />
          }
        >
          <Film size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">
            Video view counts — optional, but the only way to tell a hook problem from a body one
          </span>
          <ChevronDown
            size={13}
            strokeWidth={1.7}
            className={cn(
              "shrink-0 transition-transform duration-200 ease-out",
              videoOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              id={`plays-${shippedAdId}`}
              label="Video plays"
              value={fields.videoPlays}
              onChange={set("videoPlays")}
            />
            <NumberField
              id={`w25-${shippedAdId}`}
              label="Watched 25%"
              hint="Tests the hook"
              value={fields.watched25}
              onChange={set("watched25")}
            />
            <NumberField
              id={`w75-${shippedAdId}`}
              label="Watched 75%"
              hint="Tests the body"
              value={fields.watched75}
              onChange={set("watched75")}
            />
            <NumberField
              id={`w100-${shippedAdId}`}
              label="Watched to the end"
              value={fields.watched100}
              onChange={set("watched100")}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          <Check size={14} strokeWidth={1.8} />
          <span className="min-w-0 truncate">{pending ? "Filing…" : "File these numbers"}</span>
        </Button>
        <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Under {MIN_IMPRESSIONS_FOR_DIAGNOSIS.toLocaleString("en-GB")} views IOAA.AI files
          the reading and says it&rsquo;s too early to draw anything from — it won&rsquo;t
          invent a verdict to fill the space.
        </p>
      </div>
    </div>
  );
}

function NumberField({
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
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="—"
        className="tabular mt-1.5"
      />
      {hint ? (
        <p className="mt-1 min-w-0 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
