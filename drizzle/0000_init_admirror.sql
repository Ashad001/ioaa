CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_baseline" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"click_through_pct" text DEFAULT '' NOT NULL,
	"thumbstop_pct" text DEFAULT '' NOT NULL,
	"hold_pct" text DEFAULT '' NOT NULL,
	"cost_per_result" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"basis_note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_baseline_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ad_observation" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"ad_key" text NOT NULL,
	"evidence_item_id" text,
	"observed" boolean DEFAULT true NOT NULL,
	"advertiser" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"concept_key" text DEFAULT '' NOT NULL,
	"concept_label" text DEFAULT '' NOT NULL,
	"variant_count" text DEFAULT '1' NOT NULL,
	"copy_hash" text DEFAULT '' NOT NULL,
	"asset_hash" text DEFAULT '' NOT NULL,
	"match_rule" text DEFAULT 'advertiser_and_headline' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_score" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_item_id" text NOT NULL,
	"run_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"ebos" text NOT NULL,
	"coverage_score" text NOT NULL,
	"coverage_band" text NOT NULL,
	"inputs" text DEFAULT '{}' NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_status" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ad_key" text NOT NULL,
	"advertiser" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"first_observed_at" timestamp,
	"last_observed_at" timestamp,
	"consecutive_absences" text DEFAULT '0' NOT NULL,
	"state" text DEFAULT 'observed' NOT NULL,
	"basis" text DEFAULT '{}' NOT NULL,
	"latest_rank" text,
	"previous_rank" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'DIRECT' NOT NULL,
	"why_useful" text DEFAULT '' NOT NULL,
	"confidence" text DEFAULT '50' NOT NULL,
	"pruned" boolean DEFAULT false NOT NULL,
	"field" text DEFAULT '' NOT NULL,
	"category_label" text DEFAULT '' NOT NULL,
	"category_relation" text DEFAULT 'unknown' NOT NULL,
	"positioning" text DEFAULT '' NOT NULL,
	"found_via" text DEFAULT 'named_by_you' NOT NULL,
	"found_under" text DEFAULT '' NOT NULL,
	"ads_seen" text DEFAULT '0' NOT NULL,
	"display_link" text DEFAULT '' NOT NULL,
	"reach_band" text DEFAULT '' NOT NULL,
	"profiled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "creative_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_item_id" text,
	"variant_index" text DEFAULT '1' NOT NULL,
	"hook_label" text DEFAULT '' NOT NULL,
	"hook_line" text DEFAULT '' NOT NULL,
	"script" text DEFAULT '{}' NOT NULL,
	"first_frame_prompt" text DEFAULT '' NOT NULL,
	"motion_prompt" text DEFAULT '' NOT NULL,
	"primary_text" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"asset_kind" text DEFAULT 'video' NOT NULL,
	"format_axis" text DEFAULT 'primary' NOT NULL,
	"shared_body_key" text DEFAULT '' NOT NULL,
	"alt_copy" text DEFAULT '[]' NOT NULL,
	"output_resolution" text DEFAULT '1080x1920' NOT NULL,
	"output_duration_seconds" text DEFAULT '9' NOT NULL,
	"gates" text DEFAULT '{}' NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"test_role" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"label" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"coverage_score" text,
	"coverage_band" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_item" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"run_id" text NOT NULL,
	"search_reference_id" text,
	"intake_kind" text DEFAULT 'manual' NOT NULL,
	"modality" text DEFAULT 'partial' NOT NULL,
	"advertiser" text DEFAULT '' NOT NULL,
	"advertiser_provenance" text DEFAULT 'unknown' NOT NULL,
	"library_url" text,
	"library_url_provenance" text DEFAULT 'unknown' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"headline_provenance" text DEFAULT 'unknown' NOT NULL,
	"body_copy" text DEFAULT '' NOT NULL,
	"body_copy_provenance" text DEFAULT 'unknown' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"cta_provenance" text DEFAULT 'unknown' NOT NULL,
	"platforms" text DEFAULT '' NOT NULL,
	"platforms_provenance" text DEFAULT 'unknown' NOT NULL,
	"active_status" text DEFAULT 'unknown' NOT NULL,
	"active_status_provenance" text DEFAULT 'unknown' NOT NULL,
	"visible_start_date" text,
	"visible_start_date_provenance" text DEFAULT 'unknown' NOT NULL,
	"visible_result_rank" text,
	"visible_result_rank_provenance" text DEFAULT 'unknown' NOT NULL,
	"market" text DEFAULT '' NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"artefact_url" text,
	"artefact_type" text,
	"artefact_sha256" text,
	"artefact_scan" text,
	"creative_url" text,
	"advertiser_avatar_url" text,
	"is_video" boolean DEFAULT false NOT NULL,
	"video_url" text,
	"video_duration" text,
	"impressions_lower" text,
	"impressions_upper" text,
	"impressions_provenance" text DEFAULT 'unknown' NOT NULL,
	"ad_variant_count" text DEFAULT '1' NOT NULL,
	"teardown" text,
	"concept_key" text DEFAULT '' NOT NULL,
	"concept_label" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gate_decision" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"selected_item_ids" text DEFAULT '' NOT NULL,
	"coverage_at_gate" text DEFAULT '' NOT NULL,
	"coverage_band_at_gate" text DEFAULT '' NOT NULL,
	"forced" boolean DEFAULT false NOT NULL,
	"matrix" text DEFAULT '{}' NOT NULL,
	"overrides" text DEFAULT '{}' NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hook_pattern" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mechanism" text NOT NULL,
	"format_label" text DEFAULT '' NOT NULL,
	"category_label" text DEFAULT '' NOT NULL,
	"market_label" text DEFAULT '' NOT NULL,
	"shipped_count" text DEFAULT '0' NOT NULL,
	"measured_count" text DEFAULT '0' NOT NULL,
	"thumbstop_index" text DEFAULT '' NOT NULL,
	"hold_index" text DEFAULT '' NOT NULL,
	"click_index" text DEFAULT '' NOT NULL,
	"cost_index" text DEFAULT '' NOT NULL,
	"standing" text DEFAULT 'too_thin' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "own_ad" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"body_copy" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"voice_note" text DEFAULT '' NOT NULL,
	"asset_kind" text DEFAULT 'video' NOT NULL,
	"impressions" text DEFAULT '' NOT NULL,
	"clicks" text DEFAULT '' NOT NULL,
	"amount_spent" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"results" text DEFAULT '' NOT NULL,
	"result_label" text DEFAULT '' NOT NULL,
	"video_plays" text DEFAULT '' NOT NULL,
	"watched_25" text DEFAULT '' NOT NULL,
	"watched_75" text DEFAULT '' NOT NULL,
	"days_live" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_briefing" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"from_snapshot_id" text,
	"to_snapshot_id" text NOT NULL,
	"comparable" boolean DEFAULT true NOT NULL,
	"comparability_note" text,
	"coverage_note" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"verdict" text DEFAULT 'quiet' NOT NULL,
	"developments" text DEFAULT '[]' NOT NULL,
	"signals" text DEFAULT '[]' NOT NULL,
	"actions" text DEFAULT '[]' NOT NULL,
	"capture_suggestions" text DEFAULT '[]' NOT NULL,
	"limitations" text DEFAULT '' NOT NULL,
	"digest_sent" boolean DEFAULT false NOT NULL,
	"digest_skipped_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"brand_website" text,
	"market_label" text NOT NULL,
	"market_countries" text DEFAULT '' NOT NULL,
	"market_languages" text DEFAULT '' NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"media_type" text DEFAULT 'all' NOT NULL,
	"lookback_days" text DEFAULT '90' NOT NULL,
	"status" text DEFAULT 'INTAKE' NOT NULL,
	"step_cursor" text DEFAULT '1' NOT NULL,
	"dossier" text,
	"profile_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_step" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step_number" text NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"elapsed_ms" text DEFAULT '0' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "search_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"competitor_name" text NOT NULL,
	"country" text NOT NULL,
	"language" text DEFAULT 'any' NOT NULL,
	"media_type" text DEFAULT 'all' NOT NULL,
	"active_status" text DEFAULT 'active' NOT NULL,
	"filter_summary" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"origin" text DEFAULT 'plan' NOT NULL,
	"raw_input" text,
	"parsed" boolean DEFAULT true NOT NULL,
	"last_swept_at" timestamp,
	"last_sweep_count" text,
	"last_sweep_note" text,
	"last_sweep_state" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipped_ad" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"variant_id" text,
	"source_item_id" text,
	"label" text DEFAULT '' NOT NULL,
	"hook_mechanism" text DEFAULT '' NOT NULL,
	"format_label" text DEFAULT '' NOT NULL,
	"asset_kind" text DEFAULT 'video' NOT NULL,
	"objective" text DEFAULT 'sales' NOT NULL,
	"market_label" text DEFAULT '' NOT NULL,
	"category_label" text DEFAULT '' NOT NULL,
	"launched_on" timestamp,
	"state" text DEFAULT 'live' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipped_result" (
	"id" text PRIMARY KEY NOT NULL,
	"shipped_ad_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_on" timestamp DEFAULT now() NOT NULL,
	"days_live" text DEFAULT '0' NOT NULL,
	"impressions" text DEFAULT '' NOT NULL,
	"reach" text DEFAULT '' NOT NULL,
	"clicks" text DEFAULT '' NOT NULL,
	"amount_spent" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"results" text DEFAULT '' NOT NULL,
	"result_label" text DEFAULT '' NOT NULL,
	"video_plays" text DEFAULT '' NOT NULL,
	"watched_25" text DEFAULT '' NOT NULL,
	"watched_75" text DEFAULT '' NOT NULL,
	"watched_100" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"item_count" text DEFAULT '0' NOT NULL,
	"coverage_score" text,
	"coverage_band" text,
	"comparable_hash" text DEFAULT '' NOT NULL,
	"declared_filters" text DEFAULT '{}' NOT NULL,
	"ordinal" text DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sweep_progress" (
	"run_id" text PRIMARY KEY NOT NULL,
	"phase" text DEFAULT 'idle' NOT NULL,
	"searches_done" text DEFAULT '0' NOT NULL,
	"searches_total" text DEFAULT '0' NOT NULL,
	"ads_found" text DEFAULT '0' NOT NULL,
	"ads_new" text DEFAULT '0' NOT NULL,
	"ads_with_art" text DEFAULT '0' NOT NULL,
	"current_label" text DEFAULT '' NOT NULL,
	"per_search" text DEFAULT '[]' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_target" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cadence_days" text DEFAULT '14' NOT NULL,
	"last_snapshot_id" text,
	"last_looked_at" timestamp,
	"next_reminder_at" timestamp,
	"email_digest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watch_target_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "weight_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"from_weights" text DEFAULT '{}' NOT NULL,
	"to_weights" text DEFAULT '{}' NOT NULL,
	"sample_size" text DEFAULT '0' NOT NULL,
	"fit_quality" text DEFAULT 'weak' NOT NULL,
	"evidence" text DEFAULT '{}' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_baseline" ADD CONSTRAINT "account_baseline_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_observation" ADD CONSTRAINT "ad_observation_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_observation" ADD CONSTRAINT "ad_observation_snapshot_id_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_observation" ADD CONSTRAINT "ad_observation_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_score" ADD CONSTRAINT "ad_score_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_score" ADD CONSTRAINT "ad_score_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_score" ADD CONSTRAINT "ad_score_batch_id_evidence_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."evidence_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_status" ADD CONSTRAINT "ad_status_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor" ADD CONSTRAINT "competitor_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_variant" ADD CONSTRAINT "creative_variant_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_variant" ADD CONSTRAINT "creative_variant_source_item_id_evidence_item_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_batch" ADD CONSTRAINT "evidence_batch_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_batch_id_evidence_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."evidence_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_search_reference_id_search_reference_id_fk" FOREIGN KEY ("search_reference_id") REFERENCES "public"."search_reference"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_decision" ADD CONSTRAINT "gate_decision_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hook_pattern" ADD CONSTRAINT "hook_pattern_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "own_ad" ADD CONSTRAINT "own_ad_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "own_ad" ADD CONSTRAINT "own_ad_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_briefing" ADD CONSTRAINT "period_briefing_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_briefing" ADD CONSTRAINT "period_briefing_from_snapshot_id_snapshot_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_briefing" ADD CONSTRAINT "period_briefing_to_snapshot_id_snapshot_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_reference" ADD CONSTRAINT "search_reference_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_ad" ADD CONSTRAINT "shipped_ad_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_ad" ADD CONSTRAINT "shipped_ad_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_ad" ADD CONSTRAINT "shipped_ad_variant_id_creative_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."creative_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_ad" ADD CONSTRAINT "shipped_ad_source_item_id_evidence_item_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_result" ADD CONSTRAINT "shipped_result_shipped_ad_id_shipped_ad_id_fk" FOREIGN KEY ("shipped_ad_id") REFERENCES "public"."shipped_ad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipped_result" ADD CONSTRAINT "shipped_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_batch_id_evidence_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."evidence_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweep_progress" ADD CONSTRAINT "sweep_progress_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_target" ADD CONSTRAINT "watch_target_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_target" ADD CONSTRAINT "watch_target_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_proposal" ADD CONSTRAINT "weight_proposal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ad_observation_run_idx" ON "ad_observation" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ad_observation_snapshot_idx" ON "ad_observation" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "ad_observation_key_idx" ON "ad_observation" USING btree ("ad_key");--> statement-breakpoint
