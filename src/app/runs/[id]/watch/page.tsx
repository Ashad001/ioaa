import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GitCompare, Telescope } from "lucide-react";

import { AdHistory } from "@/components/watch/ad-history";
import { PeriodBriefing } from "@/components/watch/period-briefing";
import { WatchControl } from "@/components/watch/watch-control";
import { RunNav } from "@/components/run/run-nav";
import { Counter, EdgeCode, Lamp, Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { isOverdue } from "@/lib/admirror/clock";
import { getUser } from "@/lib/auth";
import {
  getAdStatuses,
  getBriefings,
  getRun,
  getSnapshots,
  getSteps,
  getWatch,
} from "@/lib/admirror/queries";
import { THREE_COMPARABLE_RULE } from "@/lib/admirror/watchtower";

export const metadata = {
  title: "Watchtower",
  description: "How this market's ads changed between sweeps, and what that does and doesn't prove.",
};

function stamp(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/start");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, snapshots, statuses, briefings, watch] = await Promise.all([
    getSteps(id),
    getSnapshots(id),
    getAdStatuses(id),
    getBriefings(id),
    getWatch(id),
  ]);

  const labelById = new Map(snapshots.map((row) => [row.id, row.label || stamp(row.capturedAt)]));
  const newest = snapshots[0] ?? null;

  const observed = statuses.filter((row) => row.state === "observed").length;
  const missing = statuses.filter((row) => row.state === "not_observed_recently").length;
  const likelyGone = statuses.filter((row) => row.state === "likely_no_longer_active").length;

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · watchtower
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="WATCH" />}
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/board`} />}>
            <span className="min-w-0 truncate">Board</span>
          </Button>
          {snapshots.length > 1 ? (
            <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/timeline`} />}>
              <GitCompare size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Compare</span>
            </Button>
          ) : null}
        </>
      }
    >
      <PaneHeader
        title="Watchtower"
        hint="What changed between sweeps of this market — and what that does not prove."
        actions={<EdgeCode>{snapshots.length} sweep{snapshots.length === 1 ? "" : "s"} on record</EdgeCode>}
      />
      <SourceModeNotice
        detail={
          newest
            ? `Newest sweep: ${newest.label || stamp(newest.capturedAt)} · ${newest.itemCount} ads read · coverage ${newest.coverageBand ?? "—"}`
            : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6 xl:px-8">
          <div className="mb-5 flex min-w-0 flex-wrap items-end gap-x-8 gap-y-4 border-b border-border/70 pb-4">
            <Counter value={snapshots.length} label="Sweeps on record" />
            <Counter value={statuses.length} label="Ads tracked" />
            <Counter value={observed} label="Observed now" />
            <Counter value={missing} label="Not observed recently" />
            <Counter value={likelyGone} label="Likely no longer active" />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              {briefings.length === 0 ? (
                <Panel label="Nothing to compare yet">
                  <div className="max-w-[62ch] px-4 py-6">
                    <p className="text-[13.5px] leading-relaxed text-foreground/85">
                      One sweep is a photograph of one afternoon. Sweep this market again and
                      the watchtower starts writing the derivative: what appeared, what
                      stopped being read, whose angle is being leaned on harder.
                    </p>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                      {THREE_COMPARABLE_RULE}
                    </p>
                    <Button className="mt-4" render={<Link href={`/runs/${id}/collect`} />}>
                      <Telescope size={14} strokeWidth={1.7} />
                      <span className="min-w-0 truncate">Sweep this market again</span>
                    </Button>
                  </div>
                </Panel>
              ) : (
                briefings.map((briefing, index) => (
                  <PeriodBriefing
                    key={briefing.id}
                    runId={id}
                    briefing={briefing}
                    primary={index === 0}
                    fromLabel={
                      briefing.fromSnapshotId
                        ? labelById.get(briefing.fromSnapshotId) ?? null
                        : null
                    }
                    toLabel={labelById.get(briefing.toSnapshotId) ?? "this sweep"}
                  />
                ))
              )}

              <Panel label="Ads on the record" aside={<EdgeCode>status + basis</EdgeCode>}>
                <AdHistory statuses={statuses} />
              </Panel>
            </div>

            <div className="min-w-0 space-y-5">
              <WatchControl
                runId={id}
                watch={watch}
                lastSweptLabel={newest ? stamp(newest.capturedAt) : "Never"}
                overdue={isOverdue(watch?.nextReminderAt ?? null, watch?.enabled ?? false)}
              />

              <Panel label="Sweeps on record">
                <ul className="divide-y divide-border/60">
                  {snapshots.length === 0 ? (
                    <li className="px-4 py-4 text-[13px] text-muted-foreground">
                      No sweep has been filed yet.
                    </li>
                  ) : (
                    snapshots.map((row, index) => (
                      <li key={row.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                        <Lamp state={index === 0 ? "live" : "cold"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-foreground">
                            {row.label || stamp(row.capturedAt)}
                          </p>
                          <p className="tabular truncate text-[11px] text-muted-foreground">
                            {stamp(row.capturedAt)} · {row.itemCount} ads · coverage{" "}
                            {row.coverageBand ?? "—"}
                          </p>
                        </div>
                        <EdgeCode className="shrink-0">#{row.ordinal}</EdgeCode>
                      </li>
                    ))
                  )}
                </ul>
              </Panel>

              <Panel label="What a sweep can and can't say">
                <div className="max-w-[46ch] px-4 py-4">
                  <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-foreground/85">
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        An ad missing from a sweep is a fact about the sweep, not about the
                        advertiser.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        Two sweeps only compare when they asked the same question — same
                        searches, country, language and media filters.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        A sweep that read less than the last one looks exactly like a quiet
                        market. Coverage is stated before any reading.
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        No delivery or performance figure appears anywhere here. The public
                        Ad Library publishes none for commercial ads.
                      </span>
                    </li>
                  </ul>
                  <Plate className="mt-4 block border-t border-border/60 pt-3">
                    {THREE_COMPARABLE_RULE}
                  </Plate>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </RackShell>
  );
}
