# IOAA.AI

**Latest build note:** Preview was timing out (ReadTimeout, no response) with turbopack panicking on its own cache: `Failed to restore task data ... Unable to open static sorted file 00003929.sst ... No such file or directory`. Cause was my previous partial clear — deleting `.next/dev/cache/turbopack` while leaving the surrounding `.next` metadata behind left `.meta` files referencing `.sst` files that no longer existed, and every worker thread panicked on restore. Fix: removed the ENTIRE `.next` directory so the dev server rebuilds from scratch. Never delete a subset of that cache again — it is all or nothing.

Hardening in the same pass: `src/app/page.tsx` reads the session through a local `currentUserOrNull()` that wraps `getUser()` in try/catch AND a 2.5s `Promise.race` timeout, falling back to `null` (i.e. signed-out, which renders the sign-in form). The front door is the page every visitor hits and needs nothing from the database to be worth showing, so a slow or unreachable database must degrade to the marketing page rather than hang it.

Front door as it stands: three beats of IOAA.AI's own copy (beat 1 "See the ads your market is running", beat 2 website → approve rivals → evidence, beat 3 the ask), sign-in living IN beat 3 via `src/components/scene/scene-sign-in.tsx` (email+password, magic link, Google gated on `googleSignInEnabled`), `signedIn` swapping the form for "Open your workspace". `src/app/start/page.tsx` is intake only and redirects signed-out visitors to `/`; all 13 signed-out guards across the app point at `/`. Types clean.

# IOAA.AI

**Latest build note:** Sign-in was broken because the app could not reach its own Supabase database, and the fix is in `src/db/index.ts` + `drizzle.config.ts`. Two compounding faults: `SUPABASE_DATABASE_URL` pointed at the DIRECT endpoint `db.<ref>.supabase.co:5432`, which resolves IPv6-only while the runtime has no IPv6 route (every connect died `ENETUNREACH`); and the pooler's cert is signed by Supabase's own CA, which node-postgres 8.22 rejects under `sslmode=require`. `src/db/index.ts` now rewrites any `db.<ref>.supabase.co` URL onto the transaction pooler (`SUPABASE_POOLER_HOST`, default `aws-0-us-east-1.pooler.supabase.com`, port 6543, username `postgres.<ref>`), uses port 5432 in session mode for `directUrl()`, and passes `ssl: { rejectUnauthorized: false }` for Supabase hosts only. `drizzle.config.ts` applies the same session-mode rewrite. Verified through the app's exact connection path: 3 users, 8 runs.

Supabase project `nunkiwiwzodhgxkwpkpz` (`admirror`, us-east-1, ACTIVE_HEALTHY) is confirmed the live source of truth — all 25 tables present and MORE data than the platform database. Do not fall back to `IMAGINE_DATABASE_URL`.

# IOAA.AI

**Latest build note:** The front page is fixed and now carries the product's real copy plus sign-in in place.

Fix: the blank render was `Module not found: Can't resolve './scene.css'` from `src/app/page.tsx`. The source no longer referenced it, but the dev server's turbopack graph held the stale edge; cleared `.next/dev/cache/turbopack` and the orphaned `src_app_scene_*.css` chunks. Those two page-level rules live at the END of `src/app/globals.css`, scoped `html:has([data-scene-root])` / `body:has([data-scene-root])`. No local CSS import on any page now, no second `:root`.

Copy: the scene was still running the fictional VECTRUS energy-company text. All three beats are now IOAA.AI's own — beat 1 "See the ads your market is running", beat 2 the website → approve rivals → evidence sequence, beat 3 the ask. The nav's five fake property names became three real section markers ("What it reads" / "How it works" / "Sign in") that scrub the scene to the beat they name via `onBeat`, so nothing is a dead link. The no-estimates disclaimer (reach ranges only; no spend/clicks/sales) is on the scene now, not just the workspace.

