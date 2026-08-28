import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, LineChart } from "lucide-react";

import { Counter, EdgeCode, Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { PatternGrid } from "@/components/patterns/pattern-grid";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { getPatterns } from "@/lib/admirror/queries";
import { MIN_N_FOR_PATTERN, PATTERN_THIN_RULE } from "@/lib/admirror/outcome";

export const metadata = {
  title: "Patterns",
  description:
    "Which hook mechanisms have actually held up in your category and market, with the sample size shown on every cell.",
};

export default async function PatternsPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const rows = await getPatterns(user.id);

  const cells = rows.map((row) => ({
    id: row.id,
    mechanism: row.mechanism,
    formatLabel: row.formatLabel,
    categoryLabel: row.categoryLabel,
    marketLabel: row.marketLabel,
    shippedCount: Number(row.shippedCount) || 0,
    measuredCount: Number(row.measuredCount) || 0,
    thumbstopIndex: row.thumbstopIndex === "" ? null : Number(row.thumbstopIndex),
    holdIndex: row.holdIndex === "" ? null : Number(row.holdIndex),
    clickIndex: row.clickIndex === "" ? null : Number(row.clickIndex),
    costIndex: row.costIndex === "" ? null : Number(row.costIndex),
    standing: row.standing as "outperformed" | "inline" | "underperformed" | "too_thin",
  }));

  const readable = cells.filter((cell) => cell.standing !== "too_thin");
  const totalShipped = cells.reduce((sum, cell) => sum + cell.shippedCount, 0);
  const totalMeasured = cells.reduce((sum, cell) => sum + cell.measuredCount, 0);

  return (
    <RackShell
      crumb="Patterns"
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href="/results" />}>
            <span className="min-w-0 truncate">Results</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/library" />}>
            <span className="min-w-0 truncate">Your runs</span>
          </Button>
        </>
      }
    >
      <PaneHeader
        title="Patterns"
        hint="Which hook mechanisms have held up for you — built only from ads you shipped and measured."
        actions={<EdgeCode>{cells.length} cells</EdgeCode>}
      />

      <div className="flex min-w-0 items-start gap-3 border-b border-film-edge/25 bg-film-edge/[0.06] px-4 py-3 sm:px-6">
        <LineChart size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-chart-1" />
        <p className="min-w-0 max-w-[80ch] text-[13px] leading-relaxed text-foreground">
          {PATTERN_THIN_RULE}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6 xl:px-8">
          <div className="mb-5 flex min-w-0 flex-wrap items-end gap-x-8 gap-y-4 border-b border-border/70 pb-4">
            <Counter value={totalShipped} label="Ads shipped" />
            <Counter value={totalMeasured} label="With real numbers" />
            <Counter value={readable.length} label="Cells thick enough to read" />
          </div>

          {cells.length === 0 ? (
            <Panel label="No patterns yet">
              <div className="max-w-[64ch] px-4 py-6">
                <p className="text-[13.5px] leading-relaxed text-foreground/85">
                  This is the asset no single run can produce: after enough shipped ads,
                  IOAA.AI can tell you that a particular kind of hook has actually held up
                  in your category and market — from your own results, not from anybody&rsquo;s
                  case study.
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  It needs {MIN_N_FOR_PATTERN} measured ads per pattern before it shows a
                  number. Until then the cells stay empty, which is the honest state — a
                  believable figure built on two ads would be the most dangerous thing this
                  screen could show you.
                </p>
                <Button className="mt-4" render={<Link href="/results" />}>
                  <Layers size={14} strokeWidth={1.7} />
                  <span className="min-w-0 truncate">Go to results</span>
                </Button>
              </div>
            </Panel>
          ) : (
            <div className="min-w-0 space-y-5">
              <PatternGrid cells={cells} />

              <Panel label="How to read this">
                <div className="max-w-[70ch] px-4 py-4">
                  <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-foreground/85">
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        Every figure is a median index against your own account average, so
                        130% means half the ads in that cell came in a third better than
                        your normal.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        A cell counts your ads only. Nothing a competitor ran is in here —
                        Meta publishes no cost or conversion figures for their ads, so there
                        is nothing comparable to aggregate.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        A pattern is a prior, not a rule. It tells you where to start the
                        next test, not what the next test will find.
                      </span>
                    </li>
                  </ul>
                  <Plate className="mt-4 block border-t border-border/60 pt-3">
                    {PATTERN_THIN_RULE}
                  </Plate>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </RackShell>
  );
}
