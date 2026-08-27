import { STEPS } from "@/lib/admirror/pipeline";
import { StepItem } from "@/components/rack/step-item";
import { StepRail } from "@/components/rack/shell";
import type { StepRow } from "@/lib/admirror/queries";

const HREF_FOR: Partial<Record<string, string>> = {
  EVIDENCE_INTAKE: "collect",
  EVIDENCE_RANK: "board",
  TEARDOWN: "board",
  HUMAN_GATE: "board",
  POST: "creative",
  DELIVER: "deliver",
};

export function RunNav({
  runId,
  steps,
  activeStep,
}: {
  runId: string;
  steps: StepRow[];
  activeStep?: string;
}) {
  const byName = new Map(steps.map((step) => [step.name, step]));
  const collected = byName.get("EVIDENCE_RANK")?.state === "done";

  return (
    <StepRail
      footer={
        collected ? (
          <WatchLink runId={runId} active={activeStep === "WATCH"} />
        ) : null
      }
    >
      {STEPS.map((def) => {
        const row = byName.get(def.name);
        const suffix = HREF_FOR[def.name];
        const reachable =
          suffix &&
          (row?.state === "done" || row?.state === "blocked_on_user" || row?.state === "running");
        return (
          <StepItem
            key={def.name}
            n={def.n}
            title={def.title}
            detail={row?.detail ?? def.detail}
            state={row?.state ?? "pending"}
            actor={def.actor}
            href={reachable ? `/runs/${runId}/${suffix}` : undefined}
            active={activeStep === def.name}
          />
        );
      })}
    </StepRail>
  );
}

/**
 * The watchtower sits BELOW the numbered pipeline, not inside it — it isn't a
 * step you finish, it's the thing that runs after every step is done and keeps
 * running as long as the market does.
 */
function WatchLink({ runId, active }: { runId: string; active: boolean }) {
  return (
    <a
      href={`/runs/${runId}/watch`}
      className={
        "flex min-w-0 items-center gap-2.5 border-t border-sidebar-border px-4 py-3 transition-colors duration-150 ease-out hover:bg-sidebar-accent/60 " +
        (active ? "bg-sidebar-accent" : "")
      }
    >
      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-sidebar-foreground">Watchtower</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          What changed since last time
        </span>
      </span>
    </a>
  );
}
