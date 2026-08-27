import { StepItem } from "@/components/rack/step-item";
import { StepRail } from "@/components/rack/shell";
import { rollUp, STAGES, STAGE_FOR_STEP } from "@/lib/admirror/stages";
import type { StepRow } from "@/lib/admirror/queries";

/**
 * The rail shows the FIVE stages the user has, not the fifteen the engine runs.
 *
 * The engine's internal steps are all still recorded and all still visible on the
 * timeline — this is a rollup for the person, not a reduction of the machine. A
 * row here is somewhere they either act or look; anything they neither influence
 * nor read was noise competing with the two rows that decide what they do next.
 */
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
    <StepRail
      footer={
        collected ? (
          <WatchLink runId={runId} active={activeStep === "WATCH"} />
        ) : null
      }
    >
      {STAGES.map((stage) => {
        const { state, detail } = rollUp(stage, byName);
        // A stage is reachable once it has actually started — a link to a screen
        // with nothing on it is worse than no link. The profile stage is the one
        // exception: it is where the user DECIDES what gets collected, so it must
        // be reachable from the first moment rather than after something ran.
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
            href={
              reachable
                ? stage.href
                  ? `/runs/${runId}/${stage.href}`
                  : `/runs/${runId}`
                : undefined
            }
            active={activeStage === stage.id}
          />
        );
      })}
    </StepRail>
  );
}

/**
 * The watchtower sits BELOW the numbered stages, not inside them — it isn't a
 * stage you finish, it's the thing that runs after every stage is done and keeps
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
