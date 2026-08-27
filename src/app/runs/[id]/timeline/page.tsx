import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { RunNav } from "@/components/run/run-nav";
import { CoverageBand } from "@/components/rack/coverage";
import { Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell, SourceModeNotice } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { assessComparability, buildDiff, THREE_SNAPSHOT_RULE } from "@/lib/admirror/diff";
import {
  getBatches,
  getItems,
  getRun,
  getSnapshots,
  getSteps,
} from "@/lib/admirror/queries";
import { explainConditionGap, type DeclaredFilters } from "@/lib/admirror/watchtower";
import { STEPS } from "@/lib/admirror/pipeline";
import { Lamp } from "@/components/rack/plate";

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a, b } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  const [steps, batches, snapshots] = await Promise.all([
    getSteps(id),
    getBatches(id),
    getSnapshots(id),
  ]);
  const closed = batches.filter((batch) => batch.state === "closed");

  const newer = closed.find((batch) => batch.id === b) ?? closed[0] ?? null;
  const older = closed.find((batch) => batch.id === a) ?? closed[1] ?? null;

  const [newerItems, olderItems] = await Promise.all([
    newer ? getItems(id, newer.id) : Promise.resolve([]),
    older ? getItems(id, older.id) : Promise.resolve([]),
  ]);

  const comparability =
    older && newer
      ? assessComparability({ older, newer, olderItems, newerItems })
      : null;

  /**
   * The RECORDED conditions each capture ran under. This is the stronger test:
   * the diff module compares what came back, while these are the questions that
   * were asked. A country filter changed between two captures invalidates the
   * comparison even when the returned ads happen to look similar.
   */
  const snapshotFor = (batchId: string | undefined) =>
    batchId ? snapshots.find((row) => row.batchId === batchId) ?? null : null;
  const olderSnapshot = snapshotFor(older?.id);
  const newerSnapshot = snapshotFor(newer?.id);
  const conditionGaps =
    olderSnapshot && newerSnapshot
      ? explainConditionGap(
          JSON.parse(olderSnapshot.declaredFilters) as DeclaredFilters,
          JSON.parse(newerSnapshot.declaredFilters) as DeclaredFilters,
        )
      : [];
  const sameQuestion =
    Boolean(olderSnapshot && newerSnapshot) &&
    olderSnapshot?.comparableHash === newerSnapshot?.comparableHash;
  const buckets =
    older && newer && comparability
      ? buildDiff({ olderItems, newerItems, comparable: comparability.comparable })
      : [];

  const stamp = (date: Date | null) =>
    date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {current.brandName} · {current.marketLabel} · timeline
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="EVIDENCE_RANK" />}
      actions={
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/watch`} />}>
            <span className="min-w-0 truncate">Watchtower</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/board`} />}><span className="min-w-0 truncate">Board</span></Button>
        </div>
      }
    >
      <PaneHeader
        title="Compare captures"
        hint="What changed between two collections — no more, no less."
      />
      <SourceModeNotice detail={THREE_SNAPSHOT_RULE} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6">
          {closed.length < 2 ? (
            <div className="max-w-[58ch] py-8">
              <Plate className="block">Only one capture so far</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Come back to the same saved searches in a few weeks, submit another batch, and this screen
                will show an honest diff between them.
              </p>
              <Button className="mt-4" render={<Link href={`/runs/${id}/collect`} />}>Start another capture</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Comparability panel — before any diff. */}
              <Panel label="Comparability">
                <div className="px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { batch: older, role: "Older", items: olderItems },
                      { batch: newer, role: "Newer", items: newerItems },
                    ].map(({ batch, role, items }) => (
                      <div key={role} className="min-w-0 rounded-sm border border-border bg-card/50 px-3.5 py-3">
                        <Plate className="block">{role}</Plate>
                        <p className="mt-1 truncate text-[13px] text-foreground">{batch?.label ?? "—"}</p>
                        <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                          {items.length} ads · closed {stamp(batch?.closedAt ?? null)}
                        </p>
                        {batch?.coverageBand ? (
                          <CoverageBand
                            band={batch.coverageBand as "thin" | "partial" | "substantial"}
                            score={Number(batch.coverageScore ?? 0)}
                            className="mt-2"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {comparability && (!comparability.comparable || conditionGaps.length > 0) ? (
                    <div className="mt-3.5 flex min-w-0 items-start gap-3 rounded-sm border border-lamp-alert/40 bg-lamp-alert/[0.08] px-3.5 py-3">
                      <AlertTriangle size={15} strokeWidth={1.7} className="mt-0.5 shrink-0 text-lamp-alert" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          These snapshots are not directly comparable.
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {[...new Set([...conditionGaps, ...comparability.differences])].map(
                            (difference) => (
                              <li
                                key={difference}
                                className="text-[12px] leading-relaxed text-foreground/85"
                              >
                                {difference}
                              </li>
                            ),
                          )}
                        </ul>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                          Recapture with the same saved searches and filters for a diff you can lean on.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3.5 text-[12px] leading-relaxed text-lamp-live">
                      {sameQuestion
                        ? "Same saved searches, same filters, similar volume — this diff is directly comparable, and it counts towards an ad's absence record."
                        : "Same saved searches, same markets, similar volume — this diff is directly comparable."}
                    </p>
                  )}
                </div>
              </Panel>

              {buckets.map((bucket) => (
                <Panel
                  key={bucket.id}
                  label={bucket.label}
                  aside={
                    <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                      {bucket.items.length}
                    </span>
                  }
                >
                  <div className="px-4 py-3.5">
                    <p className="max-w-[68ch] text-[12px] leading-relaxed text-muted-foreground">
                      {bucket.note}
                    </p>
                    {bucket.items.length > 0 ? (
                      <ul className="mt-3 divide-y divide-border/60 rounded-sm border border-border">
                        {bucket.items.map((entry) => (
                          <li key={entry.key} className="min-w-0 px-3 py-2.5">
                            <p className="truncate text-[13px] text-foreground">{entry.advertiser}</p>
                            <p className="truncate text-[11.5px] text-muted-foreground">{entry.headline}</p>
                            {entry.extra ? (
                              <p className="mt-0.5 truncate text-[11px] text-rack-engrave">{entry.extra}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[12px] italic text-muted-foreground">Nothing in this bucket.</p>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {/*
            THE ENGINE LOG. The rail beside this page shows the five stages the
            user has; this is where the fifteen internal steps still live, in
            full, for anyone who wants to see exactly what ran. Removing them
            from the rail was about attention, not about hiding the machine.
          */}
          <details className="group mt-6 border-t border-border/70 pt-4">
            <summary className="cursor-pointer list-none text-[12.5px] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              Every step this run took ({steps.length})
            </summary>
            <ul className="mt-3 divide-y divide-border/50 rounded-sm border border-border">
              {STEPS.map((def) => {
                const row = steps.find((entry) => entry.name === def.name);
                const state = row?.state ?? "pending";
                return (
                  <li key={def.name} className="flex min-w-0 items-start gap-2.5 px-3 py-2">
                    <span className="mt-[6px] shrink-0">
                      <Lamp
                        state={
                          state === "done"
                            ? "done"
                            : state === "failed"
                              ? "alert"
                              : state === "pending"
                                ? "cold"
                                : "hold"
                        }
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="min-w-0 truncate text-[12.5px] text-foreground">
                          {def.title}
                        </span>
                        <span className="tabular shrink-0 text-[10px] text-rack-seam">
                          {String(def.n).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {row?.detail || def.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </div>
    </RackShell>
  );
}
