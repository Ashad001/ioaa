import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ensureResearch } from "@/lib/admirror/ensure";
import { AutopilotRunner } from "@/components/run/autopilot-runner";
import { CompetitorMap, type SetAsideRow } from "@/components/run/competitor-map";
import { MarketChart, type MarketAd } from "@/components/run/market-chart";
import { RunNav } from "@/components/run/run-nav";
import { readReach } from "@/lib/admirror/reach";
import { EdgeCode, Lamp, Panel, Plate, Readout } from "@/components/rack/plate";
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

type AdvertiserReach = {
  /** Meta's own band, verbatim — null when Meta published nothing. */
  short: string | null;
  full: string | null;
  withFigure: number;
  total: number;
  topLower: number;
};

type StoredDossier = Dossier & {
  siteRead?: SiteRead;
  marketNote?: string;
  setAside?: SetAsideRow[];
  discoveryNote?: string;
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

  let dossier: StoredDossier | null = null;
  try {
    dossier = fresh.dossier ? (JSON.parse(fresh.dossier) as StoredDossier) : null;
  } catch {
    dossier = null;
  }

  const objectives = fresh.objectives.split(",").filter(Boolean);
  const hasEvidence = items.length > 0;
  const awaitingGate = fresh.status === "AWAITING_GATE";
  const siteRead = dossier?.siteRead;
  const terms = siteRead?.categoryTerms ?? [];
  const setAside = dossier?.setAside ?? [];

  // Both readings below are COUNTED off what was actually collected. Nothing here
  // is modelled, inferred or filled in for a gap.
  const marketAds: MarketAd[] = items.map((item) => ({
    advertiser: item.advertiser,
    visibleStartDate: item.visibleStartDate,
    hasArtwork: Boolean(item.creativeUrl ?? item.artefactUrl),
  }));

  const adsByAdvertiser: Record<string, number> = {};
  for (const item of items) {
    const key = item.advertiser.trim().toLowerCase();
    if (!key) continue;
    adsByAdvertiser[key] = (adsByAdvertiser[key] ?? 0) + 1;
  }

  // PUBLISHED REACH, PER ADVERTISER — and only where Meta published it.
  //
  // The tempting move is to add the bands up and print one big number per
  // company. That would be an invented figure twice over: adding "10K-50K" to
  // "50K-100K" produces a range nobody published, over a sample that is only the
  // ads we happened to read. So a row carries the LARGEST band Meta published
  // across that advertiser's ads, reproduced exactly, plus how many of their ads
  // carried a figure at all. An advertiser whose ads carry none gets none — the
  // row says so in words rather than showing a zero.
  const reachByAdvertiser: Record<string, AdvertiserReach> = {};
  for (const item of items) {
    const key = item.advertiser.trim().toLowerCase();
    if (!key) continue;
    const entry =
      reachByAdvertiser[key] ?? { short: null, full: null, withFigure: 0, total: 0, topLower: -1 };
    entry.total += 1;
    const read = readReach(item.impressionsLower, item.impressionsUpper);
    if (read.published) {
      entry.withFigure += 1;
      const lower = Number(item.impressionsLower ?? 0);
      if (lower > entry.topLower) {
        entry.short = read.short;
        entry.full = read.full;
        entry.topLower = lower;
      }
    }
    reachByAdvertiser[key] = entry;
  }

  const withArt = marketAds.filter((ad) => ad.hasArtwork).length;

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
            <span className="min-w-0 truncate">See the sheet</span>
          </Button>
        ) : null
      }
    >
      <PaneHeader
        title="Your market"
        hint="Reading runs on its own. You step in once, to pick an angle."
        actions={
          <span className="plate flex items-center gap-2 text-rack-engrave">
            <Lamp state={hasEvidence ? "done" : "hold"} pulsing={!hasEvidence} />
            <span className="min-w-0 truncate">
              {fresh.status.replace(/_/g, " ").toLowerCase()}
            </span>
          </span>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <Panel label="Reading the Ad Library">
                <div className="px-4 py-4">
                  <AutopilotRunner
                    runId={id}
                    hasCompetitors={competitors.length > 0}
                    hasEvidence={hasEvidence}
                    awaitingGate={awaitingGate}
                  />
                </div>
              </Panel>

              <Panel
                label="Who's advertising against you"
                aside={
                  <EdgeCode>
                    {competitors.filter((row) => !row.pruned).length} kept
                  </EdgeCode>
                }
              >
                <div className="px-4 py-4">
                  <CompetitorMap
                    runId={id}
                    competitors={competitors}
                    hasEvidence={hasEvidence}
                    setAside={setAside}
                    adsByAdvertiser={adsByAdvertiser}
                    reachByAdvertiser={reachByAdvertiser}
                  />
                </div>
              </Panel>

              {hasEvidence ? (
                <Panel
                  label="What was collected"
                  aside={
                    <EdgeCode>
                      {items.length} ads · {withArt} with artwork
                    </EdgeCode>
                  }
                >
                  <div className="px-4 py-4">
                    <MarketChart ads={marketAds} />
                  </div>
                </Panel>
              ) : null}

              {dossier?.positioning ? (
                <Panel label="What we read off your site">
                  <div className="space-y-4 px-4 py-4">
                    <p className="max-w-[65ch] text-[13.5px] leading-relaxed text-foreground/90">
                      {dossier.positioning}
                    </p>

                    {terms.length > 0 ? (
                      <div>
                        <Plate className="block">Searched under your own words</Plate>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terms.map((term) => (
                            <span
                              key={term}
                              className="border border-film-edge/35 bg-film-edge/[0.07] px-2.5 py-1 text-[12px] text-foreground/85"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
                          These words found the advertisers above. Anyone who came back but
                          didn&rsquo;t sell what you sell was set aside.
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <Plate className="block">Who it&rsquo;s for</Plate>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {dossier.icp.map((chip) => (
                            <span
                              key={chip}
                              className="border border-border bg-secondary/40 px-2.5 py-1 text-[12px] text-foreground/85"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Plate className="block">Proof this market wants</Plate>
                        <ul className="mt-2 space-y-1">
                          {dossier.proofShape.map((proof) => (
                            <li
                              key={proof}
                              className="flex gap-2 text-[13px] leading-relaxed text-foreground/85"
                            >
                              <span
                                aria-hidden
                                className="mt-2 size-1 shrink-0 rounded-full bg-film-edge/70"
                              />
                              <span className="min-w-0">{proof}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="max-w-[65ch] border-t border-border/70 pt-3 text-[12px] leading-relaxed text-muted-foreground">
                      {siteRead?.note ?? dossier.basis}
                    </p>
                  </div>
                </Panel>
              ) : null}
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
                  <Readout
                    label="Ads read so far"
                    value={String(items.length)}
                    hint={`${withArt} came back with artwork`}
                  />
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

              <Panel label="Where this comes from">
                <div className="px-4 py-4">
                  <p className="text-[12.5px] leading-relaxed text-foreground/85">
                    AdMirror reads the public Meta Ad Library itself — the same pages anyone can
                    open without an account — and takes the artwork, the copy, the call to action
                    and the date each ad started running.
                  </p>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    Meta publishes no spend, click or conversion figures for these ads, so AdMirror
                    shows none. It does publish a reach range on some ads — where it exists you see
                    it as the range Meta gave, never narrowed to one number, and where it doesn&rsquo;t
                    the row says so instead of showing a zero.
                  </p>
                  {dossier?.discoveryNote ? (
                    <p className="mt-2.5 border-t border-border/70 pt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                      {dossier.discoveryNote}
                    </p>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </RackShell>
  );
}
