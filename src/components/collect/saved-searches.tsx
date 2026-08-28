"use client";

/**
 * S3-A — the searches this run swept, and the escape hatch.
 *
 * IOAA.AI runs these searches itself, so this pane is mostly a record of WHERE
 * the ads on the board came from. The Open button still matters: it lets the user
 * check our reading against the real page, which is the only way to trust it.
 * `rel="noopener noreferrer"` on every one of them.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Link2, Search } from "lucide-react";
import { toast } from "sonner";

import { savePastedSearch } from "@/app/actions/runs";
import { autoCollect } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EdgeCode, Lamp, Plate } from "@/components/rack/plate";
import { parseSearchUrl } from "@/lib/admirror/ad-library";
import type { SearchRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

export function SavedSearches({
  runId,
  searches,
  activeSearchId,
  onSelect,
}: {
  runId: string;
  searches: SearchRow[];
  activeSearchId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pasted, setPasted] = useState("");

  const preview = pasted.trim() ? parseSearchUrl(pasted) : null;

  /**
   * The lamp beside a search says what the last sweep of it actually did. This
   * distinction is the point: "nobody advertises under this term" and "the page
   * would not load for us" look identical on a board, and only one of them means
   * the market is quiet.
   */
  const lampFor = (state: string | null) =>
    state === "ok" ? "done" : state === "empty" ? "cold" : state === null ? "cold" : "alert";

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <Plate className="min-w-0 truncate">Where the ads came from</Plate>
        <EdgeCode className="shrink-0">{String(searches.length).padStart(2, "0")}</EdgeCode>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        {searches.map((row) => {
          const active = activeSearchId === row.id;
          return (
            <div
              key={row.id}
              className={cn(
                "min-w-0 border-l-2 px-4 py-3 transition-colors duration-150 ease-out",
                active
                  ? "border-l-primary bg-primary/[0.07]"
                  : "border-l-transparent hover:bg-card/50",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : row.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Lamp state={lampFor(row.lastSweepState)} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {row.competitorName}
                    </span>
                    {row.lastSweepCount ? (
                      <EdgeCode className="shrink-0">{row.lastSweepCount}</EdgeCode>
                    ) : null}
                  </span>
                  <span className="tabular mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {row.filterSummary}
                  </span>
                </button>
                {row.origin === "user_pasted" ? (
                  <span className="plate shrink-0 rounded-[3px] border border-border px-1.5 py-[3px] text-rack-engrave">
                    yours
                  </span>
                ) : null}
              </div>

              {row.lastSweepNote ? (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {row.lastSweepNote}
                </p>
              ) : (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Not read yet — the next collection will read this one.
                </p>
              )}

              {/* Says WHY there is nothing here, in the two cases that look
                  identical on a board and mean opposite things. */}
              {row.lastSweepState === "blocked" || row.lastSweepState === "failed" ? (
                <p className="mt-1 text-[11px] leading-relaxed text-lamp-alert">
                  Left unread — we don&rsquo;t know whether they&rsquo;re advertising.
                </p>
              ) : row.lastSweepState === "empty" ? (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Checked by keyword and by name — nothing live here.
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" className="shrink-0" render={<a href={row.url} target="_blank" rel="noopener noreferrer" />}><span className="min-w-0 truncate">Open in Ad Library</span>
                    <ExternalLink size={13} strokeWidth={1.8} /></Button>
                <Button
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  className="shrink-0"
                  onClick={() => onSelect(active ? null : row.id)}
                >
                  {active ? "Adding against this" : "Add against this"}
                </Button>
              </div>

              {!row.parsed ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Saved as a plain reference — IOAA.AI couldn&rsquo;t read the filters, but the link still
                  works.
                </p>
              ) : null}
            </div>
          );
        })}

        {searches.length === 0 ? (
          <div className="px-4 py-6">
            <Search size={17} strokeWidth={1.5} className="text-rack-seam" />
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              No searches yet. They appear as soon as we&rsquo;ve found who advertises in your
              market — or paste one of your own below.
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border px-4 py-3.5">
        <Plate className="block">Paste your own search</Plate>
        <div className="mt-2 flex min-w-0 gap-2">
          <Input
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="https://www.facebook.com/ads/library/?..."
            className="min-w-0 font-mono text-[12px]"
          />
          <Button
            size="icon"
            variant="secondary"
            className="shrink-0"
            aria-label="Save this search"
            disabled={pending || !pasted.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await savePastedSearch({ runId, url: pasted });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setPasted("");
                toast.success("Search saved — collecting its ads now.");
                router.refresh();
                const swept = await autoCollect(runId);
                if (!swept.ok) toast.error(swept.error);
                else toast.success("Read your search — anything new is on the board.");
                router.refresh();
              })
            }
          >
            <Link2 size={14} strokeWidth={1.8} />
          </Button>
        </div>

        {preview ? (
          <div className="mt-2.5 rounded-sm border border-border bg-card/60 px-3 py-2.5">
            {preview.ok ? (
              <>
                <Plate className="block">Filters IOAA.AI read</Plate>
                <p className="tabular mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {preview.summary}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Saved, and read straight away — no extra step.
                </p>
              </>
            ) : (
              <p className="text-[12px] leading-relaxed text-muted-foreground">{preview.problem}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
