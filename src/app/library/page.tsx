import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { CoverageBand } from "@/components/rack/coverage";
import { Lamp, Plate } from "@/components/rack/plate";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { getBatches, getVariants, listRunsForUser } from "@/lib/admirror/queries";

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
  if (!user) redirect("/");

  const runs = await listRunsForUser(user.id);

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
        <Button size="sm" render={<Link href="/" />}><Plus size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">New run</span></Button>
      }
    >
      <PaneHeader title="Run library" hint="Every brand and market you've worked, and what came out." />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6">
          {enriched.length === 0 ? (
            <div className="max-w-[54ch] py-10">
              <Plate className="block">No runs yet</Plate>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Start with your brand and the country you sell in. AdMirror maps the competition and hands
                you the searches to open.
              </p>
              <Button className="mt-4" render={<Link href="/" />}>Start your first run</Button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
              {enriched.map(({ row, latest, captures, variants }) => {
                const status = STATUS_COPY[row.status] ?? { label: row.status, lamp: "cold" as const };
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
