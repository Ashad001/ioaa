"use client";

/**
 * S3-A — the saved searches, and the handoff moment.
 *
 * The Open button is the most important control on this screen: it takes the user
 * out to the public Ad Library in their own browser. `rel="noopener noreferrer"`
 * on every one of them, and nothing here ever requests the URL itself.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Link2, Search } from "lucide-react";
import { toast } from "sonner";

import { savePastedSearch } from "@/app/actions/runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plate } from "@/components/rack/plate";
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

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <Plate className="min-w-0 truncate">Saved searches</Plate>
        <span className="tabular shrink-0 text-[11px] text-muted-foreground">{searches.length}</span>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        {searches.map((row) => {
          const active = activeSearchId === row.id;
          return (
            <div
              key={row.id}
              className={cn(
                "min-w-0 border-l-[1px] px-4 py-3 transition-colors duration-150 ease-out",
                active ? "border-l-primary bg-primary/[0.06]" : "border-l-transparent",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : row.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] text-foreground">{row.competitorName}</span>
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

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" className="shrink-0" render={<a href={row.url} target="_blank" rel="noopener noreferrer" />}><span className="min-w-0 truncate">Open in Ad Library</span>
                    <ExternalLink size={13} strokeWidth={1.8} /></Button>
                <Button
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  className="shrink-0"
                  onClick={() => onSelect(active ? null : row.id)}
                >
                  {active ? "Capturing against this" : "Capture against this"}
                </Button>
              </div>

              {!row.parsed ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Saved as a plain reference — AdMirror couldn&rsquo;t read the filters, but the link still
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
              No searches yet. Build them from the competitor map, or paste one of your own below.
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
                toast.success("Search saved. AdMirror stored the link and the filters — it won't visit it.");
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
                <Plate className="block">Filters AdMirror read</Plate>
                <p className="tabular mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {preview.summary}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Stored as a link and a filter record. Nothing here fetches it.
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
