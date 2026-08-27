"use client";

/**
 * The standing watch: how often to look again, and when the next look is due.
 *
 * The honest thing to say on this panel, and it is said out loud: this schedules
 * a NUDGE. Nothing in AdMirror wakes up and asks Meta for anything — a reminder
 * fires, and the sweep happens because a person pressed the button.
 */
import { useState, useTransition } from "react";
import { BellRing, Mail, Telescope } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { setWatch } from "@/app/actions/watch";
import { EdgeCode, Panel, Plate, Readout } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WatchRow } from "@/lib/admirror/queries";

const CADENCES = [
  { value: "7", label: "Weekly" },
  { value: "14", label: "Fortnightly" },
  { value: "30", label: "Monthly" },
];

export function WatchControl({
  runId,
  watch,
  lastSweptLabel,
  overdue = false,
}: {
  runId: string;
  watch: WatchRow | null;
  lastSweptLabel: string;
  /** Worked out on the server, so this panel never reads the clock as it draws. */
  overdue?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(watch?.enabled ?? false);
  const [cadence, setCadence] = useState(watch?.cadenceDays ?? "14");
  const [digest, setDigest] = useState(watch?.emailDigest ?? false);

  const save = (next: { enabled?: boolean; cadence?: string; digest?: boolean }) => {
    const payload = {
      runId,
      enabled: next.enabled ?? enabled,
      cadenceDays: next.cadence ?? cadence,
      emailDigest: next.digest ?? digest,
    };
    startTransition(async () => {
      const result = await setWatch(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(payload.enabled ? "Watch is on." : "Watch is off.");
      router.refresh();
    });
  };

  const due = watch?.nextReminderAt
    ? watch.nextReminderAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Telescope size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">Standing watch</span>
        </span>
      }
      aside={
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={(value) => {
            setEnabled(value);
            save({ enabled: value });
          }}
          aria-label="Keep watching this market"
        />
      }
    >
      <div className="px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Readout label="Last swept" value={lastSweptLabel} />
          <Readout
            label="Next look due"
            value={enabled ? due : "Not scheduled"}
            hint={overdue ? "Due now — worth sweeping again." : undefined}
          />
        </div>

        <div className="mt-4 min-w-0">
          <Plate className="block">How often</Plate>
          <ToggleGroup
            className="mt-2 w-full"
            value={[cadence]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (!next || next === cadence) return;
              setCadence(next);
              save({ cadence: next });
            }}
          >
            {CADENCES.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                disabled={pending}
                className="min-w-0 flex-1"
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <label className="mt-4 flex min-w-0 items-start gap-3 border-t border-border/60 pt-4">
          <Switch
            checked={digest}
            disabled={pending}
            onCheckedChange={(value) => {
              setDigest(value);
              save({ digest: value });
            }}
            aria-label="Email me the briefing"
          />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-foreground">
              <Mail size={12} strokeWidth={1.7} className="shrink-0" />
              Email me the briefing
            </span>
            <span className="mt-1 block max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
              Only when a period actually moved. A quiet period sends nothing, on purpose.
            </span>
          </span>
        </label>

        <div className="mt-4 flex min-w-0 items-start gap-2.5 border-t border-border/60 pt-3.5">
          <BellRing size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-rack-engrave" />
          <p className="min-w-0 max-w-[52ch] text-[11.5px] leading-relaxed text-muted-foreground">
            This schedules a reminder, not a background fetch. Nothing here wakes up and
            asks Meta for anything — the sweep happens when you press it.
          </p>
        </div>

        {enabled ? (
          <div className="mt-3">
            <EdgeCode>every {cadence} days</EdgeCode>
          </div>
        ) : (
          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() => {
              setEnabled(true);
              save({ enabled: true });
            }}
          >
            <span className="min-w-0 truncate">Keep watching this market</span>
          </Button>
        )}
      </div>
    </Panel>
  );
}
