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
    /**
     * What the last sweep of THIS search actually did. Without these three the
     * app cannot tell the user why a competitor has no ads — an empty market, a
     * blocked page and a search that was never reached all look identical, and
     * "we don't know" presented as "nothing there" is exactly the kind of quiet
     * fabrication the provenance rules exist to prevent.
     */
    lastSweptAt: timestamp("last_swept_at"),
    /** Ads READ from the page last time, as text. Null = never swept. */
    lastSweepCount: text("last_sweep_count"),
    /** Plain-words outcome, shown verbatim in the UI. */
    lastSweepNote: text("last_sweep_note"),
    /** ok · empty · blocked · failed — drives the lamp beside the search. */
    lastSweepState: text("last_sweep_state"),
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

    /**
     * THE PICTURE THE PUBLIC CARD SHOWS.
     *
     * This is the address the Ad Library page itself points at — we keep the
     * reference and let the reader's own browser load it, exactly as it would if
     * they opened the Library. Nothing is downloaded or re-hosted, so this is a
     * pointer, never a copy, and it can go dead when Meta rotates it. The UI
     * must therefore survive a picture that fails to load.
     */
    creativeUrl: text("creative_url"),
    /** The advertiser's small round profile picture from the same card. */
    advertiserAvatarUrl: text("advertiser_avatar_url"),
    /** True when the card's creative was a video rather than a still. */
    isVideo: boolean("is_video").notNull().default(false),

    /**
     * REACH, AS META PUBLISHES IT — and only when it does.
     *
     * Meta prints no impressions on an ordinary commercial ad card, but its own
     * Library data does carry a banded reach figure for some ads. Where one
     * exists it is stored here verbatim, with provenance `published_by_meta`,
     * and it is the ONLY numeric claim in this app about how much an ad is being
     * seen. Where none exists both columns stay null and every surface says
     * "not published" — never a zero, never an estimate.
     */
    impressionsLower: text("impressions_lower"),
    impressionsUpper: text("impressions_upper"),
    impressionsProvenance: text("impressions_provenance").notNull().default("unknown"),
    /** How many creative variations Meta says this one ad runs. */
    adVariantCount: text("ad_variant_count").notNull().default("1"),

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

/**
 * THE LIVE FETCH TICKER — one row per run, rewritten as the sweep progresses.
 *
 * The count on screen while ads are being read has to be a real count of ads
 * actually read, not a bar that fills on a timer. Progress theatre is a lie with
 * a friendly face: it tells the user the machine is fine at the exact moment it
 * may have stalled. So the collector writes here after EVERY search settles, and
 * the console reads it back.
 */
