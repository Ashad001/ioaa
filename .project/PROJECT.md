<!-- OWNER: Build (with the user) · READERS: every agent · READ THIS FIRST -->
# AdMirror

**One-liner:** A competitive-creative engine for paid social: give it your website, it finds who advertises against you and collects their live ads from the public Meta Ad Library itself, ranks them honestly against what it actually collected, then turns the angle you pick into three original ad variants and a test plan.

## Goal
Give a marketer the winning ANGLE from their market's ads — the hook mechanism, the objection, the beat order — rewritten as their own ad, without ever inventing a performance figure Meta does not publish.

## Target users
Founders, in-house marketers and freelancers running paid social themselves, in a specific country/language market.

## Status
- Stage: building
- Live URL: —
- Repo: —

## What exists today
- **Intake — ONE FIELD.** The user's website, nothing else. Brand name, market, country/language and category words are all read off the site and shown back as editable. Objective and brand-name override are optional, behind a disclosure.
- **Automatic collection (autopilot).** Unattended from website to ranked board: reads the site, discovers who is really advertising by sweeping the public Ad Library for the site's own category words, runs one search per advertiser, files every ad found, then dedupes, scores and tears down. ~30s discovery, ~90s collection. Stops once, at the human gate.
- **Competitor discovery is EVIDENCE, not a guess** — every advertiser on the map was seen running live ads in the market under a category word from the user's own site, and the row says which word found them.
- **Provenance kind added: "read from the public Ad Library"** (LIB badge) — a weaker claim than a human seeing the ad, and distinct from it. Still no performance figure anywhere: Meta publishes none for commercial ads.
- **Per-search outcome recorded** — every search stores what its last sweep did (ads read, plain-words note, ok/empty/blocked/failed) and the collected screen shows a lamp + note per search. "Nobody advertises under this term" and "the page wouldn't load" are never conflated.
- **Everything gets swept** — pasted searches AND hand-added competitors are collected immediately on save (a hand-added name auto-gets its own search, or it would be invisible to the collector). Searches are swept never-swept-first, then stalest, so a long competitor list can't leave later ones permanently unread.
- **A re-sweep that finds nothing new is a SUCCESS**, not a failure: it means the market hasn't moved. The empty collection it opened is discarded so the previous ranked board stands rather than blanking. Only a sweep where NOTHING could be read reports failure.
- **Manual capture stays first-class** — the sweep is best-effort, so a blocked search or thin market leaves real gaps; the paste/screenshot composer fills them and is scored identically.
- **Research console** — 15-step pipeline rail with tally lamps; live collection progress, brand read (positioning, ICP, voice, proof shape, plus what the site says and the words searched under) and an editable/prunable competitor map across DIRECT / ADJACENT / ATTENTION.
- **Search plan** — one saved Ad Library search per competitor × country × language, each with an Open button. Users can paste their own search URL; the filters are parsed and shown back.
- **Collected ads (review)** — three panes: searches swept, the collected ads, live coverage with a "still missing" list. Manual composer is a disclosure below the list; ⌘/Ctrl+V still attaches a screenshot, ad copy or a Library link. "Sweep again" pulls in newer ads without duplicating what is on the board.
- **Evidence board** — cards grouped by concept cluster, opportunity gauge always paired with its coverage band, provenance badge on every fact, teardown drawer showing the score's own arithmetic including dropped components.
- **Human gate** — select angles, thin coverage requires an explicit "generate anyway", selection survives a refresh.
- **Creative** — angle transfer + three hooks over one shared body, per-variant script/copy/render briefs, similarity + claim + brand + provenance + message-match gates, and a test plan.
- **The matrix, chosen at the gate** — statics alongside every video (built from the frame each already has, no extra render), an optional customer-filmed cut, and three copy options per ad. The asset count and the shared-body count are shown BEFORE the press, capped at 12 per press.
- **Handoff** — the provenance record: one row per asset naming the ad whose angle it inherited, the day the user saw it, and what a gate held back. Plus the round-by-round test plan (one variable per round, kill and winner criteria stated up front, un-costed and saying so without an ad account) and a one-click download of the whole run as a brief and a spreadsheet.
- **Compare captures** — comparability panel first, then honest diff buckets. Absence is never "killed".
- **Run library** — every run with its status, capture count and coverage band.
- **Watchtower — honest change over time.** Every closed sweep is filed as a dated snapshot with one observation per ad and each ad's standing. A per-run watchtower shows the period briefing (what appeared, what changed, what is no longer being read), each ad's status with its basis, and every sweep on record. A cross-run watchtower lists the markets on watch and which are due a look. `/watch` and `/runs/[id]/watch`.
- **The three-comparable-sweep rule is executable, not documented.** `likely no longer active` requires three CONSECUTIVE COMPARABLE sweeps missing an ad; a non-comparable sweep freezes the counter rather than advancing it, and a sighting resets it. `npm run check:wording` now runs the real derivation and blocks if that stops being true.
- **Rank movement only against a comparable sweep** — otherwise the card draws a dash, never a zero: "nothing to compare to" is not "did not move".
- **A watch is a reminder, never a crawler.** Cadence (7/14/30 days) schedules a nudge carrying the saved searches and filters; the person presses sweep. Nothing wakes up and asks Meta for anything.
- **The digest refuses to send on a quiet or non-comparable period** and records why. An email about nothing is how a digest gets ignored.
- **THE CLOSED LOOP — the measured half (`07`).** The one place in the app where real performance figures legitimately exist, because they are the user's OWN, about their own ads, reported by them off their own dashboard. Structurally walled off from the evidence half: own-brand data lives in its OWN tables (`shippedAd`, `shippedResult`, `ownAd`, `accountBaseline`, `hookPattern`), so it can never enter an evidence percentile base or move a competitor's opportunity score.
- **Mark shipped → report numbers → get a beat-level reading.** On the handoff screen the user marks which variants they actually ran; `/results` takes raw counts (views, clicks, spend, results, video quartiles — never a pre-typed rate) and returns which stage of the funnel failed: hook, body, offer or downstream. Next-move suggestions are specific ("move the proof beat earlier"), never "the creative didn't resonate".
- **The refusal is the feature.** Under 1,000 views, under 3 days live, or with no baseline, `diagnose()` returns `insufficient_data` with a reason and NO stage, NO reading, NO next moves and NO pattern signal — a refusal replaces a verdict, never sits beside one. There is no override. `npm run check:wording` now runs the real `diagnose()` and asserts all three refusals plus that a well-measured ad still gets a verdict.
- **Everything is indexed against the user's OWN normal.** Stated account averages first, else the median of their own other measured ads (min 3, self excluded), else nothing. There is no industry benchmark anywhere in the app and never will be — inventing one is the same sin as inventing a competitor's spend. Every card states which comparison it used.
- **`/patterns` — the cross-run hook library.** Mechanism × format × category × market, recomputed (never incremented) from shipped results. A cell under 5 measured ads comes back with every index NULL and reads `too_thin` — the numbers are dropped in the roll-up, not hidden in the UI, so no screen can render one. Twenty shipped-but-unmeasured ads still read too_thin: shipping is not evidence of working.
- **The "You" row on the board (phase 0).** The user's own ad pinned above the competitor evidence, carrying measured figures and NO opportunity ring, while competitors keep their score and get NO cost per result. The asymmetry is stated rather than resolved — one shared gauge would imply a comparison the data cannot support. Their own copy also feeds the voice read, which beats inferring register from a homepage.
- **AdMirror holds NO ad-account access.** It does not publish, pause, launch or pull insights (a departure from the brief's phases 16–17, which need a token and a reviewed app). The user launches in their own ads manager and reports back. A button that claimed to launch would be the one dishonest control in the product.
- Accounts and storage use the platform's own database and file storage.

- **The score's weighting can now be fitted to the user's own results, and never applies itself.** Once 40 of their shipped ads have 7+ days of reported numbers and a traceable source angle, AdMirror regresses each ad's indexed cost per result against the opportunity components of the angle it came from, and PROPOSES a new weighting: old vector beside new, sample size, per-component sample and direction, fit quality, and the sentence saying a correlation inside one account proves nothing about advertising in general. Two buttons, no auto-apply, no "recommended" badge. Below the threshold there is a refusal and NO numbers at all — and it separates "not enough ads yet" from "some of yours are simply still too new", because that part of the gap closes on its own.
- **Only an accepted weighting is live.** A proposed row is inert by construction: the ranking reads the accepted row only, one per account, and falls back to AdMirror's own weighting when there is none or when a stored vector no longer parses. Already-ranked boards keep the weighting they were ranked under — each score stores the vector it used, so the teardown still shows the arithmetic that really ran. Movement is clamped and renormalised so no single signal can take over the ranking or be switched off, and the honesty check executes all of this: the refusal below 40 ads, the never-auto-apply fallback, and that every proposed vector sums to 1.
- Reverting to AdMirror's own weighting is one click, and every proposal is kept as history so a weak fit isn't re-offered as if it were new.

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
