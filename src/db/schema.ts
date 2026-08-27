/**
 * The app's database schema.
 *
 * ADD YOUR TABLES AT THE BOTTOM. The four tables above the marker belong to the
 * authentication library: it reads and writes them itself, their column names are
 * part of its contract, and renaming or "tidying" one breaks sign-in in a way that
 * type-checks perfectly and only fails at runtime. Leave them exactly as they are.
 *
 * Anything that belongs to a person gets a `userId` column referencing
 * `user.id` with `onDelete: "cascade"`. That single choice is what makes "delete
 * my account" actually delete someone's data instead of orphaning it — which is
 * a legal obligation, not a nicety.
 *
 * After any change here run `npm run db:push` once to apply it.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Authentication (managed by the auth library — do not modify) ─────────────

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_email_idx").on(t.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("session_token_idx").on(t.token),
    index("session_user_idx").on(t.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

// ─── Your tables go below this line ───────────────────────────────────────────
//
// Example — delete it once you have real tables of your own:
//
// export const note = pgTable(
//   "note",
//   {
//     id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//     userId: text("user_id")
//       .notNull()
//       .references(() => user.id, { onDelete: "cascade" }),
//     title: text("title").notNull(),
//     body: text("body").notNull().default(""),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   // Index the column you filter by. Every query for a user's own rows filters
//   // on user_id, and without this each one is a full table scan.
//   (t) => [index("note_user_idx").on(t.userId)],
// );
// ─── Your tables go below this line ───────────────────────────────────────────
//
// AdMirror, Browser Evidence Mode.
//
// The shape here follows one rule above all others: a number about a competitor's
// ad exists only because a human saw it and entered it, or because we derived it
// from something a human submitted. So every fact that could be mistaken for a
// performance figure carries its own provenance column, and nothing is ever
// back-filled with a guess.

/** run pipeline status — mirrors the 15-step state machine. */
export const run = pgTable(
  "run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    brandName: text("brand_name").notNull(),
    brandWebsite: text("brand_website"),
    /** e.g. "AE" / "GCC — Arabic" — the market label the user chose. */
    marketLabel: text("market_label").notNull(),
    marketCountries: text("market_countries").notNull().default(""),
    marketLanguages: text("market_languages").notNull().default(""),
    objectives: text("objectives").notNull().default(""),
    mediaType: text("media_type").notNull().default("all"),
    lookbackDays: text("lookback_days").notNull().default("90"),
    /** INTAKE · BRAND_RESEARCH · COMPETITOR_MAP · DISCOVERY_PLAN · AWAITING_EVIDENCE
     *  · ANALYSING · AWAITING_GATE · GENERATING · DELIVERED */
    status: text("status").notNull().default("INTAKE"),
    /** Highest completed pipeline step number, 1–15. */
    stepCursor: text("step_cursor").notNull().default("1"),
    /** Brand dossier, stored as JSON text so it stays inspectable. */
    dossier: text("dossier"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("run_user_idx").on(t.userId)],
);

/** One row per pipeline step, so the console shows real state, not a spinner. */
export const runStep = pgTable(
  "run_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    stepNumber: text("step_number").notNull(),
    name: text("name").notNull(),
    /** pending · running · blocked_on_user · done · failed */
    state: text("state").notNull().default("pending"),
    detail: text("detail").notNull().default(""),
    elapsedMs: text("elapsed_ms").notNull().default("0"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("run_step_run_idx").on(t.runId)],
);

export const competitor = pgTable(
  "competitor",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** DIRECT · ADJACENT · ATTENTION */
    tier: text("tier").notNull().default("DIRECT"),
    whyUseful: text("why_useful").notNull().default(""),
    /** 0–100, a model's confidence in this being a real competitor here. */
    confidence: text("confidence").notNull().default("50"),
    pruned: boolean("pruned").notNull().default(false),
  },
  (t) => [index("competitor_run_idx").on(t.runId)],
);

/**
 * A saved public Ad Library search — the record of WHERE ads on the board came
 * from. AdMirror runs these searches itself against the PUBLIC Library page, and
 * the user can open the same link to check our reading against the real thing.
 */
