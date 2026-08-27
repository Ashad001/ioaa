/**
 * The rack frame: the chassis every screen mounts into.
 *
 * Fills the viewport edge to edge — this is a tool someone keeps open all day
 * beside their ad account, not a page that sits centred on a mat. The reading
 * column is capped inside the panes instead.
 */
import Link from "next/link";
import type { ReactNode } from "react";

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
      <header className="milled sticky top-0 z-40 flex h-12 shrink-0 items-center gap-4 border-b border-border bg-rack-rail/95 px-3 backdrop-blur-sm sm:px-4">
        <Link href="/library" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-[3px] border border-primary/45 bg-primary/12">
            <Lamp state="hold" />
          </span>
          <span className="plate hidden text-foreground sm:inline">AdMirror</span>
        </Link>
        {crumb ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
            <span aria-hidden className="text-rack-seam">
              /
            </span>
            <div className="min-w-0 truncate">{crumb}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {nav ? (
          <aside className="w-full shrink-0 border-b border-border bg-sidebar lg:w-[248px] lg:border-b-0 lg:border-r">
            {nav}
          </aside>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

/** A pane header — the engraved strip that names the panel you're looking at. */
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
        "flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-3 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-medium tracking-[-0.01em] text-foreground">{title}</h1>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The non-dismissible source-mode statement.
 *
 * This appears on the board, the gate and every export. It is not a tooltip and
 * it does not collapse, because the single most damaging thing this product could
 * do is let someone believe they are looking at the whole market.
 */
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
        "flex min-w-0 items-start gap-3 border-b border-primary/25 bg-primary/[0.07] px-4 py-3 sm:px-6",
        className,
      )}
    >
      <Lamp state="hold" className="mt-1.5" />
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed text-foreground">
          This reflects the ads <span className="font-medium">that were collected</span>, not a complete Meta
          inventory.
        </p>
        {detail ? (
          <p className="tabular mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function StepRail({ children }: { children: ReactNode }) {
  return (
    <nav className="flex flex-col lg:h-full">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-2.5">
        <Plate>Pipeline</Plate>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">{children}</div>
    </nav>
  );
}
