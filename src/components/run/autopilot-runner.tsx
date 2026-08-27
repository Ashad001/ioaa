"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw, Radar, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { autoCollect, autoResearch, resweep } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/rack/plate";
import { FetchTicker } from "@/components/run/fetch-ticker";

type Phase = "idle" | "discovering" | "collecting" | "done" | "failed";

const PHASE_COPY: Record<Phase, string> = {
  idle: "Ready to read your competitor list",
  discovering: "Finding advertisers for this older run…",
  collecting: "Reading named competitors’ live ads…",
  done: "Competitor collection finished",
  failed: "Collection stopped",
};

export function AutopilotRunner({
  runId,
  hasCompetitors,
  hasEvidence,
  awaitingGate,
}: {
  runId: string;
  hasCompetitors: boolean;
  hasEvidence: boolean;
  awaitingGate: boolean;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>(hasEvidence ? "done" : "idle");
  const [problem, setProblem] = useState<string | null>(null);

  const run = useCallback(
    async (options: { fromDiscovery: boolean }) => {
      setProblem(null);

      if (options.fromDiscovery) {
        setPhase("discovering");
        const research = await autoResearch(runId);
        if (!research.ok) {
          setPhase("failed");
          setProblem(research.error);
          router.refresh();
          return;
        }
        router.refresh();
      }

      setPhase("collecting");
      const collected = await autoCollect(runId);
      if (!collected.ok) {
        setPhase("failed");
        setProblem(collected.error);
        router.refresh();
        return;
      }

      setPhase("done");
      router.refresh();
      toast.success("Competitor ads collected and ranked — your board is ready.");
    },
    [router, runId],
  );

  useEffect(() => {
    if (started.current || hasEvidence) return;
    started.current = true;
    void run({ fromDiscovery: !hasCompetitors });
  }, [hasCompetitors, hasEvidence, run]);

  const busy = phase === "discovering" || phase === "collecting";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-[5px] flex shrink-0 items-center">
          <Lamp
            state={phase === "failed" ? "alert" : phase === "done" ? "done" : "hold"}
            pulsing={busy}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-relaxed text-foreground/90">{PHASE_COPY[phase]}</p>
          {busy ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Each advertiser takes about forty seconds to read. You can leave this page and come
              back—your collection keeps its place.
            </p>
          ) : null}
        </div>
      </div>

      <FetchTicker runId={runId} active={busy} className="pt-1" />

      {problem ? (
        <div className="flex min-w-0 items-start gap-2.5 rounded-sm border border-lamp-alert/40 bg-lamp-alert/[0.07] px-3 py-2.5">
          <TriangleAlert size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-lamp-alert" />
          <p className="min-w-0 text-[12.5px] leading-relaxed text-foreground/90">{problem}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {awaitingGate || phase === "done" ? (
          <Button size="sm" onClick={() => router.push(`/runs/${runId}/board`)}>
            <span className="min-w-0 truncate">See the board</span>
            <ArrowRight size={14} strokeWidth={1.8} />
          </Button>
        ) : null}

        {!busy ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                setPhase("collecting");
                setProblem(null);
                const result = hasEvidence ? await resweep(runId) : await autoCollect(runId);
                if (!result.ok) {
                  setPhase("failed");
                  setProblem(result.error);
                } else {
                  setPhase("done");
                  toast.success("Competitor ads refreshed — your board is up to date.");
                }
                router.refresh();
              })();
            }}
          >
            {hasEvidence ? (
              <>
                <RefreshCw size={14} strokeWidth={1.7} />
                <span className="min-w-0 truncate">Refresh competitors</span>
              </>
            ) : (
              <>
                <Radar size={14} strokeWidth={1.7} />
                <span className="min-w-0 truncate">Collect now</span>
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