export const searchReference = pgTable(
  "search_reference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    competitorName: text("competitor_name").notNull(),
    country: text("country").notNull(),
    language: text("language").notNull().default("any"),
    mediaType: text("media_type").notNull().default("all"),
    activeStatus: text("active_status").notNull().default("active"),
    /** Human-readable summary of the filters this search encodes. */
    filterSummary: text("filter_summary").notNull().default(""),
    /** The URL the user opens. Built by us, or pasted by them. */
    url: text("url").notNull(),
    /** plan · user_pasted */
    origin: text("origin").notNull().default("plan"),
    /** Kept verbatim when a pasted URL could not be parsed. */
    rawInput: text("raw_input"),
    parsed: boolean("parsed").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("search_reference_run_idx").on(t.runId)],
);

/** A capture session: one closed batch of evidence against saved searches. */
export const evidenceBatch = pgTable(
  "evidence_batch",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** open · closed */
    state: text("state").notNull().default("open"),
    /** 0–1, stored as text to keep the exact submitted value. */
    coverageScore: text("coverage_score"),
    coverageBand: text("coverage_band"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("evidence_batch_run_idx").on(t.runId)],
);

/**
 * One submitted ad. Each factual column has a sibling provenance column holding
 * one of: observed_in_user_evidence · user_asserted · derived_from_evidence ·
 * model_interpretation · unknown.
 */
export const evidenceItem = pgTable(
  "evidence_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => evidenceBatch.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    searchReferenceId: text("search_reference_id").references(
      () => searchReference.id,
      { onDelete: "set null" },
    ),
    /** url · text · screenshot · recording · manual */
    intakeKind: text("intake_kind").notNull().default("manual"),
    /** full · screenshot · video · text_only · partial */
    modality: text("modality").notNull().default("partial"),

    advertiser: text("advertiser").notNull().default(""),
    advertiserProvenance: text("advertiser_provenance").notNull().default("unknown"),
    libraryUrl: text("library_url"),
    libraryUrlProvenance: text("library_url_provenance").notNull().default("unknown"),
    headline: text("headline").notNull().default(""),
    headlineProvenance: text("headline_provenance").notNull().default("unknown"),
    bodyCopy: text("body_copy").notNull().default(""),
    bodyCopyProvenance: text("body_copy_provenance").notNull().default("unknown"),
    ctaLabel: text("cta_label").notNull().default(""),
    ctaProvenance: text("cta_provenance").notNull().default("unknown"),
    /** Comma-separated: facebook,instagram,audience_network,messenger */
    platforms: text("platforms").notNull().default(""),
    platformsProvenance: text("platforms_provenance").notNull().default("unknown"),
    /** active · inactive · unknown — what the Library showed the user. */
    activeStatus: text("active_status").notNull().default("unknown"),
    activeStatusProvenance: text("active_status_provenance").notNull().default("unknown"),
    /** The start date visible in the Library, as text (never inferred). */
    visibleStartDate: text("visible_start_date"),
    visibleStartDateProvenance: text("visible_start_date_provenance")
      .notNull()
      .default("unknown"),
    /** Where it appeared in the result order the user captured, 1-based. */
    visibleResultRank: text("visible_result_rank"),
    visibleResultRankProvenance: text("visible_result_rank_provenance")
      .notNull()
      .default("unknown"),
    market: text("market").notNull().default(""),
    language: text("language").notNull().default(""),
    /** When the user saw it. */
    observedAt: timestamp("observed_at").notNull().defaultNow(),

    /** Uploaded artefact, if any: a screenshot or recording the user attached. */
    artefactUrl: text("artefact_url"),
    artefactType: text("artefact_type"),
    artefactSha256: text("artefact_sha256"),
    /** quarantined · clear — an upload is analysable only once cleared. */
    artefactScan: text("artefact_scan"),

    /** Model reading of the ad's structure, JSON text. */
    teardown: text("teardown"),
    /** Concept cluster key — repeated angles group under one card. */
    conceptKey: text("concept_key").notNull().default(""),
    conceptLabel: text("concept_label").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("evidence_item_run_idx").on(t.runId),
    index("evidence_item_batch_idx").on(t.batchId),
  ],
);

