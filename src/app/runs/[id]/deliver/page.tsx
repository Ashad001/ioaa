import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RunNav } from "@/components/run/run-nav";
import { ExportButtons } from "@/components/deliver/export-buttons";
import { ProvenanceRecord } from "@/components/deliver/provenance-record";
import { TestPlanRounds } from "@/components/deliver/test-plan-rounds";
import { Panel, Plate, Readout } from "@/components/rack/plate";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import {
  buildProvenanceRecord,
  countSharedBodies,
  parseGates,
} from "@/lib/admirror/deliver";
import { getBatches, getGate, getItems, getRun, getSteps, getVariants } from "@/lib/admirror/queries";

export default async function DeliverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, variants, items, gate, batches] = await Promise.all([
    getSteps(id),
    getVariants(id),
    getItems(id),
    getGate(id),
    getBatches(id),
  ]);

  const record = buildProvenanceRecord({ variants, items });
  const gates = variants[0] ? parseGates(variants[0]) : {};
  const plan = gates.roundedPlan ?? null;
  const bodies = countSharedBodies(variants);
  const held = record.filter((line) => line.blockedBy).length;
  const closed = batches.filter((batch) => batch.state === "closed");

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · handoff
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="DELIVER" />}
      actions={
        <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/creative`} />}>
          <span className="min-w-0 truncate">Back to variants</span>
        </Button>
      }
    >
      <PaneHeader
        title="Handoff"
        hint="Everything the buyer needs, and a record of where each angle came from."
        actions={variants.length > 0 ? <ExportButtons runId={id} /> : null}
      />
      <SourceModeNotice
        detail={
          gate
            ? `Angles chosen at coverage ${gate.coverageBandAtGate} (${Number(gate.coverageAtGate).toFixed(2)})${
                gate.forced ? " — you chose to generate from a partial view" : ""
              }`
            : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6">
          {variants.length === 0 ? (
            <div className="max-w-[56ch] py-10">
              <Plate className="block">Nothing to hand over yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Pick your angles on the evidence board and press Force generation. The handoff builds
                itself from what comes out.
              </p>
              <Button className="mt-4" render={<Link href={`/runs/${id}/board`} />}>
                Go to the board
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <Panel label="What you're taking away">
                <div className="grid gap-4 px-4 py-4 sm:grid-cols-4">
                  <Readout label="Assets" value={String(variants.length)} hint="briefs and statics" />
                  <Readout
                    label="Shared bodies"
                    value={String(bodies)}
                    hint="one per angle and format"
                  />
                  <Readout
                    label="Captures behind it"
                    value={String(closed.length)}
                    hint={`${items.length} ads submitted`}
                  />
                  <Readout
                    label="Held by a gate"
                    value={held > 0 ? String(held) : "none"}
                    hint={held > 0 ? "shown, never dropped" : "all cleared"}
                  />
                </div>
              </Panel>

              {plan ? (
                <section className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <h2 className="text-[14px] font-medium tracking-[-0.01em]">The test plan</h2>
                    <Plate>one variable per round</Plate>
                  </div>
                  <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-muted-foreground">
                    Round one moves the hook and nothing else, because a round that moves two things
                    at once can&rsquo;t be read afterwards.
                  </p>
                  <div className="mt-3">
                    <TestPlanRounds plan={plan} />
                  </div>
                </section>
              ) : null}

              <section className="min-w-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h2 className="text-[14px] font-medium tracking-[-0.01em]">
                    Where every asset came from
                  </h2>
                  <Plate>travels with the export</Plate>
                </div>
                <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-muted-foreground">
                  Each row names the ad whose angle it inherited and the day you saw it. What crossed
                  over is structure — the hook mechanism, the objection, the beat order. Their footage,
                  voice, talent and marks did not.
                </p>
                <div className="panel mt-3 rounded-sm">
                  <ProvenanceRecord lines={record} />
                </div>
              </section>

              {record.some((line) => line.warnings.length > 0) ? (
                <Panel label="Worth eyeballing before you launch">
                  <ul className="space-y-2 px-4 py-4">
                    {[...new Set(record.flatMap((line) => line.warnings))].map((warning) => (
                      <li
                        key={warning}
                        className="max-w-[70ch] text-[12.5px] leading-relaxed text-foreground/85"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </RackShell>
  );
}
