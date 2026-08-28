---
name: "AdMirror"
colors:
  background: "oklch(0.132 0.01 260)"
  foreground: "oklch(0.949 0.006 180)"
  card: "oklch(0.163 0.012 258)"
  card-foreground: "oklch(0.949 0.006 180)"
  popover: "oklch(0.188 0.013 258)"
  popover-foreground: "oklch(0.956 0.006 180)"
  primary: "oklch(0.738 0.152 162)"
  primary-foreground: "oklch(0.168 0.022 165)"
  secondary: "oklch(0.203 0.013 258)"
  secondary-foreground: "oklch(0.924 0.007 180)"
  muted: "oklch(0.183 0.012 258)"
  muted-foreground: "oklch(0.665 0.017 225)"
  accent: "oklch(0.236 0.018 258)"
  accent-foreground: "oklch(0.956 0.006 180)"
  destructive: "oklch(0.661 0.196 28)"
  border: "oklch(0.285 0.014 258)"
  input: "oklch(0.239 0.013 258)"
  ring: "oklch(0.738 0.152 162)"
  rack-rail: "oklch(0.112 0.009 260)"
  rack-seam: "oklch(0.388 0.015 252)"
  rack-engrave: "oklch(0.63 0.019 218)"
  film-base: "oklch(0.145 0.011 260)"
  film-rebate: "oklch(0.219 0.013 258)"
  film-edge: "oklch(0.738 0.152 162)"
rounded:
  sm: "calc(var(--radius) * 0.6)"
  md: "calc(var(--radius) * 0.8)"
  lg: "0.4rem"
  xl: "calc(var(--radius) * 1.4)"
  2xl: "calc(var(--radius) * 1.8)"
  3xl: "calc(var(--radius) * 2.2)"
  4xl: "calc(var(--radius) * 2.6)"
---

<!-- Generated from .project/DESIGN_SYSTEM.md + app/globals.css by the engine. Tokens above are normative and mirror the CSS; edit the CSS and DESIGN_SYSTEM.md, not this file. -->

## Overview

**Prediction-market console.** A near-black live market surface with compact data modules, a finely striped top rail, dense numerical readouts, and one electric green signal. It suits the real use scene: a marketer cross-checking competitive ads at a desk, where the important question is what is moving and why.

## Colors

Defined in `src/app/globals.css` as the single `:root` token block (oklch). Keep the
token NAMES; change values there only.
| Token | Value |
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

Declared in `globals.css` as `--color-*` and mirrored in the frontmatter. Use the token, never a raw hex.

## Typography

- **Body / headings:** Archivo Variable (`@fontsource-variable/archivo`). Headings use
  a tight weight and tracking, never an oversized display treatment.
- **Labels, numbers, code:** Martian Mono Variable
  (`@fontsource-variable/martian-mono`) — used for status, identifiers, and all
  measurements.
- Two faces only.


## Shapes

Radii: `sm` calc(var(--radius) * 0.6), `md` calc(var(--radius) * 0.8), `lg` 0.4rem, `xl` calc(var(--radius) * 1.4), `2xl` calc(var(--radius) * 1.8), `3xl` calc(var(--radius) * 2.2), `4xl` calc(var(--radius) * 2.6)

## Do's and Don'ts

- Do load faces through Fontsource, not `next/font/google`.
- Don't introduce a colour or radius that isn't a token above.
- Don't use gradient text, or a purple/violet gradient as the brand signal.
- Don't use bounce or elastic easing; real objects decelerate smoothly.
