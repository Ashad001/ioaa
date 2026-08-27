import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart, Rocket, Telescope } from "lucide-react";

import { BaselinePanel } from "@/components/results/baseline-panel";
import { IndexLegend } from "@/components/results/index-strip";
import { ResultCard, type ResultCardData } from "@/components/results/result-card";
import { WeightsPanel, type WeightsPanelData } from "@/components/results/weights-panel";
import { Counter, EdgeCode, Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import {
  getAcceptedWeights,
  getBaseline,
  getOpenProposal,
  getRefitSamples,
  listRunsForUser,
  listShippedForUser,
} from "@/lib/admirror/queries";
import {
  MIN_DAYS_FOR_REFIT,
  isDefaultWeights,
  parseWeights,
  refitReadiness,
  type ComponentFit,
  type FitQuality,
} from "@/lib/admirror/refit";
import { EBOS_WEIGHTS } from "@/lib/admirror/scoring";
import {
  EMPTY_READING,
  MEASURED_SCOPE_RULE,
  NO_BASELINE,
  THIN_DATA_RULE,
  baselineFromOwnAds,
  diagnose,
  num,
  statedBaseline,
  toReading,
  type ReportedReading,
} from "@/lib/admirror/outcome";

export const metadata = {
  title: "Results",
  description:
    "What the ads you shipped actually did, indexed against your own account average — and an honest refusal when there isn't enough data yet.",
};

function stamp(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
}

export default async function ResultsPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const [shipped, baselineRow, runs, acceptedRow, openRow, refitSamples] = await Promise.all([
    listShippedForUser(user.id),
    getBaseline(user.id),
    listRunsForUser(user.id),
    getAcceptedWeights(user.id),
    getOpenProposal(user.id),
    getRefitSamples(user.id),
  ]);

  // THE BASELINE DECISION, made once for the whole screen so every card is
  // indexed the same way and the header can state which comparison was used.
  // Stated averages win over the median of the user's own ads; with neither,
  // NO_BASELINE means every card refuses rather than inventing a comparison.
  const readings: ReportedReading[] = shipped
    .map(({ latest }) => (latest ? toReading(latest) : null))
    .filter((row): row is ReportedReading => row !== null && num(row.impressions) !== null);

  const baseline =
    statedBaseline(baselineRow) ?? baselineFromOwnAds(readings) ?? NO_BASELINE;

  const cards: ResultCardData[] = shipped.map(({ ad, run, latest, history }) => {
    const reading = latest ? toReading(latest) : null;
    const diagnosis = diagnose({
      reading: reading ?? EMPTY_READING,
      baseline,
      inheritedAngle: Boolean(ad.sourceItemId),
    });
    return {
      id: ad.id,
      runId: ad.runId,
      label: ad.label || `${run.brandName} — ${ad.hookMechanism}`,
      brandName: run.brandName,
      marketLabel: ad.marketLabel || run.marketLabel,
      hookMechanism: ad.hookMechanism,
      formatLabel: ad.formatLabel,
      assetKind: ad.assetKind,
      launchedOn: stamp(ad.launchedOn),
      readOn: latest ? stamp(latest.readOn) : null,
      readingCount: history.length,
      diagnosis,
      hasSource: Boolean(ad.sourceItemId),
    };
  });

  // THE WEIGHTING PANEL'S DATA. The live vector comes from the accepted row and
  // nothing else — an undecided proposal is read separately and only ever
  // displayed, never used to score, which is the guarantee this feature rests on.
  const activeWeights =
    (acceptedRow ? parseWeights(acceptedRow.toWeights) : null) ?? { ...EBOS_WEIGHTS };
  const readiness = refitReadiness(refitSamples);

  let openProposal: WeightsPanelData["open"] = null;
  if (openRow) {
    // The stored evidence is read defensively: a vector or component list that
    // won't parse falls back to something honest rather than throwing away the
    // whole panel, and the weights themselves are always renormalised on read.
    let parsedEvidence: {
      components?: ComponentFit[];
      minDaysLive?: number;
      headline?: string;
      unchanged?: boolean;
    } = {};
    try {
      const candidate: unknown = JSON.parse(openRow.evidence);
      if (candidate && typeof candidate === "object") {
        parsedEvidence = candidate as typeof parsedEvidence;
      }
    } catch {
      parsedEvidence = {};
    }
    openProposal = {
      id: openRow.id,
      fromWeights: parseWeights(openRow.fromWeights) ?? { ...EBOS_WEIGHTS },
      toWeights: parseWeights(openRow.toWeights) ?? { ...EBOS_WEIGHTS },
      sampleSize: Number(openRow.sampleSize) || 0,
      minDaysLive: parsedEvidence.minDaysLive ?? MIN_DAYS_FOR_REFIT,
      fitQuality: (openRow.fitQuality as FitQuality) ?? "weak",
      evidence: parsedEvidence.components ?? [],
      headline: parsedEvidence.headline ?? "",
      summary: openRow.summary,
      unchanged: parsedEvidence.unchanged ?? false,
    };
  }

  const weightsData: WeightsPanelData = {
    active: activeWeights,
    activeIsDefault: !acceptedRow || isDefaultWeights(activeWeights),
    activeSince: acceptedRow ? stamp(acceptedRow.decidedAt) : null,
    open: openProposal,
    usable: readiness.usable,
    tooYoung: readiness.tooYoung,
    untraceable: shipped.filter(({ ad }) => !ad.sourceItemId).length,
  };

  const measured = cards.filter((card) => card.diagnosis.verdict !== "insufficient_data");
  const won = measured.filter((card) => card.diagnosis.verdict === "outperformed").length;
  const waiting = cards.length - measured.length;

  return (
    <RackShell
      crumb="Results"
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href="/patterns" />}>
            <span className="min-w-0 truncate">Patterns</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/library" />}>
            <span className="min-w-0 truncate">Your runs</span>
          </Button>
        </>
      }
    >
      <PaneHeader
        title="Results"
        hint="What the ads you shipped actually did — the only measured numbers in AdMirror."
        actions={<EdgeCode>{cards.length} shipped</EdgeCode>}
      />

      <div className="flex min-w-0 items-start gap-3 border-b border-film-edge/25 bg-film-edge/[0.06] px-4 py-3 sm:px-6">
        <LineChart size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-chart-1" />
        <p className="min-w-0 max-w-[80ch] text-[13px] leading-relaxed text-foreground">
          {MEASURED_SCOPE_RULE}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6 xl:px-8">
          <div className="mb-5 flex min-w-0 flex-wrap items-end gap-x-8 gap-y-4 border-b border-border/70 pb-4">
            <Counter value={cards.length} label="Ads shipped" />
            <Counter value={measured.length} label="With a reading" />
            <Counter value={won} label="Beat your average" />
            <Counter value={waiting} label="Too early to say" />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              {cards.length === 0 ? (
                <Panel label="Nothing shipped yet">
                  <div className="max-w-[64ch] px-4 py-6">
                    <p className="text-[13.5px] leading-relaxed text-foreground/85">
                      This is the half of AdMirror that can actually measure something.
                      Everything on a competitor card is inference from what was collected —
                      the public Ad Library publishes no performance figure. Your own ads
                      are different: you have the real numbers.
                    </p>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                      Launch a variant in your own ads manager, mark it shipped on the
                      handoff screen, and come back with the numbers. AdMirror indexes them
                      against your own average and tells you which part of the ad did the
                      work — or that it&rsquo;s too early to say.
                    </p>
                    {runs.length > 0 ? (
                      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                        {runs.slice(0, 3).map((row) => (
                          <Button
                            key={row.id}
                            size="sm"
                            variant="secondary"
                            render={<Link href={`/runs/${row.id}/deliver`} />}
                          >
                            <Rocket size={13} strokeWidth={1.7} />
                            <span className="min-w-0 truncate">{row.brandName}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Button className="mt-4" render={<Link href="/" />}>
                        <span className="min-w-0 truncate">Start a run</span>
                      </Button>
                    )}
                  </div>
                </Panel>
              ) : (
                cards.map((card) => <ResultCard key={card.id} data={card} />)
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <BaselinePanel baseline={baselineRow} activeBasis={baseline.basisNote} />

              <WeightsPanel data={weightsData} />

              <Panel label="What this screen will not do">
                <div className="max-w-[46ch] px-4 py-4">
                  <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-foreground/85">
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">{THIN_DATA_RULE}</span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        Compare you to anyone else. There is no industry benchmark in here,
                        because there is none AdMirror could honestly know.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        Put these numbers anywhere near a competitor card. Your measured
                        result and an opportunity score are different quantities and never
                        share a scale.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        Launch anything. AdMirror holds no access to your ad account — you
                        launch, you read the numbers, you type them here.
                      </span>
                    </li>
                  </ul>
                  <div className="mt-4">
                    <IndexLegend note="Every bar on this screen is your ad against your own average, never against anybody else's." />
                  </div>
                </div>
              </Panel>

              <Panel label="Across every run">
                <div className="px-4 py-4">
                  <Plate className="block">The pattern library</Plate>
                  <p className="mt-1 max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">
                    Once a few ads carry the same hook mechanism, AdMirror starts telling
                    you which mechanisms hold up in your category and market — with the
                    sample size on every cell.
                  </p>
                  <Button variant="secondary" size="sm" className="mt-3" render={<Link href="/patterns" />}>
                    <Telescope size={13} strokeWidth={1.7} />
                    <span className="min-w-0 truncate">Open patterns</span>
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </RackShell>
  );
}
