<!-- OWNER: Build (with the user) · READERS: every agent · READ THIS FIRST -->
# AdMirror

**One-liner:** A competitive-creative engine for paid social: capture competitor ads from the public Meta Ad Library yourself, rank them honestly against what you actually captured, then turn the angle you pick into three original ad variants and a test plan.

## Goal
Give a marketer the winning ANGLE from their market's ads — the hook mechanism, the objection, the beat order — rewritten as their own ad, without ever inventing a performance figure Meta does not publish.

## Target users
Founders, in-house marketers and freelancers running paid social themselves, in a specific country/language market.

## Status
- Stage: building
- Live URL: —
- Repo: —

## What exists today
- **Intake** — brand, website, market (8 presets + custom builder), objective chips, advanced media/lookback. States up front that capture is the user's job.
- **Research console** — 15-step pipeline rail with tally lamps; brand read (positioning, ICP, voice, proof shape) and an editable/prunable competitor map across DIRECT / ADJACENT / ATTENTION.
- **Search plan** — one saved Ad Library search per competitor × country × language, each with an Open button. Users can paste their own search URL; the filters are parsed and shown back.
- **Collect evidence** — three-pane capture tool. ⌘/Ctrl+V anywhere attaches a screenshot, ad copy or a Library link; Enter commits. Per-field `observed` toggles, live coverage meter with a "go and get" list.
- **Evidence board** — cards grouped by concept cluster, opportunity gauge always paired with its coverage band, provenance badge on every fact, teardown drawer showing the score's own arithmetic including dropped components.
- **Human gate** — select angles, thin coverage requires an explicit "generate anyway", selection survives a refresh.
- **Creative** — angle transfer + three hooks over one shared body, per-variant script/copy/render briefs, similarity + claim + brand + provenance + message-match gates, and a test plan.
- **The matrix, chosen at the gate** — statics alongside every video (built from the frame each already has, no extra render), an optional customer-filmed cut, and three copy options per ad. The asset count and the shared-body count are shown BEFORE the press, capped at 12 per press.
- **Handoff** — the provenance record: one row per asset naming the ad whose angle it inherited, the day the user saw it, and what a gate held back. Plus the round-by-round test plan (one variable per round, kill and winner criteria stated up front, un-costed and saying so without an ad account) and a one-click download of the whole run as a brief and a spreadsheet.
- **Compare captures** — comparability panel first, then honest diff buckets. Absence is never "killed".
- **Run library** — every run with its status, capture count and coverage band.
- Accounts and storage use the platform's own database and file storage.

## Constraints / must-nots
- **Never request a Meta Ad Library URL.** No scraping, no automation, no background fetch, no competitor media download. A pasted URL is a stored reference and a link the user clicks.
- **No invented performance figures.** Forbidden for competitor ads: best/top performing, impressions, spend, ROAS, CTR, conversion rate, scaling budget. Enforced by `npm run check:wording` (blocking).
- **Every number renders through `<Metric>`**, which requires a `provenance` prop with no default. Unknown renders as "not captured", never 0 and never blank.
- **An opportunity score never appears without its coverage band.**
- **A missing ad is "not observed in the latest submitted snapshot"** — "likely no longer active" needs three comparable snapshots.
- Angle transfer, not asset transfer: never their footage, voice, talent, marks or wording.
- Steps 2–3, 8 and 10–14 are deterministic derivations today (no model provider wired) and are labelled as readings, not facts. Steps 12–13 produce render briefs, not files.
- **One body per angle × format, never one per hook** — `sharedBodyKey` is the proof, and the handoff counts them. Regenerating the body per variant would make the test measure uncontrolled variation instead of the hook.
- **One variable per test round.** The planner never emits a round that moves hook and format together, and never invents a delivery cost: with no ad account connected the plan is un-costed and says so.
- Message match is a WARNING, never a block — AdMirror does not fetch the destination page and will not refuse to deliver over a page it doesn't control.
- Exported spreadsheet cells are neutralised against formula injection; the text came from an untrusted paste and is data, never a formula.
