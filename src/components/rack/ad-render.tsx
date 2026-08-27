/**
 * A COLLECTED AD, RENDERED AS A FILM FRAME.
 *
 * Two cases matter and they are genuinely different, so they get genuinely
 * different treatments rather than one shared grey box:
 *
 * 1. THE AD HAS ARTWORK. Either the picture the public Library card displayed —
 *    referenced at the address the page itself points at, never copied — or a
 *    screenshot the user attached. This is the case the whole product is for:
 *    seeing the market's actual creative. It is shown as the frame's emulsion.
 * 2. THE AD IS TEXT ONLY. Most hand-pasted items arrive this way, and rendering
 *    those as an empty box makes perfectly good evidence look like MISSING
 *    evidence. So text-only gets a deliberate typographic frame: the copy set
 *    properly on emulsion, with the CTA drawn as the button it was.
 *
 * A referenced picture can go dead when Meta rotates its addresses, so the
 * markup has to survive a picture that never loads — hence the frame keeps its
 * own aspect and legend underneath whatever does or doesn't arrive.
 */
"use client";

import { useState } from "react";
import { Film, ImageOff, Play } from "lucide-react";

import { Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

export function AdRender({
  headline,
  bodyCopy,
  ctaLabel,
  advertiser,
  artefactUrl,
  artefactType,
  creativeUrl,
  isVideo,
  videoUrl,
  videoDuration,
  modality,
  className,
}: {
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  advertiser: string;
  artefactUrl: string | null;
  artefactType: string | null;
  /** The picture the public card displayed. A reference, not a copy. */
  creativeUrl?: string | null;
  isVideo?: boolean;
  /**
   * THE RIVAL'S ACTUAL VIDEO, when the Library card played one. A pointer to
   * Meta's own address, so it streams exactly as it would on the real page and
   * nothing is re-hosted. It can go dead without notice, hence the poster frame
   * underneath it and the fallback below.
   */
  videoUrl?: string | null;
  /** How long the card said it runs, verbatim (e.g. "0:15"). */
  videoDuration?: string | null;
  modality: string;
  className?: string;
}) {
  const [pictureFailed, setPictureFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const uploadIsVideo = (artefactType ?? "").startsWith("video/");

  // A recording the user attached themselves.
  if (artefactUrl && uploadIsVideo) {
    return (
      <div className={cn("emulsion relative overflow-hidden rounded-sm", className)}>
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

  // THE RIVAL'S OWN VIDEO — the strongest evidence of a video ad there is, so it
  // outranks the still. Poster frame attached so the frame is never blank while
  // it loads, and `preload="metadata"` so a board of twenty cards doesn't pull
  // twenty video files down at once.
  if (videoUrl && !videoFailed) {
    return (
      <div className={cn("emulsion relative overflow-hidden rounded-sm", className)}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={videoUrl}
          poster={creativeUrl ?? undefined}
          controls
          preload="metadata"
          playsInline
          onError={() => setVideoFailed(true)}
          className="aspect-[4/5] w-full bg-film-base object-cover"
        />
        {videoDuration ? (
          <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded-[3px] bg-film-base/85 px-1.5 py-1 backdrop-blur-sm">
            <Play size={9} strokeWidth={2.5} className="text-film-edge" />
            <Plate className="text-film-edge">{videoDuration}</Plate>
          </span>
        ) : null}
      </div>
    );
  }

  // Their own screenshot first — it is the strongest artefact we hold.
  // Then the Library's own picture. Both are just "the frame's emulsion".
  const picture = artefactUrl ?? creativeUrl ?? null;

  if (picture && !pictureFailed) {
    return (
      <div className={cn("emulsion relative overflow-hidden rounded-sm", className)}>
        {/* A plain img, not next/image: this address belongs to Meta's CDN, is
            rotated without notice, and must never be proxied or re-hosted. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={picture}
          alt={`Ad creative${advertiser ? ` from ${advertiser}` : ""}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setPictureFailed(true)}
          className="aspect-[4/5] w-full object-cover"
        />
        {isVideo ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-[3px] bg-film-base/85 px-1.5 py-1 backdrop-blur-sm">
            <Play size={10} strokeWidth={2.5} className="text-film-edge" />
            <Plate className="text-film-edge">
              {videoFailed ? "Video expired" : videoDuration ? videoDuration : "Video"}
            </Plate>
          </span>
        ) : null}
      </div>
    );
  }

  const hasCopy = Boolean(headline.trim() || bodyCopy.trim());

  return (
    <div
      className={cn(
        "emulsion relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-sm border border-border/60 px-4 py-4",
        className,
      )}
    >
      {hasCopy ? (
        <>
          <div className="min-w-0">
            {headline.trim() ? (
              <p className="line-clamp-3 text-[15px] font-medium leading-snug tracking-[-0.01em] text-foreground">
                {headline}
              </p>
            ) : null}
            {bodyCopy.trim() ? (
              <p className="mt-2 line-clamp-6 text-[13px] leading-relaxed text-muted-foreground">
                {bodyCopy}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
            {ctaLabel.trim() ? (
              <span className="inline-flex shrink-0 items-center rounded-[3px] border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                {ctaLabel}
              </span>
            ) : (
              <span />
            )}
            <span className="flex shrink-0 items-center gap-1.5">
              {pictureFailed ? (
                <ImageOff size={11} strokeWidth={1.75} className="text-muted-foreground" />
              ) : (
                <Film size={11} strokeWidth={1.75} className="text-muted-foreground" />
              )}
              <Plate className="truncate">
                {pictureFailed ? "Artwork expired" : "Copy only"}
              </Plate>
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <ImageOff size={18} strokeWidth={1.5} className="text-rack-seam" />
          <Plate className="max-w-[22ch]">
            {modality === "partial" ? "Partly captured" : "Nothing captured yet"}
          </Plate>
        </div>
      )}
    </div>
  );
}
