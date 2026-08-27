import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ensureResearch } from "@/lib/admirror/ensure";
import { AutopilotRunner } from "@/components/run/autopilot-runner";
import { CompetitorMap } from "@/components/run/competitor-map";
import { RunNav } from "@/components/run/run-nav";
import { Lamp, Panel, Plate, Readout } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import type { Dossier } from "@/lib/admirror/pipeline";
import { getCompetitors, getItems, getRun, getSteps } from "@/lib/admirror/queries";

type SiteRead = {
  title?: string;
  description?: string;
  categoryTerms?: string[];
  note?: string;
  reachable?: boolean;
};

export default async function RunConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  // A brand read good enough to render immediately, so the console is never
  // blank while the sweep runs. The sweep itself is kicked off by the runner
  // below — it takes seconds and must not happen inside a render.
  await ensureResearch(current);

  const [fresh, steps, competitors, items] = await Promise.all([
    getRun(id, user.id),
    getSteps(id),
    getCompetitors(id),
    getItems(id),
  ]);
  if (!fresh) notFound();

  let dossier: (Dossier & { siteRead?: SiteRead; marketNote?: string }) | null = null;
  try {
    dossier = fresh.dossier ? JSON.parse(fresh.dossier) : null;
  } catch {
    dossier = null;
  }

  const objectives = fresh.objectives.split(",").filter(Boolean);
  const hasEvidence = items.length > 0;
  const awaitingGate = fresh.status === "AWAITING_GATE";
  const siteRead = dossier?.siteRead;
  const terms = siteRead?.categoryTerms ?? [];

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {fresh.brandName} · {fresh.marketLabel}
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="COMPETITOR_MAP" />}
      actions={
        hasEvidence ? (
          <Button size="sm" render={<Link href={`/runs/${id}/board`} />}>
            <span className="min-w-0 truncate">See the board</span>
          </Button>
        ) : null
      }
    >
      <PaneHeader
        title="Research console"
        hint="Collection runs on its own. You step in once, at the gate."
        actions={
          <span className="plate flex items-center gap-2 text-rack-engrave">
            <Lamp state={hasEvidence ? "done" : "hold"} pulsing={!hasEvidence} />
            {fresh.status.replace(/_/g, " ").toLowerCase()}
          </span>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <Panel
                label="Collecting"
                aside={<span className="plate text-rack-engrave">steps 03–08</span>}
              >
                <div className="px-4 py-4">
                  <AutopilotRunner
                    runId={id}
                    hasCompetitors={competitors.length > 0}
                    hasEvidence={hasEvidence}
                    awaitingGate={awaitingGate}
                  />
                </div>
              </Panel>

              {dossier?.positioning ? (
                <Panel
                  label="Brand read"
                  aside={<span className="plate text-rack-engrave">step 02</span>}
                >
                  <div className="space-y-4 px-4 py-4">
                    <p className="max-w-[65ch] text-[13.5px] leading-relaxed text-foreground/90">
                      {dossier.positioning}
                    </p>

                    {siteRead?.description ? (
                      <div className="min-w-0">
                        <Plate className="block">What your site says</Plate>
                        <p className="mt-1.5 max-w-[65ch] text-[13px] leading-relaxed text-foreground/85">
                          {siteRead.description}
                        </p>
                      </div>
                    ) : null}

                    {terms.length > 0 ? (
                      <div>
                        <Plate className="block">Searched under</Plate>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terms.map((term) => (
                            <span
                              key={term}
                              className="rounded-full border border-chart-1/40 bg-chart-1/[0.08] px-2.5 py-1 text-[12px] text-foreground/85"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                          These are your site&rsquo;s own words — they&rsquo;re what found the
                          advertisers below.
                        </p>
                      </div>
                    ) : null}

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
                            <li
                              key={proof}
                              className="flex gap-2 text-[13px] leading-relaxed text-foreground/85"
                            >
                              <span
                                aria-hidden
                                className="mt-2 size-1 shrink-0 rounded-full bg-rack-seam"
                              />
                              <span className="min-w-0">{proof}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="border-t border-border/70 pt-3 text-[12px] leading-relaxed text-muted-foreground">
                      {siteRead?.note ?? dossier.basis}
                    </p>
                  </div>
                </Panel>
              ) : null}

              <Panel
                label="Who's advertising against you"
                aside={<span className="plate text-rack-engrave">step 03</span>}
              >
                <div className="px-4 py-4">
                  <CompetitorMap runId={id} competitors={competitors} hasEvidence={hasEvidence} />
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
                  <Readout label="Ads collected" value={String(items.length)} />
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
                  {dossier?.marketNote ? (
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      {dossier.marketNote}
                    </p>
                  ) : null}
                </div>
              </Panel>

              <Panel label="Where this comes from">
                <div className="px-4 py-4">
                  <p className="text-[12.5px] leading-relaxed text-foreground/85">
                    AdMirror reads the public Meta Ad Library itself — the same pages anyone can open
                    without an account. It takes the ad copy, the call to action and the date each ad
                    started running.
                  </p>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    Meta publishes no spend, reach or click figures for these ads, so AdMirror shows
                    none. Every fact on your board carries a badge saying whether we read it or you
                    did.
                  </p>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    Anything a search couldn&rsquo;t return is listed as a gap, never filled in.
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