CREATE INDEX "ad_score_run_idx" ON "ad_score" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_score_item_idx" ON "ad_score" USING btree ("evidence_item_id");--> statement-breakpoint
CREATE INDEX "ad_status_run_idx" ON "ad_status" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ad_status_key_idx" ON "ad_status" USING btree ("ad_key");--> statement-breakpoint
CREATE INDEX "competitor_run_idx" ON "competitor" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "creative_variant_run_idx" ON "creative_variant" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "evidence_batch_run_idx" ON "evidence_batch" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "evidence_item_run_idx" ON "evidence_item" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "evidence_item_batch_idx" ON "evidence_item" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "gate_decision_run_idx" ON "gate_decision" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "hook_pattern_user_idx" ON "hook_pattern" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hook_pattern_cell_idx" ON "hook_pattern" USING btree ("user_id","mechanism","format_label","category_label","market_label");--> statement-breakpoint
CREATE INDEX "own_ad_run_idx" ON "own_ad" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "period_briefing_run_idx" ON "period_briefing" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_user_idx" ON "run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "run_step_run_idx" ON "run_step" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "search_reference_run_idx" ON "search_reference" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shipped_ad_user_idx" ON "shipped_ad" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shipped_ad_run_idx" ON "shipped_ad" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "shipped_result_ad_idx" ON "shipped_result" USING btree ("shipped_ad_id");--> statement-breakpoint
CREATE INDEX "shipped_result_user_idx" ON "shipped_result" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "snapshot_run_idx" ON "snapshot" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "watch_target_user_idx" ON "watch_target" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "weight_proposal_user_idx" ON "weight_proposal" USING btree ("user_id");