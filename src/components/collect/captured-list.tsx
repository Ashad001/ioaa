"use client";

/**
 * THE CONTACT SHEET — every ad the sweep read, laid out as developed frames.
 *
 * This screen exists so the user can SEE what was collected. The public Ad
 * Library card carries a specific set of facts and this frame mirrors them in
 * the same reading order — status, the Library's own identifier, when it started
 * running, the advertiser, the copy, the destination, the headline, the button —
 * because a user checking our reading against the real page has to be able to
 * scan the two side by side.
 *
 * The artwork is a REFERENCE to the address the Library page itself points at.
 * Nothing is downloaded or re-hosted, so a frame has to survive its picture
 * going dead: <AdRender> falls back to a typographic frame rather than a hole.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink, ImageIcon, Trash2, Type } from "lucide-react";
import { toast } from "sonner";

import { deleteEvidence } from "@/app/actions/evidence";
import { AdRender } from "@/components/rack/ad-render";
import { EdgeCode, Lamp, Plate, Rebate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { readReach } from "@/lib/admirror/reach";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import type { EvidenceRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

/** The Library's own id, pulled back out of the link we stored. */
function libraryId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

type Filter = "all" | "art" | "copy";

export function CapturedList({ runId, items }: { runId: string; items: EvidenceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const withArt = useMemo(
    () => items.filter((item) => Boolean(item.artefactUrl || item.creativeUrl)).length,
    [items],
  );

  const shown = useMemo(() => {
    if (filter === "art") return items.filter((item) => Boolean(item.artefactUrl || item.creativeUrl));
    if (filter === "copy") return items.filter((item) => !item.artefactUrl && !item.creativeUrl);
    return items;
  }, [items, filter]);

  if (items.length === 0) {
    return (
      <div className="px-4 py-8">
        <Plate className="block">The sheet is blank</Plate>
        <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-muted-foreground">
          No live ads have come back for this market yet. Collect again, or add an ad you
          spotted yourself — both land on the same sheet and are scored the same way.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <EdgeCode>{String(items.length).padStart(3, "0")} frames</EdgeCode>
          <span className="text-[11.5px] text-muted-foreground">
            {withArt} with artwork · {items.length - withArt} copy only
          </span>
        </div>
        <ToggleGroup
          value={[filter]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "all" || next === "art" || next === "copy") setFilter(next);
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="all" size="sm" aria-label="Show every frame" className="min-w-0">
            <span className="min-w-0 truncate">All</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="art" size="sm" aria-label="Only frames with artwork" className="min-w-0">
            <ImageIcon size={12} strokeWidth={1.8} />
            <span className="min-w-0 truncate">Artwork</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="copy" size="sm" aria-label="Only copy-only frames" className="min-w-0">
            <Type size={12} strokeWidth={1.8} />
            <span className="min-w-0 truncate">Copy</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shown.map((item, index) => {
          const id = libraryId(item.libraryUrl);
          const host = hostOf(item.libraryUrl);
          const platforms = item.platforms.split(",").filter(Boolean);
          const active = item.activeStatus === "active";
          const swept = item.libraryUrlProvenance === "swept_from_public_library";
          const imported = item.libraryUrlProvenance === "read_in_your_browser";

          return (
            <article
              key={item.id}
              className="group flex min-w-0 flex-col overflow-hidden rounded-sm border border-border/70 bg-film-base"
            >
              {/* The rebate: the strip's own perforated edge, with the frame number. */}
              <div className="flex min-w-0 items-center gap-2 border-b border-border/60 bg-film-rebate/60 px-2.5 py-1.5">
                <EdgeCode className="shrink-0">{String(index + 1).padStart(3, "0")}</EdgeCode>
                <Rebate orientation="horizontal" className="h-[7px] min-w-0 flex-1 opacity-70" />
                <span className="flex shrink-0 items-center gap-1.5">
                  <Lamp state={active ? "live" : "cold"} />
                  <Plate className="truncate">{active ? "Active" : item.activeStatus === "inactive" ? "Inactive" : "Status unread"}</Plate>
                </span>
              </div>

              <div className="min-w-0 px-2.5 pt-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {item.advertiserAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.advertiserAvatarUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="size-6 shrink-0 rounded-full border border-border/70 object-cover"
                    />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border/70 bg-secondary text-[10px] text-muted-foreground">
                      {(item.advertiser || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                    {item.advertiser || "Advertiser unread"}
                  </span>
                  {swept ? (
                    <span className="plate shrink-0 rounded-[3px] border border-chart-1/45 bg-chart-1/16 px-1.5 py-[3px] text-chart-1">
                      lib
                    </span>
                  ) : imported ? (
                    <span
                      className="plate shrink-0 rounded-[3px] border border-chart-2/45 bg-chart-2/16 px-1.5 py-[3px] text-chart-2"
                      title="Read off the Library page you opened in your own browser."
                    >
                      brow
                    </span>
                  ) : (
                    <span className="plate shrink-0 rounded-[3px] border border-lamp-live/45 bg-lamp-live/18 px-1.5 py-[3px] text-lamp-live">
                      yours
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5">
                <AdRender
                  headline={item.headline}
                  bodyCopy={item.bodyCopy}
                  ctaLabel={item.ctaLabel}
                  advertiser={item.advertiser}
                  artefactUrl={item.artefactUrl}
                  artefactType={item.artefactType}
                  creativeUrl={item.creativeUrl}
                  isVideo={item.isVideo}
                  videoUrl={item.videoUrl}
                  videoDuration={item.videoDuration}
                  modality={item.modality}
                />
              </div>

              <div className="min-w-0 flex-1 px-2.5">
                {item.bodyCopy.trim() && (item.artefactUrl || item.creativeUrl) ? (
                  <p className="line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                    {item.bodyCopy}
                  </p>
                ) : null}
                {item.headline.trim() && (item.artefactUrl || item.creativeUrl) ? (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">
                    {item.headline}
                  </p>
                ) : null}
                {item.ctaLabel.trim() && (item.artefactUrl || item.creativeUrl) ? (
                  <span className="mt-2 inline-flex items-center rounded-[3px] border border-border bg-secondary px-2 py-[3px] text-[11px] text-secondary-foreground">
                    {item.ctaLabel}
                  </span>
                ) : null}
              </div>

              {/* The edge print: everything the Library itself stamped on the card. */}
              <dl className="mt-2.5 min-w-0 space-y-1 border-t border-border/60 px-2.5 py-2">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <dt className="plate shrink-0 text-rack-engrave">Library ID</dt>
                  <dd className="min-w-0 truncate">
                    {id ? <EdgeCode>{id}</EdgeCode> : <span className="text-[11px] text-muted-foreground">not read</span>}
                  </dd>
                </div>
                {/* Reach, as Meta publishes it. An ad without one says so
                    outright — a blank would read as zero, which is a claim we
                    have no basis to make. */}
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <dt className="plate shrink-0 text-rack-engrave">Reached</dt>
                  <dd className="min-w-0 truncate text-[11.5px] text-foreground/85">
                    {(() => {
                      const reach = readReach(item.impressionsLower, item.impressionsUpper);
                      return reach.published ? (
                        <span className="tabular font-medium text-foreground">{reach.short}</span>
                      ) : (
                        <span className="text-muted-foreground">not published</span>
                      );
                    })()}
                  </dd>
                </div>
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <dt className="plate shrink-0 text-rack-engrave">Started</dt>
                  <dd className="min-w-0 truncate text-[11.5px] text-foreground/85">
                    {item.visibleStartDate ?? <span className="text-muted-foreground">not read</span>}
                  </dd>
                </div>
                {platforms.length > 0 ? (
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <dt className="plate shrink-0 text-rack-engrave">Placed</dt>
                    <dd className="min-w-0 truncate text-[11.5px] text-foreground/85">
                      {platforms.map((key) => PLATFORM_LABELS[key] ?? key).join(" · ")}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="flex min-w-0 items-center gap-1 border-t border-border/60 px-1.5 py-1.5">
                {item.libraryUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 flex-1 justify-start"
                    render={
                      <a
                        href={item.libraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open this ad in the public Ad Library"
                      />
                    }
                  >
                    <ExternalLink size={12} strokeWidth={1.8} />
                    <span className="min-w-0 truncate">{host ?? "Open in Ad Library"}</span>
                  </Button>
                ) : (
                  <span className="min-w-0 flex-1 truncate px-2 text-[11px] text-muted-foreground">
                    No link captured
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8 shrink-0 opacity-0 transition-opacity duration-150 ease-out",
                    "group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                  aria-label="Remove this frame from the sheet"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteEvidence({ runId, itemId: item.id });
                      if (!result.ok) toast.error(result.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 size={12} strokeWidth={1.8} />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="px-4 pb-6">
          <p className="text-[12.5px] text-muted-foreground">
            No frames match that filter.
          </p>
        </div>
      ) : null}
    </div>
  );
}
