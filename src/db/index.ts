/**
 * The app's database connection. Server-side only.
 *
 * Two connections, and the difference matters:
 *
 *   `db`       — pooled. What every query in the app uses. This app runs
 *                serverless: each server action is a fresh, short-lived
 *                connection, and an unpooled Postgres endpoint runs out of
 *                connection slots under even light traffic.
 *   `directUrl`— unpooled. Only for schema changes (`npm run db:push`), which
 *                need a session-level connection the transaction pooler can't
 *                give them.
 *
 * Never import this file from a client component. It reads a live credential;
 * bundling it for the browser is a leak, and Next.js will fail the build if you
 * try — treat that error as the guardrail working, not as something to route
 * around with a `"use client"` shim.
 */
// node-postgres over the pooled endpoint — NOT the HTTP driver.
//
// The HTTP driver is a little faster for one-shot queries and cannot run a
// transaction at all: it throws "No transactions support" on the first one. A
// generated app writing an order and its line items, or moving a balance between
// two rows, would compile cleanly and then crash for a real user. This app runs on
// a long-lived Node server, so a module-level pool keeps connections warm anyway
// and the HTTP driver's advantage is largely theoretical here. Do not swap it.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

/**
 * Supabase's shared connection pooler.
 *
 * This is not a preference, it is the only address that works. A Supabase
 * project's DIRECT endpoint (`db.<ref>.supabase.co`) resolves to an IPv6 address
 * ONLY — projects on current plans get no dedicated IPv4 — and this app's runtime
 * has no IPv6 route out, so every connection to it dies with ENETUNREACH before a
 * single query is sent. That failure looks exactly like a broken app: sign-in
 * fails with a generic error and nothing is wrong in the code. The pooler
 * publishes A records, so it is reachable.
 *
 * The region is part of the pooler hostname and cannot be derived from the
 * connection string, so it stays overridable for a project provisioned
 * elsewhere. The default matches this app's project region.
 */
const supabasePoolerHost =
  process.env.SUPABASE_POOLER_HOST ?? "aws-0-us-east-1.pooler.supabase.com";

/** The project ref, if this hostname is a Supabase DIRECT endpoint. */
function supabaseProjectRef(hostname: string): string | null {
  const match = hostname.toLowerCase().match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return match ? match[1] : null;
}

/**
 * Rewrite a Supabase DIRECT connection string onto the pooler.
 *
 * Two things change and both are required: the host (see above) and the
 * username, which the pooler needs tenant-qualified as `postgres.<ref>` so it
 * knows which project a connection belongs to. `session` selects the pooler's
 * session-mode port (5432) rather than transaction mode (6543) — schema changes
 * need a session, ordinary queries do not.
 *
 * A string already pointed at a pooler, or at anything that is not Supabase, is
 * returned untouched.
 */
function toReachableUrl(raw: string, session = false): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const ref = supabaseProjectRef(url.hostname);
  if (!ref) return raw;

  url.hostname = supabasePoolerHost;
  url.port = session ? "5432" : "6543";
  if (url.username === "postgres") url.username = `postgres.${ref}`;
  return url.toString();
}

/** True when a connection string points at Supabase (direct or pooled). */
function isSupabaseHost(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  } catch {
    return false;
  }
}

/**
 * The app's connection string.
 *
 * `SUPABASE_DATABASE_URL` is checked FIRST: this app's data lives in the owner's
 * own Supabase project, and that variable is the one the owner supplies. Until it
 * is set the app keeps running on the platform-provided database, so the
 * switch-over is a paste rather than an outage.
 *
 * `IMAGINE_DATABASE_URL` comes next and is not cosmetic. The environment this app
 * is built in already defines `DATABASE_URL` for a local database of its own, and
 * Next.js gives the process environment precedence over the environment file — so
 * reading `DATABASE_URL` alone silently connects the app to the wrong database
 * while migrations go to the right one. That failure looks like a working app
 * until the data is gone.
 *
 * `DATABASE_URL` remains the last fallback so the app still runs anywhere you
 * deploy it with the conventional variable set.
 */
function connectionUrl(): string | undefined {
  const ownProject = process.env.SUPABASE_DATABASE_URL;
  if (ownProject) return toReachableUrl(ownProject);

  return process.env.IMAGINE_DATABASE_URL ?? process.env.DATABASE_URL;
}

function connect(): Database {
  if (instance) return instance;
  const connectionString = connectionUrl();
  if (!connectionString) {
    throw new Error(
      "No database connection is configured. This app's database is provided " +
        "automatically — if you are seeing this, the environment did not load.",
    );
  }
  instance = drizzle(
    new Pool({
      connectionString,
      // Supabase's pooler presents a certificate signed by Supabase's own CA,
      // which is not in the system trust store — and node-postgres now treats
      // `sslmode=require` as full verification, so the handshake is rejected
      // outright ("self-signed certificate in certificate chain") and no query
      // ever runs. The connection stays encrypted; only the chain check is
      // relaxed, which is what every Supabase pooler client does. Untouched for
      // every other host.
      ...(isSupabaseHost(connectionString)
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      // Small on purpose. The connection string points at a transaction pooler
      // that is already multiplexing for us, and a large per-instance pool just
      // holds server-side slots idle.
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }),
    { schema },
  );
  return instance;
}

/**
 * Query interface for the whole app. Import this, not the driver.
 *
 * Connects LAZILY, on the first query. That indirection is load-bearing rather
 * than clever: `next build` imports every module, so a connection created at
 * module scope would fail the production build of any app that doesn't use a
 * database — including one that only has the sign-in route sitting unused in the
 * template. Deferring to first use means the error surfaces where it is
 * actionable (a request that genuinely needed data) instead of breaking builds
 * that never touch it.
 */
export const db = new Proxy({} as Database, {
  get: (_target, property, receiver) => Reflect.get(connect(), property, receiver),
  has: (_target, property) => Reflect.has(connect(), property),
});

/** True when this app has a database. Cheap, no connection made — use it to
 *  branch at build time or to render an honest "not configured" state. */
export const hasDatabase = (): boolean => Boolean(connectionUrl());

/** True when the app is reading the owner's own Supabase project rather than the
 *  platform-provided database. Used only for honest reporting — no query path
 *  branches on it. */
export const usingOwnDatabase = (): boolean =>
  Boolean(process.env.SUPABASE_DATABASE_URL);

/** Unpooled URL for schema operations. Falls back to the pooled one so a missing
 *  direct URL degrades to "migrations work, just less reliably" rather than
 *  "migrations crash".
 *
 *  For Supabase the owner pastes ONE string — the pooled one on port 6543. The
 *  session-level endpoint is the same host on 5432, so it is derived rather than
 *  asked for twice: a schema change needs a session connection that the
 *  transaction pooler cannot give it. */
export const directUrl = (): string => {
  const suppliedOwn = process.env.SUPABASE_DATABASE_URL_UNPOOLED;
  if (suppliedOwn) return toReachableUrl(suppliedOwn, true);

  const ownProject = process.env.SUPABASE_DATABASE_URL;
  if (ownProject) return toReachableUrl(ownProject, true);

  const supplied =
    process.env.IMAGINE_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL_UNPOOLED;
  if (supplied) return supplied;

  return connectionUrl() ?? "";
};

export { schema };
