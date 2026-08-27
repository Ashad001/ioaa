<!-- OWNER: Design / Build · READERS: Build, Landing, SEO -->
# Design System

The **committed** visual direction. Build / Landing / Design MUST follow this so the
product stays consistent. Change it deliberately, and commit the change.

## Direction
**Broadcast control rack.** Anodised graphite panels with milled seams and a fine
horizontal grain, engraved mono plate labels, and tally lamps. One amber lamp colour is
reserved for actions and live state — it never appears as decoration. Dark in both
schemes on purpose: the use scene is someone reading ad accounts all day in a dim room.

## Palette
Defined in `src/app/globals.css` as the single `:root` token block (oklch). Keep the
token NAMES; change values there only.

| Token | Value |
|-------|-------|
| background | `oklch(0.198 0.006 264)` — graphite chassis |
| card / panel | `oklch(0.243 0.007 264)` |
| popover | `oklch(0.262 0.008 264)` |
| foreground | `oklch(0.938 0.004 264)` |
| muted-foreground | `oklch(0.716 0.011 264)` |
| border | `oklch(0.348 0.009 264)` |
| primary (amber tally) | `oklch(0.782 0.152 71)` |
| rack-rail | `oklch(0.171 0.005 264)` — recessed rail behind panels |
| rack-seam | `oklch(0.402 0.010 264)` — milled seam / scrollbar |
| rack-engrave | `oklch(0.652 0.010 264)` — engraved label text |
| lamp-live | `oklch(0.762 0.148 143)` — observed, cleared, done |
| lamp-hold | `oklch(0.782 0.152 71)` — your turn, running |
| lamp-cold | `oklch(0.548 0.012 264)` — not started |
| lamp-alert | `oklch(0.662 0.176 28)` — blocked, thin coverage |

## Typography
- **Body / headings:** IBM Plex Sans Variable (`@fontsource-variable/ibm-plex-sans`).
  Headings are medium weight with `-0.02em`/`-0.025em` tracking, never bold-and-large.
- **Labels, numbers, code:** JetBrains Mono Variable
  (`@fontsource-variable/jetbrains-mono`) — used for engraved plate labels and all
  measurement. Loaded via Fontsource, never `next/font/google`.
- Two faces only.

## Shape & hardware
- `--radius: 0.25rem` — machined, not soft. Pills only on small chips.
- `panel` utility: card surface + 1px border + inset top highlight + one soft shadow.
  Elevation is declared ONCE — never a border under a wide shadow.
- `plate` utility: mono, 0.6875rem, `0.14em` tracking, uppercase — the engraved label.
- `tabular` utility: tabular numerals; every figure in the app uses it.
- `milled` utility: fine horizontal grain, for the top rail only.
- Scrollbars, caret, selection and focus rings are themed from the palette.

## Components
- shadcn/ui in `src/components/ui` (Base UI under the hood — use the `render` prop, NOT
  `asChild`).
- Rack chrome in `src/components/rack`: `Plate`, `Lamp`, `Panel`, `Readout`, `Screw`,
  `Metric` / `MetricChip` / `ProvenanceBadge`, `EbosGauge`, `CoverageMeter`,
  `CoverageBand`, `RackShell`, `PaneHeader`, `SourceModeNotice`, `StepItem`, `AdRender`.
- Icons: `lucide-react`, named imports, `strokeWidth` 1.5–1.8, sizes 11–18.

## Layout
- The app shell fills the viewport (`lg:h-dvh`, panes scroll internally). No centred mat,
  no outer page padding on tool screens.
- Content pages cap at 1000–1240px; reading text caps around 62–68ch inside a pane.
- Every grid/flex child holding a label carries `min-w-0`, plus `truncate` where text can
  be long. Sibling panes share ONE height mechanism.

## Motion
- Only where it carries information: lamps pulse while something runs, the coverage bar
  fills, the composer flashes its border when a paste lands.
- Easing from the `--ease-*` tokens (the `ease-out` / `ease-in-out` utilities emit real
  beziers). Never a bare CSS keyword, never a one-off cubic-bezier, never bounce.

## Do's and Don'ts
- Amber is for actions and live state only. Creative thumbnails are the only other
  saturated colour on a board.
- Don't add a second `:root` block, don't use raw hex in components, don't run
  `shadcn init`, don't use `next/font/google`.

## Provenance badges — one new, and it is the only lit one
Every fact on screen carries a provenance badge (see `src/lib/admirror/provenance.ts`).
They are all outlined or muted, deliberately, so nothing shouts — with ONE exception:
- **`published_by_meta` (META)** is the only FILLED badge (`bg-primary text-primary-foreground`).
  It marks the reach figure Meta itself publishes, which is the strongest claim the app
  makes, so it is the one fact allowed to look lit.
- Reach renders as Meta's own BAND ("10K–50K"), never narrowed to a single number. An ad
  with no published figure renders the words "reach not published" in muted text —
  NEVER a zero, never a blank, because a reader who sees 0 concludes the ad is failing.
- On a competitor row the same rule holds at advertiser level: the largest published band
  plus "N of M ads carry a figure", or one muted sentence saying Meta publishes none.
  Bands are never added together — a summed range is a figure nobody published.
