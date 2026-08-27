/**
 * The funnel strip: four stages of one ad, each indexed against the user's own
 * average, drawn on a shared axis.
 *
 * The axis is what makes this readable. 100 is the user's own normal and it sits
 * at a fixed position in every row, so "above" and "below" are a glance rather
 * than arithmetic. A stage nobody reported draws an empty track with the words
 * "not reported" — never a bar at zero, which would read as a catastrophic
 * result rather than a missing input.
 *
 * NOTE ON SCOPE: every number here is about the user's OWN ad, reported by them.
 * Nothing on this axis may ever come from a competitor card — the public Ad
 * Library publishes no performance figure, so there would be nothing to plot.
 */
import { fmtIndex, fmtRate, standingOf, INLINE_BAND } from "@/lib/admirror/outcome";
import { Plate } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

const TONE: Record<ReturnType<typeof standingOf>, string> = {
  above: "bg-lamp-live",
  inline: "bg-chart-2",
  below: "bg-primary",
  unknown: "bg-transparent",
};

/** Where 100% sits on the track. Fixed, so every row is comparable by eye. */
const CENTRE_PCT = 50;
/** An index of 200 fills the track. Beyond that it clamps and the label says so. */
const FULL_INDEX = 200;

function trackWidth(index: number | null): number {
  if (index === null) return 0;
  return Math.min(100, Math.max(2, (index / FULL_INDEX) * 100));
}

export function IndexBar({
  label,
  question,
  index,
  rate,
  className,
}: {
  label: string;
  /** What this stage of the ad actually tests, in the user's words. */
  question: string;
  index: number | null;
  rate: number | null;
  className?: string;
}) {
  const standing = standingOf(index);
  const width = trackWidth(index);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="plate min-w-0 truncate text-rack-engrave">{label}</span>
        <span
          className={cn(
            "tabular shrink-0 text-[13px]",
            standing === "above" && "text-lamp-live",
            standing === "below" && "text-primary",
            standing === "inline" && "text-foreground/90",
            standing === "unknown" && "text-muted-foreground italic",
          )}
        >
          {index === null ? "not reported" : fmtIndex(index)}
        </span>
      </div>

      <div className="relative mt-1.5 h-[7px] w-full overflow-hidden rounded-[2px] border border-border/70 bg-secondary/50">
        {/* The user's own normal, marked on the track itself. */}
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-rack-engrave/70"
          style={{ left: `${CENTRE_PCT}%` }}
        />
        {index === null ? null : (
          <span
            className={cn("absolute inset-y-0 left-0 rounded-[1px]", TONE[standing])}
            style={{ width: `${width}%` }}
          />
        )}
      </div>

      <p className="mt-1 min-w-0 truncate text-[11px] text-muted-foreground">
        {rate === null ? question : `${fmtRate(rate)} · ${question}`}
      </p>
    </div>
  );
}

/** The legend, said once per screen rather than per row. */
export function IndexLegend({ note }: { note: string }) {
  return (
    <div className="min-w-0 border-t border-border/60 pt-3">
      <Plate className="block">Reading the bars</Plate>
      <p className="mt-1 max-w-[70ch] text-[11.5px] leading-relaxed text-muted-foreground">
        The hairline is your own average — 100%. Anything past it did better than your
        normal, anything short of it did worse, and {INLINE_BAND.low}–{INLINE_BAND.high}%
        counts as the same. {note}
      </p>
    </div>
  );
}
