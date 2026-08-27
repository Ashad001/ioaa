import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ensureResearch } from "@/lib/admirror/ensure";
import { CompetitorMap } from "@/components/run/competitor-map";
import { RunNav } from "@/components/run/run-nav";
import { Lamp, Panel, Plate, Readout } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import type { Dossier } from "@/lib/admirror/pipeline";
import { getCompetitors, getRun, getSearches, getSteps } from "@/lib/admirror/queries";

export default async function RunConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  // Steps 2–3 run unattended on first open — the console doing its job, not a
  // button the user has to find. This is a plain function, not a server action:
  // an action revalidates, and Next refuses that during render.
  await ensureResearch(current);

  const [fresh, steps, competitors, searches] = await Promise.all([
    getRun(id, user.id),
    getSteps(id),
    getCompetitors(id),
    getSearches(id),
  ]);
  if (!fresh) notFound();

  const dossier: Dossier | null = fresh.dossier ? (JSON.parse(fresh.dossier) as Dossier) : null;
  const objectives = fresh.objectives.split(",").filter(Boolean);
  const planBuilt = searches.some((row) => row.origin === "plan");

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {fresh.brandName} · {fresh.marketLabel}
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="COMPETITOR_MAP" />}
      actions={
        planBuilt ? (
          <Button size="sm" render={<Link href={`/runs/${id}/collect`} />}><span className="min-w-0 truncate">Go and capture</span></Button>
        ) : null
      }
    >
      <PaneHeader
        title="Research console"
        hint="Steps 1–4 run without you. Step 5 is yours."
        actions={
          <span className="plate flex items-center gap-2 text-rack-engrave">
            <Lamp state={planBuilt ? "done" : "hold"} pulsing={!planBuilt} />
            {fresh.status.replace(/_/g, " ").toLowerCase()}
          </span>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              {dossier ? (
                <Panel label="Brand read" aside={<span className="plate text-rack-engrave">step 02</span>}>
                  <div className="space-y-4 px-4 py-4">
                    <p className="max-w-[65ch] text-[13.5px] leading-relaxed text-foreground/90">
                      {dossier.positioning}
                    </p>

                    <div>
                      <Plate className="block">Who it&rsquo;s for</Plate>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dossier.icp.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[12px] text-foreground/85"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <Plate className="block">Voice</Plate>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">
                          {dossier.voice}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <Plate className="block">Proof this market wants</Plate>
                        <ul className="mt-1.5 space-y-1">
                          {dossier.proofShape.map((proof) => (
                            <li key={proof} className="flex gap-2 text-[13px] leading-relaxed text-foreground/85">
                              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-rack-seam" />
                              <span className="min-w-0">{proof}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="border-t border-border/70 pt-3 text-[12px] leading-relaxed text-muted-foreground">
                      Read confidence: {dossier.confidence}. {dossier.basis}
                    </p>
                  </div>
                </Panel>
              ) : null}

              <Panel
                label="Competitor map"
                aside={<span className="plate text-rack-engrave">step 03</span>}
              >
                <div className="px-4 py-4">
                  <CompetitorMap runId={id} competitors={competitors} planBuilt={planBuilt} />
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-4">
              <Panel label="The brief">
                <div className="grid gap-3.5 px-4 py-4">
                  <Readout label="Brand" value={fresh.brandName} />
                  <Readout
                    label="Market"
                    value={fresh.marketLabel}
                    hint={fresh.marketCountries.split(",").join(" · ")}
                  />
                  <Readout
                    label="Objective"
                    value={objectives[0] ?? "Direct response"}
                    hint={objectives.slice(1).join(" · ") || undefined}
                  />
                  <Readout label="Lookback" value={`${fresh.lookbackDays} days`} />
                  {fresh.brandWebsite ? (
                    <div className="min-w-0">
                      <Plate className="block">Website</Plate>
                      <a
                        href={fresh.brandWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-primary underline decoration-primary/40"
                      >
                        <span className="min-w-0 truncate">{fresh.brandWebsite}</span>
                        <ExternalLink size={12} strokeWidth={1.8} className="shrink-0" />
                      </a>
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel label="Source mode">
                <div className="px-4 py-4">
                  <p className="text-[12.5px] leading-relaxed text-foreground/85">
                    Browser Evidence Mode. AdMirror builds the Ad Library searches and stores the filters
                    — you open them and submit what you find.
                  </p>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    It never visits a Library link, never downloads competitor media, and never invents a
                    figure Meta doesn&rsquo;t publish.
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </RackShell>
  );
}
