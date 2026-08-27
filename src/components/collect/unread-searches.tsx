"use client";

/**
 * WHAT THE SWEEP COULDN'T READ — the pane that keeps a gap visible.
 *
 * WHY THIS EXISTS. Until now the collect screen had one story for every empty
 * result: nothing here. But "this rival is running no live ads" and "the reader
 * could not reach this search" are opposite facts. The first is market
 * intelligence the user should act on; the second is our failure and costs them
 * a rival they were counting on seeing. Presented identically, the second
 * silently becomes the first — the user concludes a competitor has gone quiet
 * when in truth nobody looked.
 *
 * So the two are split, counted, and the unreachable ones get the one action
 * that actually resolves them: read those searches again, and only those.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw, SignalZero, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { sweepUnread } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { EdgeCode, Plate } from "@/components/rack/plate";
import type { SearchRow } from "@/lib/admirror/queries";

export function UnreadSearches({
  runId,
  searches,
}: {
  runId: string;
  searches: SearchRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = searches.filter(
    (row) => row.lastSweepState === "blocked" || row.lastSweepState === "failed",
  );
  const quiet = searches.filter((row) => row.lastSweepState === "empty");

  if (unread.length === 0 && quiet.length === 0) return null;

  return (
    <div className="min-w-0 border-b border-border px-4 py-3.5">
      {unread.length > 0 ? (
        <div className="min-w-0 border-l-2 border-lamp-alert/70 bg-lamp-alert/[0.06] px-3.5 py-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <WifiOff
                size={14}
                strokeWidth={1.7}
                className="mt-0.5 shrink-0 text-lamp-alert"
              />
              <div className="min-w-0">
                <Plate className="block">
                  {unread.length} search{unread.length === 1 ? "" : "es"} left unread
                </Plate>
                <p className="mt-1 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
                  These weren&rsquo;t reached, so we know nothing about them either way. That is
                  not the same as a rival running no ads.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await sweepUnread(runId);
                  if (!result.ok) toast.error(result.error);
                  else toast.success("Read those searches again — anything found is on the sheet.");
                  router.refresh();
                })
              }
            >
              <RefreshCw size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">
                {pending ? "Reading…" : "Read these again"}
              </span>
            </Button>
          </div>

          <ul className="mt-2.5 space-y-1">
            {unread.slice(0, 6).map((row) => (
              <li key={row.id} className="flex min-w-0 items-baseline gap-2">
                <EdgeCode className="shrink-0">·</EdgeCode>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                  {row.competitorName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {quiet.length > 0 ? (
        <div className="mt-2.5 flex min-w-0 items-start gap-2.5 border-l-2 border-border bg-card/40 px-3.5 py-2.5">
          <SignalZero
            size={14}
            strokeWidth={1.7}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
          <p className="min-w-0 max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
            <span className="text-foreground">
              {quiet.length} rival{quiet.length === 1 ? "" : "s"} genuinely quiet
            </span>{" "}
            — read by keyword and by name, with no live ads in this market:{" "}
            {quiet
              .slice(0, 5)
              .map((row) => row.competitorName)
              .join(", ")}
            {quiet.length > 5 ? ` and ${quiet.length - 5} more` : ""}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
