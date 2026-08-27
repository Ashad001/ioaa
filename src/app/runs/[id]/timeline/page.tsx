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
import { getBatches, getItems, getRun, getSteps } from "@/lib/admirror/queries";

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

  const [steps, batches] = await Promise.all([getSteps(id), getBatches(id)]);
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
        <Button variant="ghost" size="sm" render={<Link href={`/runs/${id}/board`} />}><span className="min-w-0 truncate">Board</span></Button>
      }
    >
      <PaneHeader
        title="Compare captures"
        hint="What changed between two batches you submitted — no more, no less."
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

                  {comparability && !comparability.comparable ? (
                    <div className="mt-3.5 flex min-w-0 items-start gap-3 rounded-sm border border-lamp-alert/40 bg-lamp-alert/[0.08] px-3.5 py-3">
                      <AlertTriangle size={15} strokeWidth={1.7} className="mt-0.5 shrink-0 text-lamp-alert" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          These snapshots are not directly comparable.
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {comparability.differences.map((difference) => (
                            <li key={difference} className="text-[12px] leading-relaxed text-foreground/85">
                              {difference}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                          Recapture with the same saved searches and filters for a diff you can lean on.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3.5 text-[12px] leading-relaxed text-lamp-live">
                      Same saved searches, same markets, similar volume — this diff is directly comparable.
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
        </div>
      </div>
    </RackShell>
  );
}
