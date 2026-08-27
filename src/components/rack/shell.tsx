import Link from "next/link";
import type { ReactNode } from "react";
import { Activity } from "lucide-react";

import { Lamp, Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

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
      <header className="milled sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-rack-rail/95 px-3 backdrop-blur-sm sm:px-5">
        <Link href="/library" className="flex shrink-0 items-center gap-2.5 text-primary transition-colors duration-150 ease-out hover:text-primary/80">
          <span className="flex size-7 items-center justify-center rounded-md border border-primary/35 bg-primary/10">
            <Activity size={15} strokeWidth={2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.045em] sm:inline">AdMirror</span>
        </Link>
        <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
        {crumb ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-muted-foreground">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-rack-engrave sm:inline">Markets</span>
            <span aria-hidden className="hidden text-rack-seam sm:inline">/</span>
            <div className="min-w-0 truncate text-foreground/85">{crumb}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {nav ? (
          <aside className="w-full min-w-0 shrink-0 border-b border-border bg-sidebar lg:w-[252px] lg:border-b-0 lg:border-r">
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
          This reflects the ads <span className="font-medium">that were collected</span>, not a complete Meta inventory.
        </p>
        {detail ? (
          <p className="tabular mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        ) : null}
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
        <Plate>Research flow</Plate>
        <span className="tabular text-[10px] text-primary">LIVE</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1.5">{children}</div>
      {footer ? <div className="min-w-0 shrink-0">{footer}</div> : null}
    </nav>
  );
}
