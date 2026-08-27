"use client";

/**
 * THE PERIOD BRIEFING — what moved between two sweeps, in writing.
 *
 * Reading order is the honesty here, and it is enforced by layout rather than by
 * hoping the user scrolls: comparability first, then coverage, and only then any
 * interpretation. A briefing that opens with "3 competitors changed creative"
 * over a sweep that read half as much as the last one is a lie told by ordering.
 */
import { useTransition } from "react";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  Repeat,
  Sparkles,
  Type as TypeIcon,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { sendBriefingDigest } from "@/app/actions/watch";
import { EdgeCode, Lamp, Panel, Plate, type LampState } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BriefingRow } from "@/lib/admirror/queries";
import {
  SIGNAL_LABEL,
  VERDICT_LABEL,
  type Development,
  type Signal,
  type SignalKind,
} from "@/lib/admirror/watchtower";
import { cn } from "@/lib/utils";

const VERDICT_LAMP: Record<string, LampState> = {
  quiet: "cold",
  normal: "hold",
  active: "live",
  not_comparable: "alert",
};

const SIGNAL_ICON: Record<SignalKind, typeof Sparkles> = {
  NEW_CONCEPT: Sparkles,
  REPETITION_UP: Repeat,
  COPY_CHANGED: TypeIcon,
  CREATIVE_CHANGED: RefreshCw,
  LONG_RUNNING: Eye,
  NOT_OBSERVED: EyeOff,
  NEW_ADVERTISER: UserPlus,
  COVERAGE_DROP: CircleAlert,
};

const KIND_TONE: Record<Development["kind"], string> = {
  new: "text-chart-1",
  repeated: "text-lamp-live",
  changed: "text-chart-2",
  absent: "text-muted-foreground",
};

function parse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function PeriodBriefing({
  runId,
  briefing,
  fromLabel,
  toLabel,
  primary = false,
}: {
  runId: string;
  briefing: BriefingRow;
  fromLabel: string | null;
  toLabel: string;
  primary?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const developments = parse<Development[]>(briefing.developments, []);
  const signals = parse<Signal[]>(briefing.signals, []);
  const actions = parse<{ action: string; rationale: string }[]>(briefing.actions, []);
  const suggestions = parse<string[]>(briefing.captureSuggestions, []);

  const verdict = briefing.verdict as keyof typeof VERDICT_LABEL;
  const quiet = verdict === "quiet";

  const signalCounts = new Map<SignalKind, number>();
  for (const signal of signals) {
    signalCounts.set(signal.kind, (signalCounts.get(signal.kind) ?? 0) + 1);
  }

  const send = () => {
    startTransition(async () => {
      const result = await sendBriefingDigest({ runId, briefingId: briefing.id });
      if (result.ok) toast.success("Briefing emailed to you.");
      else toast.message(result.error);
    });
  };

  return (
    <Panel
      className={cn(primary && "ring-1 ring-film-edge/25")}
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Lamp state={VERDICT_LAMP[verdict] ?? "hold"} />
          <span className="min-w-0 truncate">{VERDICT_LABEL[verdict]}</span>
        </span>
      }
      aside={
        <span className="flex shrink-0 items-center gap-2">
          <EdgeCode className="hidden sm:inline">
            {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
          </EdgeCode>
          {briefing.digestSent ? (
            <Tooltip>
              <TooltipTrigger render={<span />} className="text-lamp-live">
                <Mail size={13} strokeWidth={1.6} />
              </TooltipTrigger>
              <TooltipContent>Emailed to you.</TooltipContent>
            </Tooltip>
          ) : quiet || verdict === "not_comparable" ? (
            <Tooltip>
              <TooltipTrigger render={<span />} className="text-muted-foreground">
                <span className="plate">no digest</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p>
                  {briefing.digestSkippedReason ??
                    "Nothing worth an email here. A digest that fires every time gets ignored."}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="sm" onClick={send} disabled={pending}>
              <Mail size={13} strokeWidth={1.6} />
              <span className="min-w-0 truncate">{pending ? "Sending…" : "Email it"}</span>
            </Button>
          )}
        </span>
      }
    >
      <div className="px-4 py-4 sm:px-5">
        {/* 1 — comparability. Nothing below means anything without it. */}
        {!briefing.comparable ? (
          <div className="mb-4 flex min-w-0 items-start gap-2.5 border border-lamp-alert/35 bg-lamp-alert/[0.07] px-3 py-2.5">
            <CircleAlert size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-lamp-alert" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">
                These two sweeps aren&rsquo;t directly comparable.
              </p>
              <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-muted-foreground">
                {briefing.comparabilityNote ??
                  "The conditions differed between the two readings."}{" "}
                Everything below is indicative only, and nothing here moved any ad&rsquo;s status.
              </p>
            </div>
          </div>
        ) : null}

        {/* 2 — coverage. A thinner sweep looks exactly like a quiet market. */}
        <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
          {briefing.coverageNote}
        </p>

        {/* 3 — only now, the reading. */}
        <h3 className="mt-3 max-w-[52ch] text-[17px] font-medium leading-snug tracking-[-0.015em] text-foreground">
          {briefing.headline}
        </h3>

        {signalCounts.size > 0 ? (
          <div className="mt-3.5 flex min-w-0 flex-wrap gap-1.5">
            {[...signalCounts.entries()].map(([kind, count]) => {
              const Icon = SIGNAL_ICON[kind];
              return (
                <span
                  key={kind}
                  className="plate inline-flex min-w-0 items-center gap-1.5 rounded-[3px] border border-border px-1.5 py-1 leading-none text-foreground/80"
                >
                  <Icon size={11} strokeWidth={1.8} className="shrink-0" />
                  <span className="min-w-0 truncate">{SIGNAL_LABEL[kind]}</span>
                  <span className="tabular shrink-0 text-rack-engrave">{count}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {developments.length > 0 ? (
          <ul className="mt-4 space-y-3 border-t border-border/60 pt-4">
            {developments.slice(0, 8).map((development, index) => (
              <li key={`${development.what}-${index}`} className="flex min-w-0 gap-3">
                <ArrowRight
                  size={13}
                  strokeWidth={1.8}
                  className={cn("mt-1 shrink-0", KIND_TONE[development.kind])}
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-snug text-foreground">{development.what}</p>
                  <p className="mt-1 max-w-[66ch] text-xs leading-relaxed text-muted-foreground">
                    {development.interpretation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[62ch] border-t border-border/60 pt-4 text-[13px] leading-relaxed text-muted-foreground">
            Nothing moved enough to write about. That is a real finding, not an empty
            screen — the market held still between these two readings.
          </p>
        )}

        {actions.length > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            <Plate className="block">What to do</Plate>
            <ul className="mt-2 space-y-2">
              {actions.map((action) => (
                <li key={action.action} className="min-w-0">
                  <p className="text-[13px] leading-snug text-foreground">{action.action}</p>
                  <p className="mt-0.5 max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
                    {action.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            <Plate className="block">Make the next sweep better</Plate>
            <ul className="mt-2 space-y-1.5">
              {suggestions.map((suggestion) => (
                <li key={suggestion} className="flex min-w-0 gap-2">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 max-w-[64ch] text-xs leading-relaxed text-foreground/85">
                    {suggestion}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-4 max-w-[68ch] border-t border-border/60 pt-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {briefing.limitations}
        </p>
      </div>
    </Panel>
  );
}