export const sweepProgress = pgTable("sweep_progress", {
  runId: text("run_id")
    .primaryKey()
    .references(() => run.id, { onDelete: "cascade" }),
  /** discovering · reading · filing · scoring · done · idle */
  phase: text("phase").notNull().default("idle"),
  /** Searches finished / searches in this press. */
  searchesDone: text("searches_done").notNull().default("0"),
  searchesTotal: text("searches_total").notNull().default("0"),
  /** Ads READ off the public pages so far this press. */
  adsFound: text("ads_found").notNull().default("0"),
  /** Ads that were new to the board (the rest were already filed). */
  adsNew: text("ads_new").notNull().default("0"),
  /** Ads whose card carried real artwork. */
  adsWithArt: text("ads_with_art").notNull().default("0"),
  /** The competitor whose search is being read right now. */
  currentLabel: text("current_label").notNull().default(""),
  /** JSON text: [{label, ads, state}] — one entry per settled search. */
  perSearch: text("per_search").notNull().default("[]"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
    /**
     * THE DELIVERY SPEC, stamped on the asset rather than assumed.
     * `1080x1920` etc., and the runtime in seconds (0 for a static).
     */
    outputResolution: text("output_resolution").notNull().default("1080x1920"),
    outputDurationSeconds: text("output_duration_seconds").notNull().default("9"),
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

/**
 * THE WATCHTOWER — a sweep remembered as a dated, comparable snapshot.
 *
 * A single closed capture is a photograph of one afternoon. The intelligence in
 * competitive creative is in the derivative: what appeared, what stopped
 * appearing, whose angle is being repeated more. That derivative is only honest
 * if the app can say WHETHER TWO CAPTURES WERE EVEN COMPARABLE — same searches,
 * same country, same language, same media filter. Hence `comparableHash`: two
 * snapshots are comparable only when their hashes match, and the components are
 * stored alongside so the screen can name WHICH condition differs instead of just
 * refusing to compare.
 */
export const snapshot = pgTable(
  "snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => evidenceBatch.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
    itemCount: text("item_count").notNull().default("0"),
    coverageScore: text("coverage_score"),
    coverageBand: text("coverage_band"),
    /** Hash of the declared conditions. Equal hash = comparable snapshots. */
    comparableHash: text("comparable_hash").notNull().default(""),
    /** JSON text: the conditions themselves, so the UI can name the difference. */
    declaredFilters: text("declared_filters").notNull().default("{}"),
    /** Sequence number within the run — 1 is the first ever snapshot. */
    ordinal: text("ordinal").notNull().default("1"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("snapshot_run_idx").on(t.runId)],
);

/**
 * One ad, seen or not seen, in one snapshot.
 *
 * `matchRule` records HOW this observation was tied to the same ad in an earlier
 * snapshot — by its Library link, by identical copy, or by advertiser + headline.
 * A match the user cannot verify is a diff they will not trust, so the rule is
 * shown next to the claim rather than kept internal.
 */
export const adObservation = pgTable(
  "ad_observation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshot.id, { onDelete: "cascade" }),
    /** The stable identity of the ad across snapshots. */
    adKey: text("ad_key").notNull(),
    /** The item in THIS snapshot, when it was observed. Null when absent. */
    evidenceItemId: text("evidence_item_id").references(() => evidenceItem.id, {
      onDelete: "set null",
    }),
    observed: boolean("observed").notNull().default(true),
    advertiser: text("advertiser").notNull().default(""),
    headline: text("headline").notNull().default(""),
    conceptKey: text("concept_key").notNull().default(""),
    conceptLabel: text("concept_label").notNull().default(""),
    variantCount: text("variant_count").notNull().default("1"),
    copyHash: text("copy_hash").notNull().default(""),
    assetHash: text("asset_hash").notNull().default(""),
    /** library_link · identical_copy · advertiser_and_headline */
    matchRule: text("match_rule").notNull().default("advertiser_and_headline"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ad_observation_run_idx").on(t.runId),
    index("ad_observation_snapshot_idx").on(t.snapshotId),
    index("ad_observation_key_idx").on(t.adKey),
  ],
);

/**
 * The standing status of one ad across every snapshot of a run.
 *
 * THE RULE THIS TABLE EXISTS TO ENFORCE: an ad absent from a capture is not an
 * observation about Meta, it is an observation about the capture. So
 * `likely_no_longer_active` is unreachable below three CONSECUTIVE COMPARABLE
 * absences, and a non-comparable snapshot does not move `consecutiveAbsences` at
 * all — a user who re-captured with a different country filter has produced no
 * evidence about that ad, and the counter must not pretend otherwise.
 */
export const adStatus = pgTable(
  "ad_status",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    adKey: text("ad_key").notNull(),
    advertiser: text("advertiser").notNull().default(""),
    headline: text("headline").notNull().default(""),
    firstObservedAt: timestamp("first_observed_at"),
    lastObservedAt: timestamp("last_observed_at"),
    /** Comparable snapshots in a row that missed this ad. Never 3+ by accident. */
    consecutiveAbsences: text("consecutive_absences").notNull().default("0"),
    /** observed · not_observed_recently · likely_no_longer_active */
    state: text("state").notNull().default("observed"),
    /** JSON text: the snapshot ids, dates and hashes backing the state above. */
    basis: text("basis").notNull().default("{}"),
    /** Rank in the newest snapshot, and in the previous COMPARABLE one. */
    latestRank: text("latest_rank"),
    previousRank: text("previous_rank"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("ad_status_run_idx").on(t.runId),
    index("ad_status_key_idx").on(t.adKey),
  ],
);

/**
 * The period briefing: what changed between two snapshots, in writing.
 *
 * Written from the computed diff, never from a hunch. It leads with coverage when
 * the capture thinned, because a thinner capture looks EXACTLY like a quiet
 * market and only that comparison separates them. A quiet period is allowed to
 * say so — a briefing that cries wolf gets ignored, and then the one that
 * mattered is missed too.
 */
export const periodBriefing = pgTable(
  "period_briefing",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    fromSnapshotId: text("from_snapshot_id").references(() => snapshot.id, {
      onDelete: "cascade",
    }),
    toSnapshotId: text("to_snapshot_id")
      .notNull()
      .references(() => snapshot.id, { onDelete: "cascade" }),
    comparable: boolean("comparable").notNull().default(true),
    comparabilityNote: text("comparability_note"),
    coverageNote: text("coverage_note").notNull().default(""),
    headline: text("headline").notNull().default(""),
    /** quiet · normal · active · not_comparable */
    verdict: text("verdict").notNull().default("quiet"),
    /** JSON text: [{what, who, interpretation, kind, signalIds, snapshotIds}] */
    developments: text("developments").notNull().default("[]"),
    /** JSON text: [{signal, label, note, evidence}] */
    signals: text("signals").notNull().default("[]"),
    /** JSON text: [{action, evidenceItemId, rationale}] — at most two. */
    actions: text("actions").notNull().default("[]"),
    /** JSON text: [string] — what to capture next time to close a gap. */
    captureSuggestions: text("capture_suggestions").notNull().default("[]"),
    limitations: text("limitations").notNull().default(""),
    /** Digest suppressed on a quiet period, and this records that it was. */
    digestSent: boolean("digest_sent").notNull().default(false),
    digestSkippedReason: text("digest_skipped_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("period_briefing_run_idx").on(t.runId)],
);

/**
 * A standing watch on a run: how often to look again, and when next.
 *
 * The reminder is the whole product here. It carries the saved searches and the
 * exact filters, because a reminder that asks the user to reconstruct their own
 * search will not be acted on. Nothing about this schedules a fetch of anything
 * belonging to Meta — it schedules a nudge.
 */
export const watchTarget = pgTable(
  "watch_target",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" })
      .unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    /** Days between looks. 7 · 14 · 30. */
    cadenceDays: text("cadence_days").notNull().default("14"),
    lastSnapshotId: text("last_snapshot_id"),
    lastLookedAt: timestamp("last_looked_at"),
    nextReminderAt: timestamp("next_reminder_at"),
    /** Email the briefing when a period is not quiet. */
    emailDigest: boolean("email_digest").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("watch_target_user_idx").on(t.userId)],
);


/* ─────────────────────────────────────────────────────────────────────────────
 * THE CLOSED LOOP (`07`)
 *
 * Everything above this line is inference over evidence: the public Ad Library
 * publishes no performance figure for a commercial ad, so nothing about a
 * competitor is ever measured. Below this line is the ONE place in the whole app
 * where a real performance number legitimately exists — and it exists because it
 * is about the USER'S OWN ad, on their own account, reported by them.
 *
 * The wall between the two halves is structural, not a convention:
 *   · own-brand rows live in their own tables and never join the evidence batch,
 *     so they cannot enter a percentile base and cannot skew a competitor's score
 *   · a measured figure is `provenance: "self_reported_own_account"`, a kind that
 *     no competitor fact can ever carry
 *   · no ring, bar or ranking spans both halves — an opportunity score and a cost
 *     per result are different quantities, and one axis over both would imply a
 *     comparison the data cannot support
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * An ad the user actually shipped — one row per creative that left the building.
 *
 * `variantId` is the whole point: it ties a real result back to the generated
 * variant, and through that variant's `sourceItemId` back to the competitor angle
 * it inherited. Without that chain the loop is not closed and the pattern library
 * would be aggregating anonymous numbers.
 *
 * NOTHING here is fetched. AdMirror does not hold an ad-account token, does not
 * publish, and does not pull insights: the user launches in their own ads manager
 * and reports back what happened. That is a smaller claim than the brief's phase
 * 16-17 and it is the honest one for this build.
 */
export const shippedAd = pgTable(
  "shipped_ad",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    /** The generated cell this became. Null only for an ad shipped outside AdMirror. */
    variantId: text("variant_id").references(() => creativeVariant.id, {
      onDelete: "set null",
    }),
    /** Carried forward at ship time so the chain survives a deleted variant. */
    sourceItemId: text("source_item_id").references(() => evidenceItem.id, {
      onDelete: "set null",
    }),
    /** What the user called it in their ads manager, so they can find it again. */
    label: text("label").notNull().default(""),
    /** The hook mechanism and format inherited — denormalised for the pattern library. */
    hookMechanism: text("hook_mechanism").notNull().default(""),
    formatLabel: text("format_label").notNull().default(""),
    assetKind: text("asset_kind").notNull().default("video"),
    /** awareness · traffic · leads · sales — the objective it ran under. */
    objective: text("objective").notNull().default("sales"),
    /** Their own market label, copied so patterns can group without a join. */
    marketLabel: text("market_label").notNull().default(""),
    categoryLabel: text("category_label").notNull().default(""),
    launchedOn: timestamp("launched_on"),
    /** draft · live · finished — the user's own word for where it is. */
    state: text("state").notNull().default("live"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("shipped_ad_user_idx").on(t.userId),
    index("shipped_ad_run_idx").on(t.runId),
  ],
);

/**
 * One reading of a shipped ad's real numbers, as the user reported them.
 *
 * Stored as raw counts, never as pre-computed rates: a rate with no denominator
 * cannot be checked, cannot be re-derived when a later reading arrives, and
 * cannot refuse itself for thin volume. `impressions` is what gates the whole
 * diagnosis, so it is required and the reason the "not enough volume" refusal
 * can exist at all.
 *
 * Every field is `self_reported_own_account`. There is no sibling provenance
 * column here because there is only ever one possible answer — the user read it
 * off their own dashboard.
 */
export const shippedResult = pgTable(
  "shipped_result",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shippedAdId: text("shipped_ad_id")
      .notNull()
      .references(() => shippedAd.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The day the user read these numbers off their own dashboard. */
    readOn: timestamp("read_on").notNull().defaultNow(),
    /** How long it had been running when read — the other half of "is this enough". */
    daysLive: text("days_live").notNull().default("0"),
    /** Raw counts, as reported. Empty string = not reported, never 0. */
    impressions: text("impressions").notNull().default(""),
    reach: text("reach").notNull().default(""),
    clicks: text("clicks").notNull().default(""),
    /** The user's own currency amount, as typed. Stored as text, never floated. */
    amountSpent: text("amount_spent").notNull().default(""),
    currency: text("currency").notNull().default(""),
    results: text("results").notNull().default(""),
    resultLabel: text("result_label").notNull().default(""),
    /** Video funnel counts — the only way to tell a hook failure from a body failure. */
    videoPlays: text("video_plays").notNull().default(""),
    watched25: text("watched_25").notNull().default(""),
    watched75: text("watched_75").notNull().default(""),
    watched100: text("watched_100").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shipped_result_ad_idx").on(t.shippedAdId),
    index("shipped_result_user_idx").on(t.userId),
  ],
);

/**
 * The user's own account baseline — what "normal" looks like for THEM.
 *
 * This exists because an absolute rate means nothing. A 22% hold rate is strong
 * in one account and weak in another, so every verdict in the app is a comparison
 * against this row and nothing else. The user types it once from their own
 * account averages; where they haven't, the app compares against the median of
 * their own other shipped ads, and says which of the two it used.
 */
export const accountBaseline = pgTable(
  "account_baseline",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    /** Percentages as typed, e.g. "1.4" for 1.4%. Empty = not provided. */
    clickThroughPct: text("click_through_pct").notNull().default(""),
    thumbstopPct: text("thumbstop_pct").notNull().default(""),
    holdPct: text("hold_pct").notNull().default(""),
    costPerResult: text("cost_per_result").notNull().default(""),
    currency: text("currency").notNull().default(""),
    /** What window these averages came from, in the user's words. */
    basisNote: text("basis_note").notNull().default(""),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

/**
 * The user's own ad, put on the board as a "You" row (phase 0, SELF_BASELINE).
 *
 * Deliberately a SEPARATE table from `evidenceItem`. Putting an own-brand flag on
 * the evidence table would mean every percentile base, every coverage count and
 * every ranking query needed a `where isOwnBrand = false` that someone would
 * eventually forget. A different table cannot be forgotten.
 */
export const ownAd = pgTable(
  "own_ad",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    headline: text("headline").notNull().default(""),
    bodyCopy: text("body_copy").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default(""),
    /** Their own words, which is better evidence of their voice than a homepage. */
    voiceNote: text("voice_note").notNull().default(""),
    assetKind: text("asset_kind").notNull().default("video"),
    /** The measured numbers for this one, same shape as a reported reading. */
    impressions: text("impressions").notNull().default(""),
    clicks: text("clicks").notNull().default(""),
    amountSpent: text("amount_spent").notNull().default(""),
    currency: text("currency").notNull().default(""),
    results: text("results").notNull().default(""),
    resultLabel: text("result_label").notNull().default(""),
    videoPlays: text("video_plays").notNull().default(""),
    watched25: text("watched_25").notNull().default(""),
    watched75: text("watched_75").notNull().default(""),
    daysLive: text("days_live").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("own_ad_run_idx").on(t.runId)],
);

/**
 * The cross-run pattern library (phase 18b).
 *
 * One row per hook mechanism × format × category × market, holding COUNTS, not
 * conclusions. `n` travels with every cell and the UI greys out anything under
 * five, because a seductive number built on three data points is worse than an
 * empty cell — it would be believed.
 *
 * Rows are recomputed from `shippedResult` rather than incremented, so a
 * corrected reading fixes the pattern instead of leaving a ghost behind.
 */
export const hookPattern = pgTable(
  "hook_pattern",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mechanism: text("mechanism").notNull(),
    formatLabel: text("format_label").notNull().default(""),
    categoryLabel: text("category_label").notNull().default(""),
    marketLabel: text("market_label").notNull().default(""),
    /** How many shipped ads carried this mechanism, and how many had a reading. */
    shippedCount: text("shipped_count").notNull().default("0"),
    measuredCount: text("measured_count").notNull().default("0"),
    /** Median index vs the user's own baseline, ×100. Empty when n is too thin. */
    thumbstopIndex: text("thumbstop_index").notNull().default(""),
    holdIndex: text("hold_index").notNull().default(""),
    clickIndex: text("click_index").notNull().default(""),
    costIndex: text("cost_index").notNull().default(""),
    /** outperformed · inline · underperformed · too_thin */
    standing: text("standing").notNull().default("too_thin"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("hook_pattern_user_idx").on(t.userId),
    uniqueIndex("hook_pattern_cell_idx").on(
      t.userId,
      t.mechanism,
      t.formatLabel,
      t.categoryLabel,
      t.marketLabel,
    ),
  ],
);

/**
 * A proposed re-fit of the opportunity score's weights (phase 18a).
 *
 * PROPOSE, NEVER AUTO-APPLY. The whole point of this table is that a proposal
 * SITS here until a human accepts it. Auto-tuning a ranking model on a few dozen
 * noisy samples is how you build a system that confidently ranks garbage — and
 * because the score decides which angles a user generates from, a bad re-fit
 * would quietly corrupt every run afterwards with nothing on screen to show it.
 *
 * `state` is the gate: `proposed` is inert, `accepted` becomes the live weights,
 * `declined` is kept as history so the same weak proposal isn't re-offered as if
 * it were new. Only one row per user is ever `accepted`.
 *
 * The evidence for a proposal is stored WITH it — sample size, the fit quality,
 * the old weights and the new. A weight vector with no visible provenance is
 * exactly the kind of unexplained number this product refuses everywhere else.
 */
export const weightProposal = pgTable(
  "weight_proposal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** proposed · accepted · declined */
    state: text("state").notNull().default("proposed"),
    /** JSON text: the weight vector in force before this proposal. */
    fromWeights: text("from_weights").notNull().default("{}"),
    /** JSON text: the proposed vector. Always renormalised to sum to 1. */
    toWeights: text("to_weights").notNull().default("{}"),
    /** How many measured ads the fit saw, and over how many days. */
    sampleSize: text("sample_size").notNull().default("0"),
    /** weak · moderate · strong — never a bare correlation number on its own. */
    fitQuality: text("fit_quality").notNull().default("weak"),
    /** JSON text: per-component correlation, direction and n. The arithmetic. */
    evidence: text("evidence").notNull().default("{}"),
    /** Plain-words summary of what the fit found and what it does NOT prove. */
    summary: text("summary").notNull().default(""),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("weight_proposal_user_idx").on(t.userId)],
);
