import { StepItem } from "@/components/rack/step-item";
import { StepRail } from "@/components/rack/shell";
import { rollUp, STAGES, STAGE_FOR_STEP } from "@/lib/admirror/stages";
import type { StepRow } from "@/lib/admirror/queries";

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
  const activeStage = activeStep ? STAGE_FOR_STEP[activeStep] : undefined;

  return (
    <StepRail footer={collected ? <WatchLink runId={runId} active={activeStep === "WATCH"} /> : null}>
      {STAGES.map((stage) => {
        const { state, detail } = rollUp(stage, byName);
        const reachable =
          stage.id === "market" ||
          state === "done" ||
          state === "blocked_on_user" ||
          state === "running";
        return (
          <StepItem
            key={stage.id}
            n={stage.n}
            title={stage.title}
            detail={detail}
            state={state}
            actor={stage.actor}
            href={reachable ? (stage.href ? `/runs/${runId}/${stage.href}` : `/runs/${runId}`) : undefined}
            active={activeStage === stage.id}
          />
        );
      })}
    </StepRail>
  );
}

function WatchLink({ runId, active }: { runId: string; active: boolean }) {
  return (
    <a
      href={`/runs/${runId}/watch`}
      className={
        "flex min-w-0 items-center gap-2.5 border-t border-sidebar-border px-4 py-3 transition-colors duration-150 ease-out hover:bg-sidebar-accent/60 " +
        (active ? "bg-sidebar-accent" : "")
      }
    >
      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-primary shadow-[0_0_8px_-1px_currentColor]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-sidebar-foreground">Watchtower</span>
        <span className="block truncate text-[11px] text-muted-foreground">What changed since last time</span>
      </span>
      <span className="font-mono text-[10px] text-primary">LIVE</span>
    </a>
  );
}
