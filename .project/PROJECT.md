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
