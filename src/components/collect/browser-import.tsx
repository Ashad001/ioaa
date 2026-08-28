"use client";

/**
 * BRING THE ADS BACK YOURSELF — the route that works with nothing connected.
 *
 * WHY THIS EXISTS. In some countries the Ad Library cannot be read from a server
 * at all, and IOAA.AI's own reader may not be connected. But the public Library
 * page opens perfectly in the user's own browser, and what their browser can see,
 * they can copy. So this pane hands them the exact search, then reads the page
 * they paste back — no key, no signup, nothing to connect.
 *
 * The reading is previewed BEFORE anything is saved, and it states what it could
 * not see as plainly as what it could. That is the point: a field the page didn't
 * show stays empty rather than becoming a plausible guess, and the user can see
 * that for themselves before they commit the import.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardPaste, ExternalLink, Eraser, Import } from "lucide-react";
import { toast } from "sonner";

import { importLibraryPaste } from "@/app/actions/library-import";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EdgeCode, Plate } from "@/components/rack/plate";
import { buildSearchUrl } from "@/lib/admirror/ad-library";
import { readLibraryPaste } from "@/lib/admirror/library-paste";
import type { SearchRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

const STEPS = [
  "Open the search — it opens in a new tab, already filtered.",
  "Scroll until the ads you want have loaded.",
  "Select the whole page and copy it.",
  "Paste it back in the box below.",
];

export function BrowserImport({
  runId,
  search,
  market,
  language,
}: {
  runId: string;
  search: SearchRow | null;
  market: string;
  language: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pasted, setPasted] = useState("");

  const url =
    search?.url ||
    buildSearchUrl({
      competitorName: search?.competitorName ?? "",
      country: search?.country ?? "",
      language: search?.language ?? "any",
      mediaType: search?.mediaType ?? "all",
      activeStatus: search?.activeStatus ?? "active",
    });

  const reading = useMemo(
    () => (pasted.trim() ? readLibraryPaste(pasted) : null),
    [pasted],
  );

  const withCopy = reading?.ads.filter((ad) => ad.bodyCopy || ad.headline).length ?? 0;
  const withDate = reading?.ads.filter((ad) => ad.visibleStartDate).length ?? 0;
  const gaps = Array.from(
    new Set((reading?.ads ?? []).flatMap((ad) => ad.missing)),
  ).slice(0, 5);

  return (
    <div className="min-w-0 px-4 pb-4">
      <div className="min-w-0 border-l-2 border-primary/70 bg-primary/[0.05] px-3.5 py-3">
        <Plate className="block">Read it in your own browser</Plate>
        <p className="mt-1 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
          IOAA.AI already reads the Library itself on every sweep. This is the backup for a
          search that keeps coming back unread: open it yourself, copy the page, and the ads
          land on the sheet the same way.
        </p>

        <ol className="mt-2.5 space-y-1">
          {STEPS.map((step, index) => (
            <li key={step} className="flex min-w-0 items-baseline gap-2">
              <EdgeCode className="shrink-0">{String(index + 1).padStart(2, "0")}</EdgeCode>
              <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-foreground/85">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="shrink-0" render={
            <a href={url} target="_blank" rel="noopener noreferrer" />
          }>
            <ExternalLink size={13} strokeWidth={1.7} />
            <span className="min-w-0 truncate">
              {search ? `Open ${search.competitorName}` : "Open the Ad Library"}
            </span>
          </Button>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {search
              ? `${search.filterSummary || search.country}`
              : "Pick a search on the left to open it already filtered."}
          </span>
        </div>
      </div>

      <div className="mt-3 min-w-0">
        <Textarea
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="Paste the Ad Library page here — the whole thing is fine, extra page furniture is ignored."
          rows={5}
          className="min-w-0 resize-y font-mono text-[11.5px] leading-relaxed"
        />

        {reading ? (
          <div
            className={cn(
              "mt-2.5 min-w-0 border-l-2 px-3.5 py-2.5",
              reading.ads.length > 0
                ? "border-lamp-live/70 bg-lamp-live/[0.07]"
                : "border-lamp-alert/70 bg-lamp-alert/[0.07]",
            )}
          >
            {reading.ads.length > 0 ? (
              <>
                <p className="min-w-0 text-[12.5px] leading-relaxed text-foreground">
                  <EdgeCode>{reading.ads.length}</EdgeCode> ad
                  {reading.ads.length === 1 ? "" : "s"} found on that page · {withCopy} with copy ·{" "}
                  {withDate} with a start date
                </p>
                {gaps.length > 0 ? (
                  <p className="mt-1 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
                    Not shown on the page, so left empty: {gaps.join(", ")}. Nothing is guessed —
                    you can fill any of it in on the card afterwards.
                  </p>
                ) : null}
                {reading.hint ? (
                  <p className="mt-1 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
                    {reading.hint}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="min-w-0 max-w-[65ch] text-[12.5px] leading-relaxed text-foreground">
                {reading.problem}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClipboardPaste size={12} strokeWidth={1.7} className="shrink-0" />
            <span className="min-w-0 truncate">
              IOAA.AI shows you what it read before anything is saved.
            </span>
          </p>
        )}

        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="shrink-0"
            disabled={pending || !reading || reading.ads.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await importLibraryPaste({
                  runId,
                  searchReferenceId: search?.id ?? null,
                  pasted,
                  market,
                  language,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setPasted("");
                toast.success(result.note);
                router.refresh();
              })
            }
          >
            <Import size={13} strokeWidth={1.7} />
            <span className="min-w-0 truncate">
              {pending
                ? "Importing…"
                : reading && reading.ads.length > 0
                  ? `Import ${reading.ads.length} ad${reading.ads.length === 1 ? "" : "s"}`
                  : "Import these ads"}
            </span>
          </Button>

          {pasted ? (
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              disabled={pending}
              onClick={() => setPasted("")}
            >
              <Eraser size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Clear</span>
            </Button>
          ) : null}

          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            Imported ads rank exactly like collected ones.
          </span>
        </div>
      </div>
    </div>
  );
}
