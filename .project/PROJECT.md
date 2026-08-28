# IOAA.AI

**Latest build note:** The product is now called IOAA.AI (formerly AdMirror). The name was changed everywhere it appears to a user — the header wordmark (IOAA with a tinted .AI), the browser/tab title and share description, the sign-in panel, and every explanatory line across the run, collect, board, results, patterns, watch and library screens. No feature, query, route or data changed; internal module folder names were left as-is since they are never shown.

# AdMirror

**Latest build note:** AdMirror's data now lives in the owner's OWN Supabase project rather than the platform-provided database. The project was created, the full 25-table schema was applied from `src/db/schema.ts` (generated via drizzle-kit, applied through `run_sql`), and all existing rows were copied across and row-count verified: 2 users, 2 accounts, 3 sessions, 1 verification, 7 runs, 105 run steps, 26 competitors, 41 search references, 4 evidence batches, 119 evidence items, 119 ad scores, 4 sweep-progress rows, 1 snapshot, 47 ad observations, 47 ad statuses, 1 period briefing. Empty tables were created but had nothing to move.

`src/db/index.ts` now resolves the connection in this order: `SUPABASE_DATABASE_URL` → `IMAGINE_DATABASE_URL` → `DATABASE_URL`, so the app keeps serving from the platform database until the owner pastes their own pooled string, then switches with no code change. Only ONE value is requested of them (the pooled string on port 6543); the session-level URL used by `npm run db:push` is derived by swapping the port, in both `src/db/index.ts` (`directUrl()`) and `drizzle.config.ts`. `SUPABASE_DATABASE_URL` was declared via `secret_key_cli` and is pending the owner's paste.

Every table in the new project has RLS enabled and `anon` + `authenticated` revoked, including `usage` on the schema — the app connects as the table owner over the Postgres connection, never through the public REST endpoint, so the anon key grants no data access. Authorisation remains where it already was: `requireUser()` plus a user filter inside each server action. The security advisor reports only two INFO-level "RLS enabled, no policy" notes, which is the intended locked state.

Nothing else changed. Sign-in still runs through the same auth library against the same schema, and no query, action or UI file was touched.

**Latest build note:** The decision bar on the angles board is now exactly one row tall. The "what gets made" spec sheet no longer sits inside the bar — it opens as a floating panel above the button, so the bar measures its own row whether the sheet is open or shut and can never grow over the frames. The reason a greyed-out press is unavailable still sits directly under it, naming the numbers and the way out.
