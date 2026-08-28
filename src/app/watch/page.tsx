import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, Telescope } from "lucide-react";

import { EdgeCode, Lamp, Panel, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import {
  getBriefings,
  getSnapshots,
  listRunsForUser,
  listWatchesForUser,
} from "@/lib/admirror/queries";
import { isOverdue } from "@/lib/admirror/clock";
import { VERDICT_LABEL } from "@/lib/admirror/watchtower";

export const metadata = {
  title: "Watchtower",
  description: "Every market you're watching, when the next look is due, and what moved last time.",
};

function stamp(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

export default async function WatchtowerIndexPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const [watches, runs] = await Promise.all([
    listWatchesForUser(user.id),
    listRunsForUser(user.id),
  ]);

  const enriched = await Promise.all(
    watches.map(async ({ watch, run }) => {
      const [snapshots, briefings] = await Promise.all([
        getSnapshots(run.id),
        getBriefings(run.id),
      ]);
      return { watch, run, snapshots, latest: briefings[0] ?? null };
    }),
  );

  const watchedIds = new Set(watches.map(({ watch }) => watch.runId));
  const unwatched = runs.filter((row) => !watchedIds.has(row.id));

  const due = enriched.filter(({ watch }) => isOverdue(watch.nextReminderAt, watch.enabled));

  return (
    <RackShell
      crumb="Watchtower"
      actions={
        <Button variant="ghost" size="sm" render={<Link href="/library" />}>
          <span className="min-w-0 truncate">Your runs</span>
        </Button>
      }
    >
      <PaneHeader
        title="Watchtower"
        hint="Markets you're watching, and when it's worth looking again."
        actions={
          due.length > 0 ? (
            <span className="plate inline-flex min-w-0 items-center gap-1.5 rounded-[3px] border border-primary/50 px-1.5 py-1 leading-none text-primary">
              <BellRing size={11} strokeWidth={1.8} className="shrink-0" />
              <span className="min-w-0 truncate">{due.length} due now</span>
            </span>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          {enriched.length === 0 ? (
            <div className="max-w-[58ch] py-8">
              <Plate className="block">Nothing on watch yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                A market you swept once is a photograph. Put it on watch and IOAA.AI
                reminds you when it&rsquo;s worth sweeping again, then writes what changed —
                and what that change does not prove.
              </p>
              {unwatched.length > 0 ? (
                <div className="mt-5 divide-y divide-border overflow-hidden rounded-sm border border-border">
                  {unwatched.slice(0, 6).map((row) => (
                    <Link
                      key={row.id}
                      href={`/runs/${row.id}/watch`}
                      className="flex min-w-0 items-center gap-3 bg-card/40 px-4 py-3 transition-colors duration-150 ease-out hover:bg-card"
                    >
                      <Telescope size={14} strokeWidth={1.7} className="shrink-0 text-rack-engrave" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] text-foreground">{row.brandName}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {row.marketLabel}
                        </p>
                      </div>
                      <span className="plate shrink-0 text-rack-engrave">Put on watch</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Button className="mt-4" render={<Link href="/" />}>
                  <span className="min-w-0 truncate">Start a run</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              {enriched.map(({ watch, run, snapshots, latest }) => {
                const overdue = isOverdue(watch.nextReminderAt, watch.enabled);
                const newest = snapshots[0] ?? null;
                return (
                  <Panel
                    key={watch.id}
                    label={
                      <span className="flex min-w-0 items-center gap-2">
                        <Lamp
                          state={!watch.enabled ? "cold" : overdue ? "alert" : "live"}
                          pulsing={overdue}
                        />
                        <span className="min-w-0 truncate">
                          {run.brandName} · {run.marketLabel}
                        </span>
                      </span>
                    }
                    aside={
                      <span className="flex shrink-0 items-center gap-2">
                        <EdgeCode className="hidden sm:inline">
                          every {watch.cadenceDays} days
                        </EdgeCode>
                        <Button
                          size="sm"
                          variant={overdue ? "default" : "ghost"}
                          render={<Link href={`/runs/${run.id}/collect`} />}
                        >
                          <span className="min-w-0 truncate">
                            {overdue ? "Sweep now" : "Sweep"}
                          </span>
                        </Button>
                      </span>
                    }
                  >
                    <div className="grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        {latest ? (
                          <>
                            <span className="plate block text-rack-engrave">
                              {VERDICT_LABEL[latest.verdict as keyof typeof VERDICT_LABEL] ??
                                latest.verdict}
                            </span>
                            <p className="mt-1 max-w-[62ch] text-[13.5px] leading-snug text-foreground">
                              {latest.headline}
                            </p>
                            <p className="mt-1.5 max-w-[66ch] text-xs leading-relaxed text-muted-foreground">
                              {latest.coverageNote}
                            </p>
                          </>
                        ) : (
                          <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
                            One sweep on record. Sweep again and the comparison starts.
                          </p>
                        )}
                        <div className="mt-3 flex min-w-0 flex-wrap gap-4">
                          <div className="min-w-0">
                            <Plate className="block">Last swept</Plate>
                            <span className="tabular text-[13px]">
                              {stamp(newest?.capturedAt ?? watch.lastLookedAt)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <Plate className="block">Next look</Plate>
                            <span className="tabular text-[13px]">
                              {watch.enabled ? stamp(watch.nextReminderAt) : "Not scheduled"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <Plate className="block">Sweeps</Plate>
                            <span className="tabular text-[13px]">{snapshots.length}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="justify-self-start sm:justify-self-end"
                        render={<Link href={`/runs/${run.id}/watch`} />}
                      >
                        <span className="min-w-0 truncate">Open watchtower</span>
                      </Button>
                    </div>
                  </Panel>
                );
              })}

              {unwatched.length > 0 ? (
                <Panel label="Not on watch">
                  <ul className="divide-y divide-border/60">
                    {unwatched.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`/runs/${row.id}/watch`}
                          className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-card"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-foreground">{row.brandName}</p>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {row.marketLabel}
                            </p>
                          </div>
                          <span className="plate shrink-0 text-rack-engrave">Put on watch</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              <p className="max-w-[70ch] px-1 pt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                A watch schedules a reminder, never a background fetch. Nothing in IOAA.AI
                wakes up and asks Meta for anything — you press sweep, and the reading is of
                the public Ad Library at that moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </RackShell>
  );
}
