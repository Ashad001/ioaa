/**
 * How a submitted ad is shown on the board.
 *
 * The important case is the text-only one. In Browser Evidence Mode most items
 * arrive as pasted copy with no creative, and rendering those as a grey box makes
 * perfectly good evidence look like missing evidence — so a text-only ad gets a
 * deliberate typographic treatment: the copy set properly, on the rack's own
 * surface, with the CTA drawn as the button it was.
 */
import Image from "next/image";

import { Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

export function AdRender({
  headline,
  bodyCopy,
  ctaLabel,
  advertiser,
  artefactUrl,
  artefactType,
  modality,
  className,
}: {
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  advertiser: string;
  artefactUrl: string | null;
  artefactType: string | null;
  modality: string;
  className?: string;
}) {
  const isVideo = (artefactType ?? "").startsWith("video/");

  if (artefactUrl && isVideo) {
    return (
      <div className={cn("relative overflow-hidden rounded-sm bg-rack-rail", className)}>
        <video
          src={artefactUrl}
          controls
          preload="metadata"
          playsInline
          className="aspect-[4/5] w-full object-cover"
        />
      </div>
    );
  }

  if (artefactUrl) {
    return (
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-sm bg-rack-rail", className)}>
        <Image
          src={artefactUrl}
          alt={`Submitted creative${advertiser ? ` from ${advertiser}` : ""}`}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  const hasCopy = Boolean(headline.trim() || bodyCopy.trim());

  return (
    <div
      className={cn(
        "relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-sm border border-border/70 bg-rack-rail px-4 py-4",
        className,
      )}
    >
      <Plate className="text-rack-seam">
        {modality === "text_only" ? "Copy as submitted" : "No creative captured"}
      </Plate>

      {hasCopy ? (
        <div className="min-w-0">
          {headline.trim() ? (
            <p className="text-balance text-[17px] font-medium leading-[1.25] tracking-[-0.02em] text-foreground">
              {headline}
            </p>
          ) : null}
          {bodyCopy.trim() ? (
            <p
              className={cn(
                "mt-2 line-clamp-6 text-[12.5px] leading-relaxed text-foreground/75",
                !headline.trim() && "text-[14px] text-foreground/90",
              )}
            >
              {bodyCopy}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] italic leading-relaxed text-muted-foreground">
          Neither creative nor copy was captured for this one — it&rsquo;s here as a reference only.
        </p>
      )}

      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">{advertiser || "Advertiser not captured"}</span>
        {ctaLabel ? (
          <span className="plate shrink-0 rounded-[3px] border border-border bg-secondary px-2 py-1 text-secondary-foreground">
            {ctaLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
