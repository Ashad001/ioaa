/**
 * The test plan, in rounds.
 *
 * One variable per round, and every round states its kill and winner criteria
 * up front, in metrics the ad platform actually reports. When no ad account is
 * connected the plan says it is un-costed rather than inventing a delivery cost
 * — an invented budget is the failure this panel exists to avoid.
 */
import { Plate } from "@/components/rack/plate";
import type { RoundedTestPlan } from "@/lib/admirror/matrix";

export function TestPlanRounds({ plan }: { plan: RoundedTestPlan }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-3 rounded-sm border border-primary/25 bg-primary/[0.06] px-3.5 py-3">
        <div className="min-w-0">
          <Plate className="block">Readability</Plate>
          <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-foreground/90">
            {plan.readabilityNote}
          </p>
        </div>
      </div>

      <ol className="mt-3 space-y-3">
        {plan.rounds.map((round) => (
          <li key={round.round} className="panel min-w-0 rounded-sm">
            <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="tabular shrink-0 rounded-[3px] border border-border px-1.5 py-[2px] text-[11px] text-rack-engrave">
                  round {round.round}
                </span>
                <span className="min-w-0 truncate text-[13px] text-foreground">
                  {round.variableUnderTest}
                </span>
              </div>
              <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                {round.minDays} days minimum
              </span>
            </header>

            <div className="grid gap-x-5 gap-y-3 px-3.5 py-3 sm:grid-cols-2">
              <div className="min-w-0">
                <Plate className="block">Cells</Plate>
                <ul className="mt-1 space-y-0.5">
                  {round.variants.map((cell) => (
                    <li key={cell} className="truncate text-[12px] text-foreground/85">
                      {cell}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <Plate className="block">Held constant</Plate>
                <ul className="mt-1 space-y-0.5">
                  {round.shared.map((item) => (
                    <li key={item} className="text-[12px] leading-relaxed text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <Plate className="block">Read it on</Plate>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {round.primaryMetric}
                </p>
              </div>
              <div className="min-w-0">
                <Plate className="block">Budget per cell</Plate>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {round.dailyBudgetPerVariant ?? "Not captured — your account holds this, not IOAA.AI."}
                </p>
              </div>
              <div className="min-w-0">
                <Plate className="block">Kill it when</Plate>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {round.killCriterion}
                </p>
              </div>
              <div className="min-w-0">
                <Plate className="block">It wins when</Plate>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {round.winnerCriterion}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3 min-w-0 rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
        <Plate className="block">What round one feeds</Plate>
        <p className="mt-1 max-w-[68ch] text-[12px] leading-relaxed text-foreground/85">
          {plan.nextRoundLogic}
        </p>
        <Plate className="mt-3 block">Assumptions</Plate>
        <ul className="mt-1 space-y-0.5">
          {plan.assumptions.map((assumption) => (
            <li key={assumption} className="text-[11.5px] leading-relaxed text-muted-foreground">
              {assumption}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
