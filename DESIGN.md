---
name: "AdMirror"
description: "A competitive-creative engine for paid social: capture competitor ads from the public Meta Ad Library yourself, rank them honestly against what you actually captured, then turn the angle you pick into three original ad variants and a test plan."
colors:
  background: "oklch(0.198 0.006 264)"
  foreground: "oklch(0.938 0.004 264)"
  card: "oklch(0.243 0.007 264)"
  card-foreground: "oklch(0.938 0.004 264)"
  popover: "oklch(0.262 0.008 264)"
  popover-foreground: "oklch(0.945 0.004 264)"
  primary: "oklch(0.782 0.152 71)"
  primary-foreground: "oklch(0.196 0.028 62)"
  secondary: "oklch(0.303 0.008 264)"
  secondary-foreground: "oklch(0.928 0.004 264)"
  muted: "oklch(0.286 0.007 264)"
  muted-foreground: "oklch(0.716 0.011 264)"
  accent: "oklch(0.324 0.012 264)"
  accent-foreground: "oklch(0.948 0.004 264)"
  destructive: "oklch(0.586 0.196 26)"
  border: "oklch(0.348 0.009 264)"
  input: "oklch(0.318 0.009 264)"
  ring: "oklch(0.782 0.152 71)"
  rack-rail: "oklch(0.171 0.005 264)"
  rack-seam: "oklch(0.402 0.010 264)"
  rack-engrave: "oklch(0.652 0.010 264)"
  lamp-live: "oklch(0.762 0.148 143)"
  lamp-hold: "oklch(0.782 0.152 71)"
  lamp-cold: "oklch(0.548 0.012 264)"
rounded:
  sm: "calc(var(--radius) * 0.6)"
  md: "calc(var(--radius) * 0.8)"
  lg: "0.25rem"
  xl: "calc(var(--radius) * 1.4)"
  2xl: "calc(var(--radius) * 1.8)"
  3xl: "calc(var(--radius) * 2.2)"
  4xl: "calc(var(--radius) * 2.6)"
---

<!-- Generated from .project/DESIGN_SYSTEM.md + app/globals.css by the engine. Tokens above are normative and mirror the CSS; edit the CSS and DESIGN_SYSTEM.md, not this file. -->

## Overview

**Broadcast control rack.** Anodised graphite panels with milled seams and a fine horizontal grain, engraved mono plate labels, and tally lamps. One amber lamp colour is reserved for actions and live state — it never appears as decoration. Dark in both schemes on purpose: the use scene is someone reading ad accounts all day in a dim room.

## Colors

Defined in `src/app/globals.css` as the single `:root` token block (oklch). Keep the
token NAMES; change values there only.
| Token | Value |
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

Declared in `globals.css` as `--color-*` and mirrored in the frontmatter. Use the token, never a raw hex.

## Typography

- **Body / headings:** IBM Plex Sans Variable (`@fontsource-variable/ibm-plex-sans`).
  Headings are medium weight with `-0.02em`/`-0.025em` tracking, never bold-and-large.
- **Labels, numbers, code:** JetBrains Mono Variable
  (`@fontsource-variable/jetbrains-mono`) — used for engraved plate labels and all
  measurement. Loaded via Fontsource, never `next/font/google`.
- Two faces only.


## Shapes

Radii: `sm` calc(var(--radius) * 0.6), `md` calc(var(--radius) * 0.8), `lg` 0.25rem, `xl` calc(var(--radius) * 1.4), `2xl` calc(var(--radius) * 1.8), `3xl` calc(var(--radius) * 2.2), `4xl` calc(var(--radius) * 2.6)

## Do's and Don'ts

- Do load faces through Fontsource, not `next/font/google`.
- Don't introduce a colour or radius that isn't a token above.
- Don't use gradient text, or a purple/violet gradient as the brand signal.
- Don't use bounce or elastic easing; real objects decelerate smoothly.
