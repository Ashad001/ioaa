"use client";

/**
 * THE FETCH TICKER — what is being read, right now, counted.
 *
 * This is the panel the user watches while IOAA.AI reads the Library. Two rules
 * decide everything about it:
 *
 * 1. EVERY NUMBER HERE WAS COUNTED. The big figure is ads actually read off
 *    pages that came back; the bar's denominator is the real number of searches
 *    in this press. Nothing advances on a timer. A bar that fills while a search
 *    sits blocked is worse than no bar, because it teaches the user that the
 *    app's numbers are decoration.
 * 2. IT SAYS WHAT IT IS DOING TO WHOM. "Reading Bulk" beats "Loading…", and when
 *    a search comes back empty or blocked, that lands as its own line with its
 *    own lamp rather than being averaged away into a percentage.
 *
 * The film-strip readout underneath is one chip per settled search, so the shape
 * of the sweep — six good, one blocked — is legible at a glance.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchProgress } from "@/app/actions/progress";
import { Counter, Lamp, Plate } from "@/components/rack/plate";
import type { ProgressSnapshot } from "@/lib/admirror/progress";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  idle: "Standing by",
  discovering: "Finding who advertises in your market",
  reading: "Reading their live ads",
  filing: "Filing what came back",
  scoring: "Ranking the sheet",
  done: "Finished",
};

const STATE_LAMP: Record<string, "live" | "hold" | "cold" | "alert"> = {
  ok: "live",
  empty: "cold",
  blocked: "alert",
  failed: "alert",
};

export function FetchTicker({
  runId,
  /** True while the runner has a server action in flight. */
  active,
  className,
}: {
  runId: string;
  active: boolean;
  className?: string;
}) {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await fetchProgress(runId);
        if (!cancelled) setSnapshot(next);
      } catch {
        // A dropped poll is not worth surfacing — the next one covers it.
      }
    }

    void poll();

    // Poll only while something is genuinely in flight. A finished sweep does
    // not need a heartbeat, and neither does a run nobody is watching.
    if (active) {
      timer.current = setInterval(() => void poll(), 1_500);
    }

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [active, runId]);

  if (!snapshot || snapshot.phase === "idle") return null;

  const running = active && snapshot.phase !== "done";
  const { searchesDone, searchesTotal, adsFound, adsWithArt, settled } = snapshot;
  const pct =
    searchesTotal > 0 ? Math.min(100, Math.round((searchesDone / searchesTotal) * 100)) : 0;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-end gap-6">
          <Counter value={adsFound} label="Ads read" live={running} />
          <Counter
            value={`${searchesDone}/${searchesTotal}`}
            label={snapshot.phase === "discovering" ? "Terms swept" : "Searches"}
          />
          {adsWithArt > 0 ? <Counter value={adsWithArt} label="With artwork" /> : null}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {running ? (
            <Loader2 size={13} strokeWidth={2} className="shrink-0 animate-spin text-film-edge" />
          ) : (
            <Lamp state="done" className="shrink-0" />
          )}
          <Plate className="min-w-0 truncate">
            {PHASE_LABEL[snapshot.phase] ?? snapshot.phase}
            {running && snapshot.currentLabel ? ` · ${snapshot.currentLabel}` : ""}
          </Plate>
        </div>
      </div>

      {/* The light bar under the sheet: real fraction of real searches. */}
      <div className="relative mt-4 h-1.5 w-full overflow-hidden bg-film-base">
        <div
          className="h-full bg-film-edge transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        {running ? (
          <div
            aria-hidden
            className="loupe-sweeping absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-table-glow/45 to-transparent"
          />
        ) : null}
      </div>

      {/* One chip per settled search — the shape of the sweep at a glance. */}
      {settled.length > 0 ? (
        <ul className="mt-4 flex min-w-0 flex-wrap gap-1.5">
          {settled.map((entry, index) => (
            <li
              key={`${entry.label}-${index}`}
              className="developing emulsion flex min-w-0 max-w-[220px] items-center gap-2 border border-border/60 px-2 py-1.5"
            >
              <Lamp state={STATE_LAMP[entry.state] ?? "cold"} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground/85">
                {entry.label}
              </span>
              <span className="edge-print shrink-0">{entry.ads}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
