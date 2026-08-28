import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowUpRight, Search } from "lucide-react";

import { Lamp, Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

const MARKET_LINKS = [
  { href: "/library", label: "Runs" },
  { href: "/patterns", label: "Patterns" },
  { href: "/results", label: "Results" },
  { href: "/watch", label: "Watchlist" },
];

export function RackShell({
  children,
  nav,
  crumb,
  actions,
}: {
  children: ReactNode;
  nav?: ReactNode;
  crumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-rack-rail">
        <div className="milled flex h-12 min-w-0 items-center gap-3 px-3 sm:px-5">
          <Link
            href="/library"
            className="flex shrink-0 items-center gap-2 text-primary transition-colors duration-150 ease-out hover:text-primary/80"
          >
            <span className="flex size-6 items-center justify-center rounded-[4px] border border-primary/45 bg-primary/10">
              <Activity size={14} strokeWidth={2.1} />
            </span>
            <span className="text-[16px] font-semibold tracking-[-0.055em]">IOAA.AI</span>
          </Link>
          <nav aria-label="Main" className="hidden min-w-0 items-center gap-4 border-l border-border pl-4 md:flex">
            {MARKET_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <div className="hidden h-7 min-w-0 max-w-[260px] flex-1 items-center gap-2 rounded-md border border-border bg-secondary/45 px-2.5 lg:flex">
              <Search size={12} strokeWidth={1.7} className="shrink-0 text-rack-engrave" />
              <span className="min-w-0 truncate text-[11px] text-rack-engrave">Search a saved run</span>
              <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[8px] text-rack-engrave">/</span>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        </div>
        <div className="flex h-8 min-w-0 items-center gap-3 overflow-hidden border-t border-border/70 bg-background px-3 sm:px-5">
          <div className="flex shrink-0 items-center gap-1.5">
            <Lamp state="live" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">Live library</span>
          </div>
          <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
          {crumb ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.11em] text-rack-engrave sm:inline">Market desk</span>
              <span aria-hidden className="hidden shrink-0 text-rack-seam sm:inline">/</span>
              <div className="min-w-0 truncate text-foreground/85">{crumb}</div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-primary"
          >
            New analysis <ArrowUpRight size={11} strokeWidth={1.7} />
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {nav ? (
          <aside className="w-full min-w-0 shrink-0 border-b border-border bg-sidebar lg:w-[252px] lg:border-r lg:border-b-0">
            {nav}
          </aside>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

export function PaneHeader({
  title,
  hint,
  actions,
  className,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/50 px-4 py-3.5 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
        {hint ? <p className="mt-0.5 max-w-[72ch] text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SourceModeNotice({
  detail,
  className,
}: {
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 border-b border-primary/20 bg-primary/[0.055] px-4 py-3 sm:px-6",
        className,
      )}
    >
      <Lamp state="hold" className="mt-1.5" />
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed text-foreground">
          This view reflects the ads <span className="font-medium">you collected</span>, not the full Meta inventory.
        </p>
        {detail ? <p className="tabular mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export function StepRail({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <nav className="flex flex-col lg:h-full">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
        <Plate>Analysis flow</Plate>
        <span className="tabular text-[10px] text-primary">LIVE</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1.5">{children}</div>
      {footer ? <div className="min-w-0 shrink-0">{footer}</div> : null}
    </nav>
  );
}
            <span className="text-[16px] font-semibold tracking-[-0.045em]">
              IOAA<span className="text-primary/60">.AI</span>
            </span>
