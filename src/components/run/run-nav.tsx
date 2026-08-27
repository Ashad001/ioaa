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

  return (
    <StepRail>
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