/** The Evidence-Backed Opportunity Score, with every input kept auditable. */
export const adScore = pgTable(
  "ad_score",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    evidenceItemId: text("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => evidenceBatch.id, { onDelete: "cascade" }),
    ebos: text("ebos").notNull(),
    coverageScore: text("coverage_score").notNull(),
    coverageBand: text("coverage_band").notNull(),
    /** Every component value, weight, and what was dropped. JSON text. */
    inputs: text("inputs").notNull().default("{}"),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
  },
  (t) => [
    index("ad_score_run_idx").on(t.runId),
    uniqueIndex("ad_score_item_idx").on(t.evidenceItemId),
  ],
);

/** The human gate: which angles the user selected, and whether they forced past warnings. */
export const gateDecision = pgTable(
  "gate_decision",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    selectedItemIds: text("selected_item_ids").notNull().default(""),
    coverageAtGate: text("coverage_at_gate").notNull().default(""),
    coverageBandAtGate: text("coverage_band_at_gate").notNull().default(""),
    forced: boolean("forced").notNull().default(false),
    /** JSON text: the matrix the user chose at the gate, and its asset count. */
    matrix: text("matrix").notNull().default("{}"),
    overrides: text("overrides").notNull().default("{}"),
    decidedAt: timestamp("decided_at").notNull().defaultNow(),
  },
  (t) => [index("gate_decision_run_idx").on(t.runId)],
);

/** A generated variant: script, first frame prompt, captions, gate results. */
export const creativeVariant = pgTable(
  "creative_variant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    /** The evidence item whose ANGLE this inherited — provenance, not asset reuse. */
    sourceItemId: text("source_item_id").references(() => evidenceItem.id, {
      onDelete: "set null",
    }),
    variantIndex: text("variant_index").notNull().default("1"),
    hookLabel: text("hook_label").notNull().default(""),
    hookLine: text("hook_line").notNull().default(""),
    /** Beats, VO, on-screen text — JSON text. */
    script: text("script").notNull().default("{}"),
    firstFramePrompt: text("first_frame_prompt").notNull().default(""),
    motionPrompt: text("motion_prompt").notNull().default(""),
    primaryText: text("primary_text").notNull().default(""),
    headline: text("headline").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default(""),
    /**
     * What this cell hands over: `video` (a hook cut onto the shared body) or
     * `static` (that same opening frame with the headline burned in — no extra
     * render call, which is why it ships alongside every video).
     */
    assetKind: text("asset_kind").notNull().default("video"),
    /** primary · contrast — the format axis of the matrix. */
    formatAxis: text("format_axis").notNull().default("primary"),
    /**
     * Every hook variant within one format shares ONE body, so the only thing
     * that differs between them really is the hook. This key is the proof of
     * which body a cell was cut onto.
     */
    sharedBodyKey: text("shared_body_key").notNull().default(""),
    /** JSON text: alternative primary-text options for this cell. */
    altCopy: text("alt_copy").notNull().default("[]"),
    /** JSON text: similarity, brand, safety gate results. */
    gates: text("gates").notNull().default("{}"),
    /** queued · writing · rendering · ready · blocked */
    state: text("state").notNull().default("queued"),
    testRole: text("test_role").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("creative_variant_run_idx").on(t.runId)],
);

export const runRelations = relations(run, ({ many }) => ({
  steps: many(runStep),
  competitors: many(competitor),
  searches: many(searchReference),
  batches: many(evidenceBatch),
  items: many(evidenceItem),
  variants: many(creativeVariant),
}));

export const evidenceBatchRelations = relations(evidenceBatch, ({ one, many }) => ({
  run: one(run, { fields: [evidenceBatch.runId], references: [run.id] }),
  items: many(evidenceItem),
}));

export const evidenceItemRelations = relations(evidenceItem, ({ one }) => ({
  batch: one(evidenceBatch, {
    fields: [evidenceItem.batchId],
    references: [evidenceBatch.id],
  }),
  search: one(searchReference, {
    fields: [evidenceItem.searchReferenceId],
    references: [searchReference.id],
  }),
  score: one(adScore, {
    fields: [evidenceItem.id],
    references: [adScore.evidenceItemId],
  }),
}));
