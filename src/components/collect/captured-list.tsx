"use client";

/**
 * S3-C — what's in the capture so far.
 *
 * Each row shows the fields that matter and their provenance, so a thin item is
 * visibly thin while you're still in front of the Library and can go back for the
 * missing piece.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteEvidence } from "@/app/actions/evidence";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/rack/metric";
import { Plate } from "@/components/rack/plate";
import { asProvenance } from "@/lib/admirror/provenance";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import type { EvidenceRow } from "@/lib/admirror/queries";

const MODALITY_LABEL: Record<string, string> = {
  full: "full",
  screenshot: "screenshot",
  video: "video",
  text_only: "text only",
  partial: "partial",
};

export function CapturedList({ runId, items }: { runId: string; items: EvidenceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="px-4 py-6">
        <Plate className="block">Nothing captured yet</Plate>
        <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">
          Open a saved search, find an ad worth copying the angle of, then paste its screenshot here. The
          first one takes a minute; the rest take seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {items.map((item, index) => {
        const platforms = item.platforms.split(",").filter(Boolean);
        return (
          <div key={item.id} className="min-w-0 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="tabular mt-0.5 w-6 shrink-0 text-[11px] text-rack-seam">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="min-w-0 truncate text-[13px] text-foreground">
                    {item.advertiser || "Advertiser not captured"}
                  </span>
                  <span className="plate shrink-0 text-rack-engrave">
                    {MODALITY_LABEL[item.modality] ?? item.modality}
                  </span>
                </div>
                {item.headline ? (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.headline}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MetricChip provenance={asProvenance(item.visibleStartDateProvenance)}>
                    {item.visibleStartDate ? `Running since ${item.visibleStartDate}` : "No start date"}
                  </MetricChip>
                  <MetricChip provenance={asProvenance(item.visibleResultRankProvenance)}>
                    {item.visibleResultRank
                      ? `Appeared ${item.visibleResultRank}${
                          item.visibleResultRank === "1" ? "st" : item.visibleResultRank === "2" ? "nd" : item.visibleResultRank === "3" ? "rd" : "th"
                        } in your capture`
                      : "Result order not captured"}
                  </MetricChip>
                  {platforms.length > 0 ? (
                    <MetricChip provenance={asProvenance(item.platformsProvenance)}>
                      {platforms.map((key) => PLATFORM_LABELS[key] ?? key).join(" · ")}
                    </MetricChip>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {item.libraryUrl ? (
                  <Button variant="ghost" size="icon" className="size-8" render={<a href={item.libraryUrl} target="_blank" rel="noopener noreferrer" aria-label="Open this ad in the Ad Library" />}><ExternalLink size={13} strokeWidth={1.7} /></Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Remove this item"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteEvidence({ runId, itemId: item.id });
                      if (!result.ok) toast.error(result.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 size={13} strokeWidth={1.7} />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
