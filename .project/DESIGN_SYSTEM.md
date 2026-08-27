<!-- OWNER: Design / Build · READERS: Build, Landing, SEO -->
# Design System

The **committed** visual direction. Build / Landing / Design MUST follow this so the
product stays consistent. Change it deliberately, and commit the change.

## Direction
**Prediction-market console.** A near-black live market surface with compact data
modules, a finely striped top rail, dense numerical readouts, and one electric green
signal. It suits the real use scene: a marketer cross-checking competitive ads at a
desk, where the important question is what is moving and why.

## Palette
Defined in `src/app/globals.css` as the single `:root` token block (oklch). Keep the
token NAMES; change values there only.

| Token | Value |
|-------|-------|
| background | `oklch(0.132 0.01 260)` — near-black console ground |
| card / panel | `oklch(0.163 0.012 258)` — compact market module |
| popover | `oklch(0.188 0.013 258)` |
| foreground | `oklch(0.949 0.006 180)` — cool white |
| muted-foreground | `oklch(0.665 0.017 225)` — blue-grey utility text |
| border | `oklch(0.285 0.014 258)` — low-contrast graphite rule |
| primary | `oklch(0.738 0.152 162)` — the green live signal |
| rack-rail | `oklch(0.112 0.009 260)` — top rail and scroll track |
| rack-seam | `oklch(0.388 0.015 252)` — dividers and inactive figures |
| rack-engrave | `oklch(0.63 0.019 218)` — labels and secondary metadata |
| lamp-live | `oklch(0.738 0.152 162)` — observed, cleared, done |
| lamp-hold | `oklch(0.754 0.161 82)` — reading, needs attention |
| lamp-cold | `oklch(0.485 0.016 252)` — not started |
| lamp-alert | `oklch(0.661 0.196 28)` — blocked or failed |

## Typography
- **Body / headings:** Archivo Variable (`@fontsource-variable/archivo`). Headings use
  a tight weight and tracking, never an oversized display treatment.
- **Labels, numbers, code:** Martian Mono Variable
  (`@fontsource-variable/martian-mono`) — used for status, identifiers, and all
  measurements.
- Two faces only.

## Shape & console grammar
- `--radius: 0.4rem` — panels are crisp market modules with small friendly corners.
- `panel` utility: dark panel surface, one fine border, one inset top highlight. No
  wide shadows or floating dashboard cards.
- `plate` utility: mono, compact uppercase label for a field or section.
- `edge-print` utility: green mono identifier for a live count or active reading.
- `tabular` utility: every figure and date uses tabular numerals.
- `milled` utility: subtle vertical striping on the top rail only.
- Scrollbars, caret, selection, and focus rings are themed from the same palette.

## Components
- shadcn/ui in `src/components/ui` (Base UI under the hood — use the `render` prop,
  NOT `asChild`).
- Console chrome in `src/components/rack`: `Plate`, `Lamp`, `Panel`, `Readout`,
  `Metric` / `MetricChip` / `ProvenanceBadge`, `EbosGauge`, `CoverageMeter`,
  `CoverageBand`, `RackShell`, `PaneHeader`, `SourceModeNotice`, `StepItem`, `AdRender`.
- Icons: `lucide-react`, named imports, `strokeWidth` 1.5–1.8, sizes 11–18.

## Layout
- The app shell fills the viewport (`lg:h-dvh`, panes scroll internally). No centred
  mat and no outer page padding on tool screens.
- Content pages cap at 1000–1240px; reading text caps around 62–68ch inside a pane.
- Every grid/flex child holding a label carries `min-w-0`, plus `truncate` where text
  can be long. Sibling panes share ONE height mechanism.
- The top rail is short and information-dense; the rail names the current market area
  without becoming a second navigation layer.

## Motion
- Only where it carries information: lamps pulse while something runs; the market
  pulse bar marks a live process, and the composer flashes its border when a paste lands.
- Easing comes from the `--ease-*` tokens (the `ease-out` / `ease-in-out` utilities
  emit real beziers). Never a bare CSS keyword or a one-off cubic-bezier.

## Do's and Don'ts
- Green is for a live signal, the primary action, or an actively observed state — not
  for decoration.
- Use amber only for an in-progress or attention state. Use red only for actual failure.
- Keep panels dense, flat, and data-first; avoid oversized rounded cards and glossy glow.
- Don’t add a second `:root` block, don’t use raw hex in components, don’t run
  `shadcn init`, don’t use `next/font/google`.

## Provenance badges — one new, and it is the only lit one
Every fact on screen carries a provenance badge (see `src/lib/admirror/provenance.ts`).
They are all outlined or muted, deliberately, so nothing shouts — with ONE exception:
- **`published_by_meta` (META)** is the only FILLED badge (`bg-primary text-primary-foreground`).
  It marks the reach figure Meta itself publishes, which is the strongest claim the app
  makes, so it is the one fact allowed to look lit.
- Reach renders as Meta's own BAND ("10K–50K"), never narrowed to a single number. An ad
  with no published figure renders the words "reach not published" in muted text — NEVER
  a zero, never a blank, because a reader who sees 0 concludes the ad is failing.
- On a competitor row the same rule holds at advertiser level: the largest published band
  plus "N of M ads carry a figure", or one muted sentence saying Meta publishes none.
  Bands are never added together — a summed range is a figure nobody published.
