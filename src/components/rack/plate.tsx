import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Plate({
  children,
  className,
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "h2" | "h3" | "legend" | "label";
}) {
  return <Tag className={cn("plate text-rack-engrave", className)}>{children}</Tag>;
}

export function EdgeCode({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("edge-print", className)}>{children}</span>;
}

export type LampState = "live" | "hold" | "cold" | "alert" | "done";

const LAMP_COLOR: Record<LampState, string> = {
  live: "bg-lamp-live",
  hold: "bg-lamp-hold",
  cold: "bg-lamp-cold",
  alert: "bg-lamp-alert",
  done: "bg-lamp-live",
};

export function Lamp({
  state,
  pulsing = false,
  className,
}: {
  state: LampState;
  pulsing?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        LAMP_COLOR[state],
        state === "cold" ? "opacity-55" : "shadow-[0_0_7px_-1px_currentColor]",
        pulsing && "lamp-pulsing",
        className,
      )}
      style={{ color: "currentColor" }}
    />
  );
}

export function Panel({
  children,
  className,
  label,
  aside,
}: {
  children: ReactNode;
  className?: string;
  label?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={cn("panel lightbox overflow-hidden rounded-md", className)}>
      {(label || aside) && (
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          {label ? <Plate className="min-w-0 truncate text-rack-engrave">{label}</Plate> : <span />}
          {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function Rebate({
  className,
  orientation = "vertical",
}: {
  className?: string;
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block shrink-0 bg-film-rebate",
        orientation === "vertical" ? "perforated w-2.5" : "h-2.5 w-full",
        className,
      )}
    />
  );
}

export function Readout({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Plate className="block truncate">{label}</Plate>
      <div className="tabular mt-1 truncate text-[15px] font-medium leading-tight text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function Counter({
  value,
  label,
  live = false,
  className,
}: {
  value: ReactNode;
  label?: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "tabular font-mono text-[26px] font-semibold leading-none tracking-[-0.03em]",
          live ? "text-film-edge" : "text-foreground",
        )}
      >
        {value}
      </div>
      {label ? <Plate className="mt-1.5 block truncate">{label}</Plate> : null}
    </div>
  );
}
