import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Plus } from "lucide-react";

import { CoverageBand } from "@/components/rack/coverage";
import { Lamp, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { isDue } from "@/lib/admirror/clock";
import { getUser } from "@/lib/auth";
import {
  getBatches,
  getVariants,
  listRunsForUser,
  listWatchesForUser,
} from "@/lib/admirror/queries";

const STATUS_COPY: Record<string, { label: string; lamp: "live" | "hold" | "cold" | "done" }> = {
  INTAKE: { label: "Researching", lamp: "hold" },
  COMPETITOR_MAP: { label: "Name the competitors", lamp: "hold" },
  AWAITING_EVIDENCE: { label: "Your turn — capture", lamp: "hold" },
  AWAITING_GATE: { label: "Your turn — pick angles", lamp: "hold" },
  GENERATING: { label: "Generating", lamp: "live" },
  DELIVERED: { label: "Delivered", lamp: "done" },
};

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/start");

  const [runs, watched] = await Promise.all([
    listRunsForUser(user.id),
    listWatchesForUser(user.id),
  ]);

  // Which markets are due another look. A watch is a reminder, not a crawler —
  // nothing has been read since the date shown, and the row says so.
  const watchByRun = new Map(
    watched.filter((entry) => entry.watch.enabled).map((entry) => [entry.run.id, entry.watch]),
  );

  const enriched = await Promise.all(
    runs.map(async (row) => {
      const [batches, variants] = await Promise.all([getBatches(row.id), getVariants(row.id)]);
      const closed = batches.filter((batch) => batch.state === "closed");
      return { row, latest: closed[0] ?? null, captures: closed.length, variants: variants.length };
    }),
  );

  return (
    <RackShell
      crumb="Your runs"
      actions={
        <>
          <Button variant="ghost" size="sm" render={<Link href="/watch" />}>
            <span className="min-w-0 truncate">Watchtower</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/results" />}>
            <span className="min-w-0 truncate">Results</span>
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/patterns" />}>
            <span className="min-w-0 truncate">Patterns</span>
          </Button>
          <Button size="sm" render={<Link href="/start" />}>
            <Plus size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">New run</span>
          </Button>
        </>
      }
    >
      <PaneHeader title="Run library" hint="Every brand and market you've worked, and what came out." />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6">
          {enriched.length === 0 ? (
            <div className="max-w-[54ch] py-10">
              <Plate className="block">No runs yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Start with your brand and the country you sell in. IOAA.AI maps the competition and hands
                you the searches to open.
              </p>
              <Button className="mt-4" render={<Link href="/start" />}>Start your first run</Button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
              {enriched.map(({ row, latest, captures, variants }) => {
                const status = STATUS_COPY[row.status] ?? { label: row.status, lamp: "cold" as const };
                const watch = watchByRun.get(row.id) ?? null;
                const dueAt = watch?.nextReminderAt ?? null;
                const due = isDue(dueAt);
                const href =
                  row.status === "DELIVERED"
                    ? `/runs/${row.id}/creative`
                    : row.status === "AWAITING_GATE"
                      ? `/runs/${row.id}/board`
                      : row.status === "AWAITING_EVIDENCE"
                        ? `/runs/${row.id}/collect`
                        : `/runs/${row.id}`;
                return (
                  <Link
                    key={row.id}
                    href={href}
                    className="flex min-w-0 items-center gap-4 bg-card/40 px-4 py-3.5 transition-colors duration-150 ease-out hover:bg-card"
                  >
                    <Lamp state={status.lamp} pulsing={status.lamp === "live"} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-foreground">{row.brandName}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {row.marketLabel} · {status.label}
                      </p>
                    </div>
                    <div className="tabular hidden shrink-0 text-right text-[11.5px] text-muted-foreground sm:block">
                      <p>
                        {captures} capture{captures === 1 ? "" : "s"}
                      </p>
                      <p>
                        {variants} variant{variants === 1 ? "" : "s"}
                      </p>
                    </div>
                    {watch ? (
                      <span
                        className={
                          "plate hidden shrink-0 items-center gap-1.5 rounded-[3px] border px-1.5 py-[3px] leading-none sm:inline-flex " +
                          (due
                            ? "border-primary/60 text-primary"
                            : "border-border text-muted-foreground")
                        }
                      >
                        <Eye size={11} strokeWidth={1.8} className="shrink-0" />
                        <span className="min-w-0 truncate">
                          {due
                            ? "due a look"
                            : dueAt
                              ? `look ${dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                              : "watching"}
                        </span>
                      </span>
                    ) : null}
                    {latest?.coverageBand ? (
                      <CoverageBand
                        band={latest.coverageBand as "thin" | "partial" | "substantial"}
                        score={Number(latest.coverageScore ?? 0)}
                        className="shrink-0"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RackShell>
  );
}
