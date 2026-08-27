"use client";

/**
 * THE MARKET AT A GLANCE — charts over what was actually collected.
 *
 * Three readings, all of them counted from the board rather than modelled:
 *
 * 1. SHARE OF THE SHEET — how many collected ads each advertiser accounts for.
 *    This is emphatically NOT share of voice or share of spend: it is share of
 *    what AdMirror managed to read, and the caption says so. Conflating the two
 *    would be the single most tempting lie this product could tell.
 * 2. WHEN THEIR ADS STARTED — the visible "Started running" dates, bucketed by
 *    month. It shows whether a market is refreshing creative or coasting.
 * 3. HOW COMPLETE EACH ADVERTISER'S RECORD IS — ads with artwork against ads
 *    that came back as copy only, because a thin record is a caveat on every
 *    conclusion drawn from it.
 *
 * Built on the chart primitives already in the project, in the light table's own
 * palette: edge-print amber for what was read, cool blue for context.
 */
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

export type MarketAd = {
  advertiser: string;
  visibleStartDate: string | null;
  hasArtwork: boolean;
};

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Parse the Library's own visible date text. Never guesses a missing one. */
function monthKey(text: string | null): string | null {
  if (!text) return null;
  const match = text.trim().toLowerCase().match(/([a-z]{3})[a-z]*\s+\d{1,2},?\s+(\d{4})/);
  if (!match) return null;
  const monthIndex = MONTHS.indexOf(match[1]);
  if (monthIndex < 0) return null;
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const index = Number(month) - 1;
  const name = MONTHS[index] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year.slice(2)}`;
}

export function MarketChart({
  ads,
  className,
}: {
  ads: MarketAd[];
  className?: string;
}) {
  const byAdvertiser = useMemo(() => {
    const map = new Map<string, { name: string; total: number; withArt: number }>();
    for (const ad of ads) {
      const name = ad.advertiser.trim() || "Unattributed";
      const entry = map.get(name) ?? { name, total: 0, withArt: 0 };
      entry.total += 1;
      if (ad.hasArtwork) entry.withArt += 1;
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [ads]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    let undated = 0;
    for (const ad of ads) {
      const key = monthKey(ad.visibleStartDate);
      if (!key) {
        undated += 1;
        continue;
      }
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const rows = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-9)
      .map(([key, count]) => ({ label: monthLabel(key), count }));
    return { rows, undated };
  }, [ads]);

  if (ads.length === 0) return null;

  const widest = byAdvertiser[0]?.total ?? 1;

  return (
    <div className={cn("min-w-0 space-y-6", className)}>
      {/* 1 · Share of the sheet — a bar per advertiser, drawn as film density. */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <Plate className="min-w-0 truncate">Ads collected, by advertiser</Plate>
          <span className="edge-print shrink-0">{ads.length} total</span>
        </div>
        <ul className="mt-3 space-y-2">
          {byAdvertiser.map((entry) => {
            const pct = Math.round((entry.total / widest) * 100);
            const artPct = entry.total > 0 ? (entry.withArt / entry.total) * 100 : 0;
            return (
              <li key={entry.name} className="min-w-0">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] text-foreground/85">
                    {entry.name}
                  </span>
                  <span className="edge-print shrink-0 tabular">
                    {entry.total}
                    {entry.withArt > 0 ? ` · ${entry.withArt} art` : ""}
                  </span>
                </div>
                <div className="relative mt-1 h-2 w-full overflow-hidden bg-film-base">
                  <div className="h-full bg-chart-2/45" style={{ width: `${pct}%` }}>
                    {/* The lit portion is the part with real artwork. */}
                    <div
                      className="h-full bg-film-edge"
                      style={{ width: `${artPct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Share of <span className="text-foreground/80">what was collected</span> — not share of
          spend or reach, which Meta doesn&rsquo;t publish. Amber is the part with artwork attached.
        </p>
      </div>

      {/* 2 · When their ads started running. */}
      {byMonth.rows.length > 1 ? (
        <div className="min-w-0">
          <Plate className="block">When these ads started running</Plate>
          <div className="mt-3 h-[132px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth.rows} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={34}
                />
                <Bar dataKey="count" radius={[1, 1, 0, 0]} maxBarSize={26}>
                  {byMonth.rows.map((row, index) => (
                    <Cell
                      key={row.label}
                      fill={
                        index === byMonth.rows.length - 1
                          ? "var(--film-edge)"
                          : "var(--chart-2)"
                      }
                      fillOpacity={index === byMonth.rows.length - 1 ? 1 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Read from each card&rsquo;s own &ldquo;started running&rdquo; line.
            {byMonth.undated > 0
              ? ` ${byMonth.undated} ad${byMonth.undated === 1 ? "" : "s"} didn't show a date.`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