Sign-in moved ONTO the landing page: `src/components/scene/scene-sign-in.tsx` renders in beat 3 — email + password, magic link, and Google gated on `googleSignInEnabled` from `src/lib/auth`. `src/app/page.tsx` is now async, reads `getUser()` and passes `signedIn` + `googleEnabled` down; a signed-in visitor gets "Open your workspace" instead of the form, in both the beat and the nav. `active={s3Opacity > 0.6}` gates pointer events so the invisible card never swallows scroll. `src/app/start/page.tsx` no longer holds a sign-in panel — signed-out visitors there `redirect("/")`; `src/components/auth/sign-in-panel.tsx` is deleted. Types clean.

# IOAA.AI

**Latest build note:** Sign-in was broken because the app could not reach its own Supabase database, and the fix is in `src/db/index.ts` + `drizzle.config.ts`. Two compounding faults: `SUPABASE_DATABASE_URL` pointed at the DIRECT endpoint `db.<ref>.supabase.co:5432`, which resolves IPv6-only while the runtime has no IPv6 route (every connect died `ENETUNREACH`); and the pooler's cert is signed by Supabase's own CA, which node-postgres 8.22 rejects under `sslmode=require`. `src/db/index.ts` now rewrites any `db.<ref>.supabase.co` URL onto the transaction pooler (`SUPABASE_POOLER_HOST`, default `aws-0-us-east-1.pooler.supabase.com`, port 6543, username `postgres.<ref>`), uses port 5432 in session mode for `directUrl()`, and passes `ssl: { rejectUnauthorized: false }` for Supabase hosts only. `drizzle.config.ts` applies the same session-mode rewrite. Verified through the app's exact connection path: 3 users, 8 runs.

Supabase project `nunkiwiwzodhgxkwpkpz` (`admirror`, us-east-1, ACTIVE_HEALTHY) is confirmed the live source of truth — all 25 tables present and MORE data than the platform database. Do not fall back to `IMAGINE_DATABASE_URL`.

# IOAA.AI

**Latest build note:** Sign-in now lives ON the front door, and the scene carries the PRODUCT's copy instead of the placeholder energy-company text.

Two faults fixed first: `src/app/page.tsx` no longer imports a local `./scene.css` (those two `:has([data-scene-root])` rules now sit at the END of `src/app/globals.css`, no new `:root`), and the turbopack dev cache that still held the stale module graph (`.next/dev/cache/turbopack`, plus the orphan `src_app_scene_*.css` chunks) was cleared — that cache, not the source, was what kept re-reporting `Module not found: Can't resolve './scene.css'` on `/` AND `/start`.

New `src/components/scene/scene-sign-in.tsx` — email+password, magic link, and Google (only when `googleSignInEnabled`) in the scene's own vocabulary: square white plate, 1px navy edge, underline-only fields, uppercase tracked labels. It is the third beat of the scroll scene. `active` (s3Opacity > 0.6) gates `pointer-events` so an invisible form never swallows scroll. Success → `/start`.

`src/app/page.tsx` is now async: reads `getUser()` + `googleSignInEnabled` and passes `signedIn` / `googleEnabled` down. A signed-in visitor gets "Open your workspace" → `/start` in place of the form (no redirect, the scene still plays). Metadata title/description are the product's.

`src/app/start/page.tsx` is intake ONLY — `if (!user) redirect("/")`. Every signed-out guard across library, patterns, results, watch and all `runs/[id]/*` now redirects to `/` (13 sites) so there is exactly one sign-in surface. `src/components/auth/sign-in-panel.tsx` deleted. `MarketBrief` is left in place but currently unrendered.

Scene copy: beat 1 "See the ads your market is running right now" + the intake paragraph; beat 2 "Nothing is read until you approve the rival list" over a 4-step strip (site → approve rivals → read live ads → turn an angle into your own) with the no-spend/no-clicks/no-score disclaimer; beat 3 the sign-in. `SceneNav` lost the five fictional `VECTRUS` names — it is now the wordmark plus three real section buttons that scroll the scrub track via `toBeat(fraction)`. Every arrow button on the page moves the scroll to a named beat; nothing is decorative. Scrub engine and beat timings untouched.

