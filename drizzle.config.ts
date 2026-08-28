import type { Config } from "drizzle-kit";

/**
 * Schema tooling config (`npm run db:push`).
 *
 * Points at the UNPOOLED connection deliberately: schema changes take advisory
 * locks and run in a session, neither of which survives a transaction pooler.
 * Pushing through the pooled URL appears to work and then hangs or half-applies.
 */

/**
 * The owner's own Supabase project comes first, and only ONE string is asked of
 * them — the pooled one on port 6543. The session endpoint is the same host on
 * 5432, so it is derived here rather than requested twice.
 */
function schemaUrl(): string {
  const explicitDirect =
    process.env.SUPABASE_DATABASE_URL_UNPOOLED ??
    process.env.IMAGINE_DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL_UNPOOLED;

  const ownPooled = process.env.SUPABASE_DATABASE_URL;
  if (ownPooled) {
    return (
      process.env.SUPABASE_DATABASE_URL_UNPOOLED ??
      ownPooled.replace(":6543/", ":5432/")
    );
  }

  // Imagine-prefixed first: the build environment defines its own DATABASE_URL,
  // and picking that one would apply the schema to a throwaway local database
  // while the app reads the real one (or vice versa).
  return (
    explicitDirect ??
    process.env.IMAGINE_DATABASE_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: schemaUrl(),
  },
  // Never touch anything the app did not define. The database is shared with the
  // auth library's own bookkeeping; an unfiltered push is how a "harmless" schema
  // sync drops a table it did not recognise.
  strict: true,
  verbose: true,
} satisfies Config;
