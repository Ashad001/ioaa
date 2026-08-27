import { ArrowUpRight, Eye, Radar, ScanSearch } from "lucide-react";

import { EdgeCode, Plate } from "@/components/rack/plate";

const SIGNALS = [
  { label: "Field reading", value: "Awaiting website", trend: "Your category sets the search" },
  { label: "Rival set", value: "You approve", trend: "No collection before the list is right" },
  { label: "Evidence board", value: "Live ads", trend: "Artwork and reach stay attached" },
];

export function MarketBrief() {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Plate className="min-w-0 truncate">Market intelligence</Plate>
        <EdgeCode className="shrink-0">Ready to read</EdgeCode>
      </div>
      <h1 className="mt-4 max-w-[11ch] text-balance text-[34px] font-semibold leading-[0.98] tracking-[-0.05em] text-foreground sm:text-[48px]">
        See what your market is saying now.
      </h1>
      <p className="mt-5 max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
        AdMirror maps the live ads in your field, holds onto the evidence, then turns the angle you choose into original creative for your business.
      </p>

      <div className="mt-9 overflow-hidden rounded-md border border-border bg-card">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Radar size={15} strokeWidth={1.7} className="shrink-0 text-primary" />
            <span className="min-w-0 truncate text-[13px] font-medium">Market pulse</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
            <span className="size-1.5 rounded-full bg-primary lamp-pulsing" />
            Observed
          </span>
        </div>

        <div className="grid min-w-0 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {SIGNALS.map((signal, index) => (
            <div key={signal.label} className="min-w-0 px-4 py-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Plate className="min-w-0 truncate">{signal.label}</Plate>
                {index === 0 ? <ScanSearch size={13} strokeWidth={1.7} className="shrink-0 text-rack-engrave" /> : null}
                {index === 1 ? <Eye size={13} strokeWidth={1.7} className="shrink-0 text-rack-engrave" /> : null}
                {index === 2 ? <ArrowUpRight size={13} strokeWidth={1.7} className="shrink-0 text-rack-engrave" /> : null}
              </div>
              <p className="mt-4 truncate text-[15px] font-medium tracking-[-0.02em] text-foreground">{signal.value}</p>
              <div className="mt-3 h-px w-full overflow-hidden bg-border">
                <div className="h-full bg-primary" style={{ width: `${[52, 78, 64][index]}%` }} />
              </div>
              <p className="mt-2 min-h-9 text-[11px] leading-relaxed text-muted-foreground">{signal.trend}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 max-w-[60ch] text-[11.5px] leading-relaxed text-muted-foreground">
        Meta only publishes selected reach ranges. AdMirror never fills in spend, clicks, sales, or a made-up performance score.
      </p>
    </div>
  );
}