Supabase project `nunkiwiwzodhgxkwpkpz` (`admirror`, us-east-1, ACTIVE_HEALTHY) remains the live source of truth — 25 tables, more data than the platform database. Do not fall back to `IMAGINE_DATABASE_URL`. The pooler/SSL rewrite in `src/db/index.ts` + `drizzle.config.ts` stands (direct `db.<ref>` endpoint is IPv6-only and unreachable here).

# IOAA.AI

**Latest build note:** The front page was rendering blank because it pulled in a separate stylesheet next to it (`src/app/scene.css`) that the dev server's module graph had gone stale on after the file moved out of the deleted `src/app/scene/` folder — `Module not found: Can't resolve './scene.css'` on every request. Fixed by deleting that one-off stylesheet and appending its two rules to the end of `src/app/globals.css`, still scoped with `html:has([data-scene-root])` / `body:has([data-scene-root])` so smooth scrolling and the white ground apply only while the scene is on screen and never leak into the workspace. `src/app/page.tsx` no longer imports any local CSS. No new `:root` block; palette untouched.

# IOAA.AI

**Latest build note:** Sign-in was broken because the app could not reach its own Supabase database, and the fix is in `src/db/index.ts` + `drizzle.config.ts`. Two compounding faults: `SUPABASE_DATABASE_URL` pointed at the DIRECT endpoint `db.<ref>.supabase.co:5432`, which resolves IPv6-only while the runtime has no IPv6 route (every connect died `ENETUNREACH`); and the pooler's cert is signed by Supabase's own CA, which node-postgres 8.22 rejects under `sslmode=require`. `src/db/index.ts` now rewrites any `db.<ref>.supabase.co` URL onto the transaction pooler (`SUPABASE_POOLER_HOST`, default `aws-0-us-east-1.pooler.supabase.com`, port 6543, username `postgres.<ref>`), uses port 5432 in session mode for `directUrl()`, and passes `ssl: { rejectUnauthorized: false }` for Supabase hosts only. `drizzle.config.ts` applies the same session-mode rewrite. Verified through the app's exact connection path: 3 users, 8 runs.

Supabase project `nunkiwiwzodhgxkwpkpz` (`admirror`, us-east-1, ACTIVE_HEALTHY) is confirmed the live source of truth — all 25 tables present and MORE data than the platform database. Do not fall back to `IMAGINE_DATABASE_URL`.

The front-door scene now has ONE real destination so nothing pretends to work: the desktop and overlay nav carry an `IOAA.AI ↗` link to `/start`, and the section-3 CTA became a `Link` to `/start` reading "Open IOAA.AI". The five fictional `VECTRUS *` property names had `href="#"`; they are now plain `<span>`s (dead links removed rather than faked), as are the `NEWS`/`CONTACT` labels. The scrub engine, beat timings and nav inversion are untouched.

# IOAA.AI

**Latest build note:** The cinematic scroll-tied scene is now the SITE'S FRONT DOOR at `/`. `src/app/page.tsx` renders it (metadata title absolute "Scroll Tied Video Section", the Helvetica Neue ME `<link>`, `data-scene-root` subtree font, `src/app/scene.css` moved up out of the deleted `src/app/scene/` folder). Only one page still resolves to `/`.

The workspace app moved intact to `/start` (`src/app/start/page.tsx` — sign-in panel + market brief when signed out, intake form when signed in). Everything that used to point at `/` now points at `/start`: every `redirect("/")` guard across library, patterns, results, watch, and all `runs/[id]/*` routes; the "New analysis" link in `src/components/rack/shell.tsx`; the empty-state buttons on library, results and watch; the fallback link on `/auth/complete`; the `after` default in `signInWithGoogle`; and the `after` fallback in `/auth/start`. `sitemap.ts` lists `/` and `/start`. Magic-link and post-sign-in pushes already went to `/library` and were left alone.

The scene's own machinery is unchanged from the previous turn (500vh track, sticky scene, WebCodecs frame bank + exponential lerp scrub, three sequential text beats, navy→white nav inversion at p>0.55, hamburger overlay below the large breakpoint). Its nav links and two CTAs are inert by design — the copy is the supplied fictional energy brand, not IOAA.AI's own routes.

# IOAA.AI

**Latest build note:** A standalone cinematic scroll-scene page now lives at `/scene`, built exactly to the supplied spec and deliberately isolated from the workspace app — its own typeface (Helvetica Neue ME via the supplied web-font link), its own light palette (navy `#1D3045` on pale footage), no rack shell, no workspace tokens, no route in the main nav.

Structure: a 500vh scroll track with one sticky full-viewport scene. The CloudFront mp4 is NEVER played — scroll position drives the playhead. `src/lib/scroll-scene/use-video-scrub.ts` fetches the mp4 once, demuxes it with mp4box@0.5.2, decodes every frame through WebCodecs `VideoDecoder`, re-encodes each as a webp blob keyed by presentation timestamp, and paints the nearest frame to the eased playhead onto a 1920×1080 canvas (binary-search nearest index, 24-bitmap LRU, LEAD=24 decode/encode throttle, hardware→software retry, 60s watchdog). The playhead uses an exponential lerp (TAU 8, SNAP 0.002) so a flicked wheel glides. Fallbacks: reduced motion, no `VideoDecoder`, decode failure or watchdog expiry all revert to `video.currentTime` seeking with the canvas hidden.

Three text beats fade in strict sequence (1: p<0.20 hold then clear; 2: 0.32→0.55; 3: from 0.67), each child rising 24px on an expo-out curve. The nav inverts navy→white at p>0.55, enters once at 200ms with an 80ms-per-link offset, and collapses below the large breakpoint into a hamburger that opens a full-screen navy panel.

`mp4box@0.5.2` was added as a dependency; `src/types/mp4box.d.ts` types the surface used. Nothing in the existing app was touched — the copy on the scene is the supplied fictional energy brand, so it is not wired to IOAA.AI's own routes and its nav links and CTAs are inert by design.

# IOAA.AI

**Latest build note:** The product is now called IOAA.AI (formerly AdMirror). The name was changed everywhere it appears to a user — the header wordmark (IOAA with a tinted .AI), the browser/tab title and share description, the sign-in panel, and every explanatory line across the run, collect, board, results, patterns, watch and library screens. No feature, query, route or data changed; internal module folder names were left as-is since they are never shown.

# AdMirror

**Latest build note:** AdMirror's data now lives in the owner's OWN Supabase project rather than the platform-provided database. The project was created, the full 25-table schema was applied from `src/db/schema.ts` (generated via drizzle-kit, applied through `run_sql`), and all existing rows were copied across and row-count verified: 2 users, 2 accounts, 3 sessions, 1 verification, 7 runs, 105 run steps, 26 competitors, 41 search references, 4 evidence batches, 119 evidence items, 119 ad scores, 4 sweep-progress rows, 1 snapshot, 47 ad observations, 47 ad statuses, 1 period briefing. Empty tables were created but had nothing to move.

`src/db/index.ts` now resolves the connection in this order: `SUPABASE_DATABASE_URL` → `IMAGINE_DATABASE_URL` → `DATABASE_URL`, so the app keeps serving from the platform database until the owner pastes their own pooled string, then switches with no code change. Only ONE value is requested of them (the pooled string on port 6543); the session-level URL used by `npm run db:push` is derived by swapping the port, in both `src/db/index.ts` (`directUrl()`) and `drizzle.config.ts`. `SUPABASE_DATABASE_URL` was declared via `secret_key_cli` and is pending the owner's paste.

Every table in the new project has RLS enabled and `anon` + `authenticated` revoked, including `usage` on the schema — the app connects as the table owner over the Postgres connection, never through the public REST endpoint, so the anon key grants no data access. Authorisation remains where it already was: `requireUser()` plus a user filter inside each server action. The security advisor reports only two INFO-level "RLS enabled, no policy" notes, which is the intended locked state.

Nothing else changed. Sign-in still runs through the same auth library against the same schema, and no query, action or UI file was touched.

**Latest build note:** The decision bar on the angles board is now exactly one row tall. The "what gets made" spec sheet no longer sits inside the bar — it opens as a floating panel above the button, so the bar measures its own row whether the sheet is open or shut and can never grow over the frames. The reason a greyed-out press is unavailable still sits directly under it, naming the numbers and the way out.
