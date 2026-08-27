import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { RunNav } from "@/components/run/run-nav";
import { VariantPanel } from "@/components/creative/variant-panel";
import { Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import type { AngleBrief, TestPlan } from "@/lib/admirror/generate";
import { getGate, getItems, getRun, getSteps, getVariants } from "@/lib/admirror/queries";

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, variants, gate, items] = await Promise.all([
    getSteps(id),
    getVariants(id),
    getGate(id),
    getItems(id),
  ]);

  const firstGates = variants[0]?.gates ? JSON.parse(variants[0].gates) : {};
  const testPlan: TestPlan | null = firstGates.testPlan ?? null;
  const brief: AngleBrief | null = firstGates.angleBrief ?? null;
  const sourceItem = items.find((item) => item.id === variants[0]?.sourceItemId) ?? null;
  // The shared-body rule, made visible: one body per angle × format, never one
  // per hook. If this number equalled the video count, the test would be
  // measuring uncontrolled variation instead of the hook.
  const sharedBodies = new Set(
    variants.filter((row) => row.assetKind === "video").map((row) => row.sharedBodyKey),
  ).size;

  // Group variants by the evidence item whose angle they inherited.
  const bySource = new Map<string, typeof variants>();
  for (const variant of variants) {
    const key = variant.sourceItemId ?? "unknown";
    const existing = bySource.get(key);
    if (existing) existing.push(variant);
    else bySource.set(key, [variant]);
  }

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · creative
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="POST" />}
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/board`} />}>
            <span className="min-w-0 truncate">Back to board</span>
          </Button>
          {variants.length > 0 ? (
            <Button size="sm" render={<Link href={`/runs/${id}/deliver`} />}>
              <span className="min-w-0 truncate">Handoff</span>
            </Button>
          ) : null}
        </>
      }
    >
      <PaneHeader
        title="Your variants"
        hint="Three hooks over one shared body. Their structure, your words."
        actions={
          variants.length > 0 ? (
            <span className="plate text-rack-engrave">
              {variants.length} asset{variants.length === 1 ? "" : "s"} · {sharedBodies} shared bod
              {sharedBodies === 1 ? "y" : "ies"}
            </span>
          ) : null
        }
      />
      {gate ? (
        <SourceModeNotice
          detail={`Angle selected at coverage ${gate.coverageBandAtGate} (${Number(gate.coverageAtGate).toFixed(2)})${
            gate.forced ? " — you chose to generate from a partial view" : ""
          }`}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6">
          {variants.length === 0 ? (
            <div className="max-w-[56ch] py-10">
              <Plate className="block">Nothing generated yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Pick the angles you want on the evidence board and press Force generation.
              </p>
              <Button className="mt-4" render={<Link href={`/runs/${id}/board`} />}>Go to the board</Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_312px]">
              <div className="min-w-0 space-y-6">
                {[...bySource.entries()].map(([sourceId, group]) => {
                  const source = items.find((item) => item.id === sourceId) ?? null;
                  return (
                    <section key={sourceId}>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Plate>Angle inherited from</Plate>
                        <span className="min-w-0 truncate text-[13px] text-foreground">
                          {source?.advertiser || "an ad you submitted"}
                        </span>
                        {source?.libraryUrl ? (
                          <a
                            href={source.libraryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 text-[11px] text-primary"
                          >
                            Source ad
                            <ExternalLink size={11} strokeWidth={1.8} />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-1.5 max-w-[68ch] text-[11.5px] leading-relaxed text-muted-foreground">
                        Only the first three seconds differ between these hooks — everything from 0:02
                        is one body, written once, so the test reads the hook and nothing else.
                      </p>
                      <div className="mt-3 space-y-3">
                        {group.map((variant) => (
                          <VariantPanel key={variant.id} variant={variant} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="min-w-0 space-y-4">
                {brief ? (
                  <Panel label="What transferred">
                    <div className="space-y-3 px-4 py-4">
                      <Field label="Angle" value={brief.angle} />
                      <Field label="Hook mechanism" value={brief.hookMechanism} />
                      <Field label="Objection handled" value={brief.objection} />
                      <Field label="Offer shape" value={brief.offerShape} />
                      <div>
                        <Plate className="block">Guardrails</Plate>
                        <ul className="mt-1.5 space-y-1">
                          {brief.guardrails.map((rule) => (
                            <li key={rule} className="text-[12px] leading-relaxed text-foreground/85">
                              {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {sourceItem ? (
                        <p className="border-t border-border/70 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                          Nothing from {sourceItem.advertiser || "the source ad"}&rsquo;s media, voice or marks
                          is used here. The angle transferred; the assets did not.
                        </p>
                      ) : null}
                    </div>
                  </Panel>
                ) : null}

                {testPlan ? (
                  <Panel label="Test plan">
                    <div className="space-y-3.5 px-4 py-4">
                      <Field label="Hypothesis" value={testPlan.hypothesis} />
                      <Field label="Structure" value={testPlan.structure} />
                      <div>
                        <Plate className="block">Cells</Plate>
                        <div className="mt-1.5 divide-y divide-border/60 rounded-sm border border-border">
                          {testPlan.cells.map((cell) => (
                            <div key={cell.name} className="min-w-0 px-3 py-2">
                              <p className="truncate text-[12.5px] text-foreground/90">{cell.name}</p>
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                {cell.changeVsControl}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Field label="When to read it" value={testPlan.readWhen} />
                      <p className="border-t border-border/70 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                        {testPlan.honestyNote}
                      </p>
                    </div>
                  </Panel>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </RackShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Plate className="block">{label}</Plate>
      <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/90">{value}</p>
    </div>
  );
}
