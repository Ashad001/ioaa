/**
 * Light-table hardware: the small physical pieces the whole interface is
 * assembled from.
 *
 * The world is A PHOTOGRAPHIC CONTACT SHEET ON A LIGHT TABLE — cold illuminated
 * glass, film chips with perforated rebates and orange edge-print codes, a loupe,
 * and a red grease pencil for the frames you choose. These components are that
 * vocabulary, so no screen has to reinvent it: grease-pencil red stays reserved
 * for selection and the one real action, and the amber edge code is for
 * identifiers and measurement, never for a button.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A silkscreen legend printed on the light box's frame. */
export function Plate({
  children,
  className,
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "h2" | "h3" | "legend";
}) {
  return <Tag className={cn("plate text-rack-engrave", className)}>{children}</Tag>;
}

/**
 * A latent edge code — the film stock's own orange printing down the rebate.
 * Identifiers, counts and measurement live here.
 */
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

/** A lamp on the light box. Pulses only while something is genuinely running. */
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

/** A sheet of illuminated glass, light spilling from its top seam. */
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
    <section className={cn("panel lightbox rounded-sm", className)}>
      {(label || aside) && (
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
          {label ? <Plate className="min-w-0 truncate">{label}</Plate> : <span />}
          {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * The perforated rebate down the edge of a strip of 35mm film. Purely material —
 * it is the thing that makes a row of frames read as film rather than as cards.
 */
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

/** A labelled readout: silkscreen caption above a tabular value. */
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
      <div className="tabular mt-1 truncate text-[15px] leading-tight text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/**
 * A big counted number — the frame counter on the box.
 *
 * Used for anything the app COUNTED. Never for a figure it inferred, because a
 * number in this typeface reads as measured and that has to stay true.
 */
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
          "tabular font-mono text-[26px] font-semibold leading-none tracking-[-0.02em]",
          live ? "text-film-edge" : "text-foreground",
        )}
      >
        {value}
      </div>
      {label ? <Plate className="mt-1.5 block truncate">{label}</Plate> : null}
    </div>
  );
}
