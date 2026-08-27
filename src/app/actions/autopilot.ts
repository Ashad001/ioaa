"use server";

/**
 * Autopilot — the unattended path from one website to a ranked board.
 *
 * This is the automation the manual flow used to ask the user to do by hand:
 * read the site, find who is really advertising, sweep their ads out of the
 * PUBLIC Ad Library, file them as evidence, then normalise, rank and tear them
 * down. It stops exactly once, at the human gate, which stays a human gate.
 *
 * WHAT HAS NOT CHANGED, AND MUST NOT:
 * - No performance figure is produced anywhere. Meta publishes none for
 *   commercial ads, so neither do we.
 * - Every fact still carries provenance. Swept facts are `swept_from_public_library`
 *   — a weaker claim than a human seeing the ad, and the badge says so.
 * - A gap is REPORTED, never filled. A blocked or empty search comes back as a
 *   note and the manual capture tool stays fully available for it.
 *
 * Every action here calls requireUser() and filters by that id. There is no
 * row-level security underneath doing it for us.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  adScore,
  competitor,
  evidenceBatch,
  evidenceItem,
  run,
  runStep,
  searchReference,
} from "@/db/schema";
import { getActiveWeights } from "@/lib/admirror/queries";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { buildSearchUrl, describeFilters, type SearchSpec } from "@/lib/admirror/ad-library";
import { chooseMarket, discoverAdvertisers, readSite } from "@/lib/admirror/discover";
import { conceptKeyFor, deriveDossier, deriveTeardown, STEPS } from "@/lib/admirror/pipeline";
import {
  batchReferences,
  computeCoverage,
  computeEbos,
  type ScoreItem,
} from "@/lib/admirror/scoring";
import { readMany, type FeedOutcome, type LiveAd } from "@/lib/admirror/library-feed";
import { recordSnapshot } from "@/lib/admirror/watch-record";
import {
  advanceProgress,
  beginProgress,
  setProgressPhase,
} from "@/lib/admirror/progress";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  return { ok: false, error: describeDataError(error, "saving").message };
}

async function ownedRun(runId: string, userId: string) {
  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, userId)))
    .limit(1);
  if (!row) throw new Error("That run doesn't exist, or it isn't yours.");
  return row;
}

async function setStep(runId: string, name: string, state: string, detail?: string) {
  const patch: Record<string, unknown> = { state };
  if (detail !== undefined) patch.detail = detail;
  if (state === "running") patch.startedAt = new Date();
  if (state === "done" || state === "failed") patch.finishedAt = new Date();
  await db
    .update(runStep)
    .set(patch)
    .where(and(eq(runStep.runId, runId), eq(runStep.name, name)));
}

/**
 * Caps, tuned against real timings. One rendered Library search takes ~40s, so
 * these numbers are what keep a full collection inside a couple of minutes
 * rather than a crawl the user abandons: 6 searches over 3 lanes is two rounds.
 */
const MAX_SEARCHES = 10;
const ADS_PER_SEARCH = 16;
const SWEEP_LANES = 4;

/**
 * Step 1 — start a run from nothing but a website.
 *
 * The site read and the market choice both happen here, so the user's only input
 * is the address of their own homepage.
 */
export async function startAutoRun(input: {
  website: string;
  /** Optional nudges. Empty means "work it out from the site". */
  brandNameOverride?: string;
  objectives?: string[];
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const website = input.website.trim();
    if (!website) {
      return { ok: false, error: "Add your website address and I'll take it from there." };
    }

    const site = await readSite(website);
    const market = chooseMarket({
      countryHints: site.countryHints,
      languageHint: site.languageHint,
    });

    const brandName =
      (input.brandNameOverride ?? "").trim() || site.brandName || "Your brand";
    const objectives =
      input.objectives && input.objectives.length > 0 ? input.objectives : ["Direct response"];

    const [created] = await db
      .insert(run)
      .values({
        userId: user.id,
        brandName,
        brandWebsite: site.url ?? website,
        marketLabel: market.label,
        marketCountries: market.countries.join(","),
        marketLanguages: market.languages.join(",") || "any",
        objectives: objectives.join(","),
        mediaType: "all",
        lookbackDays: "90",
        status: "INTAKE",
        stepCursor: "1",
        dossier: JSON.stringify({
          siteRead: {
            title: site.title,
            description: site.description,
            headings: site.headings.slice(0, 6),
            categoryTerms: site.categoryTerms,
            note: site.note,
            reachable: site.ok,
          },
          marketNote: market.note,
        }),
      })
      .returning();

    await db.insert(runStep).values(
      STEPS.map((step) => ({
        runId: created.id,
        stepNumber: String(step.n),
        name: step.name,
        state: step.n === 1 ? "done" : "pending",
        detail: step.detail,
        startedAt: step.n === 1 ? new Date() : null,
        finishedAt: step.n === 1 ? new Date() : null,
      })),
    );

    revalidatePath("/library");
    return { ok: true, id: created.id };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Steps 2–4, unattended: brand read, competitor DISCOVERY (a real lookup, not a
 * guess), and the search plan the sweep will run.
 */
export async function autoResearch(runId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);

    // THE PROFILE GATE. Nothing reaches the ad reader until the user has read
    // the company profile and confirmed who to study. Without this check the
    // old behaviour returns: category words become searches nobody agreed to.
    if (!current.profileApproved) {
      await setStep(
        runId,
        "COMPETITOR_MAP",
        "blocked_on_user",
        "Check your profile and rivals, then start collecting",
      );
      return {
        ok: false,
        error: "Approve your company profile first — that's what decides who we collect.",
      };
    }

    // ── Step 2: brand read, from the site's own words where we have them.
    await setStep(runId, "BRAND_RESEARCH", "running");

    let siteTerms: string[] = [];
    let siteNote = "";
    // The site's own words are the yardstick the market test measures every
    // candidate against, so they travel with the terms rather than being thrown
    // away after the terms are derived.
    let siteTitle = "";
    let siteDescription = "";
    let siteHeadings: string[] = [];
    try {
      const stored = current.dossier ? JSON.parse(current.dossier) : null;
      siteTerms = stored?.siteRead?.categoryTerms ?? [];
      siteNote = stored?.siteRead?.note ?? "";
      siteTitle = stored?.siteRead?.title ?? "";
      siteDescription = stored?.siteRead?.description ?? "";
      siteHeadings = stored?.siteRead?.headings ?? [];
    } catch {
      siteTerms = [];
    }

    // If the run was created before the site was read, read it now.
    if (siteTerms.length === 0 && current.brandWebsite) {
      const site = await readSite(current.brandWebsite);
      siteTerms = site.categoryTerms;
      siteNote = site.note;
      siteTitle = site.title;
      siteDescription = site.description;
      siteHeadings = site.headings.slice(0, 12);
    }

    const objectives = current.objectives.split(",").filter(Boolean);
    const dossier = deriveDossier({
      brandName: current.brandName,
      brandWebsite: current.brandWebsite,
      marketLabel: current.marketLabel,
      objectives,
    });

    let existingDossier: Record<string, unknown> = {};
    try {
      existingDossier = current.dossier ? JSON.parse(current.dossier) : {};
    } catch {
      existingDossier = {};
    }

    await db
      .update(run)
      .set({
        dossier: JSON.stringify({ ...existingDossier, ...dossier, categoryTerms: siteTerms }),
        status: "BRAND_RESEARCH",
        stepCursor: "2",
        updatedAt: new Date(),
      })
      .where(eq(run.id, runId));
    await setStep(runId, "BRAND_RESEARCH", "done", siteNote || "Read from your site and brief");

    // ── Step 3: competitor DISCOVERY — sweep the category, see who shows up.
    await setStep(runId, "COMPETITOR_MAP", "running", "Searching the Ad Library for your category");
    await beginProgress(runId, "discovering", siteTerms.length, siteTerms[0] ?? "");

    const countries = current.marketCountries.split(",").filter(Boolean);
    const languages = current.marketLanguages.split(",").filter(Boolean);
    const primaryCountry = countries[0] ?? "US";
    const primaryLanguage = languages[0] ?? "any";

    const discovery = await discoverAdvertisers({
      brandName: current.brandName,
      categoryTerms: siteTerms,
      country: primaryCountry,
      language: primaryLanguage,
      mediaType: current.mediaType,
      siteTitle,
      siteDescription,
      siteHeadings,
      onTermSettled: async (term, adsRead, index) => {
        await advanceProgress(
          runId,
          {
            label: term,
            ads: adsRead,
            state: adsRead > 0 ? "ok" : "empty",
            newAds: adsRead,
            withArt: 0,
          },
          siteTerms[index + 1] ?? "",
        );
      },
    });

    // Replace any previous auto map, keep anything the user added by hand.
    const previous = await db.select().from(competitor).where(eq(competitor.runId, runId));
    const userAdded = previous.filter((row) => row.whyUseful.startsWith("Added by you"));
    const toDrop = previous.filter((row) => !row.whyUseful.startsWith("Added by you"));
    if (toDrop.length > 0) {
      await db.delete(competitor).where(
        inArray(
          competitor.id,
          toDrop.map((row) => row.id),
        ),
      );
    }

    const keptNames = new Set(userAdded.map((row) => row.name.toLowerCase()));
    const rows = discovery.advertisers
      .filter((advertiser) => !keptNames.has(advertiser.name.toLowerCase()))
      .map((advertiser) => ({
        runId,
        name: advertiser.name,
        tier: advertiser.tier,
        whyUseful: advertiser.whyUseful,
        confidence: String(advertiser.confidence),
        pruned: false,
      }));

    if (rows.length > 0) await db.insert(competitor).values(rows);

    // Keep the rejections WITH their reasons. A filter the user cannot inspect is
    // indistinguishable from a bug, and "why isn't X here?" is the first question
    // anyone asks of a competitor map.
    try {
      const stored = current.dossier ? JSON.parse(current.dossier) : {};
      await db
        .update(run)
        .set({
          dossier: JSON.stringify({
            ...stored,
            ...dossier,
            categoryTerms: siteTerms,
            setAside: discovery.rejected.map((verdict) => ({
              name: verdict.name,
              reason: verdict.reason,
            })),
            discoveryNote: discovery.note,
          }),
          updatedAt: new Date(),
        })
        .where(eq(run.id, runId));
    } catch {
      // A dossier we cannot parse is not worth failing a run over.
    }

    // AN UNREADABLE DISCOVERY IS NOT AN EMPTY MARKET. When nothing could be
    // read at all, the run says so in those words and stops for the user rather
    // than presenting "0 advertisers" as a finding about their market.
    if (discovery.unreadable) {
      await setProgressPhase(runId, "done", "the ad reader couldn't be reached");
      await setStep(runId, "COMPETITOR_MAP", "blocked_on_user", discovery.note);
      await db
        .update(run)
        .set({ status: "COMPETITOR_MAP", stepCursor: "3", updatedAt: new Date() })
        .where(eq(run.id, runId));
      revalidatePath(`/runs/${runId}`);
      return { ok: false, error: discovery.note };
    }

    await setProgressPhase(runId, "done", `${rows.length} advertisers found`);
    await setStep(
      runId,
      "COMPETITOR_MAP",
      "done",
      discovery.blockedTerms.length > 0
        ? `${rows.length} advertisers found · ${discovery.blockedTerms.length} search${discovery.blockedTerms.length === 1 ? "" : "es"} couldn't be read`
        : `${rows.length} advertisers found running live ads in ${primaryCountry}`,
    );

    // ── Step 4: the search plan the sweep will run, one per competitor.
    await setStep(runId, "DISCOVERY_PLAN", "running");

    const kept = await db
      .select()
      .from(competitor)
      .where(and(eq(competitor.runId, runId), eq(competitor.pruned, false)));

    const planned = await db
      .select()
      .from(searchReference)
      .where(and(eq(searchReference.runId, runId), eq(searchReference.origin, "plan")));
    if (planned.length > 0) {
      await db.delete(searchReference).where(
        inArray(
          searchReference.id,
          planned.map((row) => row.id),
        ),
      );
    }

    const searchRows: (typeof searchReference.$inferInsert)[] = [];
    for (const comp of kept) {
      const spec: SearchSpec = {
        competitorName: comp.name,
        country: primaryCountry,
        language: primaryLanguage,
        mediaType: current.mediaType,
        activeStatus: "active",
      };
      searchRows.push({
        runId,
        competitorName: comp.name,
        country: primaryCountry,
        language: primaryLanguage,
        mediaType: current.mediaType,
        activeStatus: "active",
        filterSummary: describeFilters(spec),
        url: buildSearchUrl(spec),
        origin: "plan",
        parsed: true,
      });
    }

    if (searchRows.length > 0) await db.insert(searchReference).values(searchRows);

    const [openBatch] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
      .limit(1);

    if (!openBatch) {
      await db.insert(evidenceBatch).values({
        runId,
        label: `${current.marketLabel} — ${new Date().toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })}`,
        state: "open",
      });
    }

    await db
      .update(run)
      .set({ status: "AWAITING_EVIDENCE", stepCursor: "4", updatedAt: new Date() })
      .where(eq(run.id, runId));
    await setStep(runId, "DISCOVERY_PLAN", "done", `${searchRows.length} searches ready to sweep`);
    await setStep(runId, "EVIDENCE_INTAKE", "pending", "Collecting ads from the public Library");

    revalidatePath(`/runs/${runId}`);
    revalidatePath(`/runs/${runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Steps 5–8, unattended: sweep every planned search, file what comes back as
 * evidence, dedupe, score and tear down. Ends at the human gate.
 */
export async function autoCollect(runId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);

    // Same gate as discovery. A collection is a set of reads against named
    // companies, and the user names them on the profile screen.
    if (!current.profileApproved) {
      return {
        ok: false,
        error: "Approve your company profile first — that's what decides who we collect.",
      };
    }

    await setStep(runId, "EVIDENCE_INTAKE", "running", "Reading the public Ad Library");

    // EVERY saved search, including ones the user pasted themselves. Sweeping
    // only the auto-built plan was a real bug: the paste box promises "the next
    // sweep will read this search too", and a promise the collector doesn't keep
    // is worse than no paste box at all.
    const searches = await db
      .select()
      .from(searchReference)
      .where(eq(searchReference.runId, runId))
      .orderBy(asc(searchReference.createdAt));

    if (searches.length === 0) {
      await setStep(runId, "EVIDENCE_INTAKE", "blocked_on_user", "No searches to sweep");
      return { ok: false, error: "There are no searches to collect from yet." };
    }

    const [batch] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
      .limit(1);

    const targetBatch =
      batch ??
      (
        await db
          .insert(evidenceBatch)
          .values({ runId, label: `${current.marketLabel} sweep`, state: "open" })
          .returning()
      )[0];

    // Only MAX_SEARCHES fit in one press, so choose fairly: never-swept first,
    // then stalest. Without this, searches 7+ would never be read on a run with
    // a long competitor list — permanently invisible rather than merely late.
    const ordered = [...searches].sort((a, b) => {
      const aTime = a.lastSweptAt ? a.lastSweptAt.getTime() : 0;
      const bTime = b.lastSweptAt ? b.lastSweptAt.getTime() : 0;
      return aTime - bTime;
    });

    const slice = ordered.slice(0, MAX_SEARCHES);
    const specs: SearchSpec[] = slice.map((row) => ({
      competitorName: row.competitorName,
      country: row.country,
      language: row.language,
      mediaType: row.mediaType,
      activeStatus: row.activeStatus,
    }));

    // The ticker starts before the first request, so the console can show the
    // real denominator ("reading 6 searches") the instant the press begins.
    await beginProgress(
      runId,
      "reading",
      slice.length,
      slice[0]?.competitorName ?? "",
    );

    const outcomes = await readMany(specs, {
      concurrency: SWEEP_LANES,
      limit: ADS_PER_SEARCH,
      // Every count on screen is counted from a page that actually came back.
      onSettled: async (index, outcome) => {
        const search = slice[index];
        await advanceProgress(
          runId,
          {
            label: search.competitorName,
            ads: outcome.ads.length,
            state: lampFor(outcome),
            // "New" is settled properly below, against the whole board; here it
            // is only what this page contributed, which is what a live count is.
            newAds: outcome.ads.length,
            withArt: outcome.ads.filter((ad) => ad.creativeUrl).length,
          },
          slice[index + 1]?.competitorName ?? "",
        );
      },
    });

    await setProgressPhase(runId, "filing");

    // Which Library IDs are already on the board? Never file one twice.
    const already = await db
      .select()
      .from(evidenceItem)
      .where(eq(evidenceItem.runId, runId));
    const knownUrls = new Set(
      already.map((row) => (row.libraryUrl ?? "").trim().toLowerCase()).filter(Boolean),
    );

    const observedAt = new Date();
    const inserts: (typeof evidenceItem.$inferInsert)[] = [];
    const gaps: string[] = [];
    const sweepRecords: Array<{
      id: string;
      lastSweptAt: Date;
      lastSweepCount: string;
      lastSweepNote: string;
      lastSweepState: string;
    }> = [];
    let collected = 0;
    let readOk = 0;
    let adsSeen = 0;

    outcomes.forEach((outcome, index) => {
      const search = slice[index];
      let newFromThis = 0;

      for (const ad of outcome.ads) {
        const key = ad.libraryUrl.trim().toLowerCase();
        if (knownUrls.has(key)) continue;
        knownUrls.add(key);
        newFromThis += 1;
        collected += 1;
        inserts.push(
          sweptToEvidence(ad, {
            runId,
            batchId: targetBatch.id,
            searchReferenceId: search.id,
            market: search.country,
            language: search.language,
            observedAt,
          }),
        );
      }

      if (outcome.state === "ok" || outcome.state === "empty") {
        readOk += 1;
        adsSeen += outcome.ads.length;
      }
      if (outcome.ads.length === 0) {
        gaps.push(`${search.competitorName} — ${outcome.note}`);
      }

      // Record what THIS search did, so the UI can say why a competitor is empty
      // instead of leaving the user to guess.
      sweepRecords.push({
        id: search.id,
        lastSweptAt: observedAt,
        lastSweepCount: String(outcome.ads.length),
        lastSweepNote:
          outcome.ads.length > 0 && newFromThis === 0
            ? `${outcome.ads.length} ads read — all already on your board.`
            : outcome.note,
        lastSweepState: lampFor(outcome),
      });
    });

    if (inserts.length > 0) {
      // Chunked so one very broad sweep can't build a single enormous statement.
      for (let start = 0; start < inserts.length; start += 25) {
        await db.insert(evidenceItem).values(inserts.slice(start, start + 25));
      }
    }

    for (const record of sweepRecords) {
      await db
        .update(searchReference)
        .set({
          lastSweptAt: record.lastSweptAt,
          lastSweepCount: record.lastSweepCount,
          lastSweepNote: record.lastSweepNote,
          lastSweepState: record.lastSweepState,
        })
        .where(
          and(eq(searchReference.id, record.id), eq(searchReference.runId, runId)),
        );
    }

    const boardTotal = already.length + collected;

    // NOTHING READ AT ALL is a genuine failure. Reading ads but finding nothing
    // NEW is a success — it means the market hasn't moved since the last sweep,
    // and reporting that as a failure (the old behaviour) told users their
    // working app was broken every time they re-swept an unchanged market.
    if (readOk === 0) {
      // WHY nothing was read decides what we can honestly say. A missing
      // connection is our problem and must be named as such; anything else is
      // reported as unread, never as an empty market.
      const noKey = outcomes.some((outcome) => outcome.state === "no_key");
      await setStep(
        runId,
        "EVIDENCE_INTAKE",
        "blocked_on_user",
        noKey
          ? "The ad reader isn't connected yet, so no ads could be read"
          : "Nothing could be read this time — adding by hand is open to you",
      );
      await db
        .update(run)
        .set({ status: "AWAITING_EVIDENCE", updatedAt: new Date() })
        .where(eq(run.id, runId));
      await setProgressPhase(runId, "done", "nothing could be read");
      revalidatePath(`/runs/${runId}`);
      revalidatePath(`/runs/${runId}/collect`);
      return {
        ok: false,
        error: noKey
          ? "The ad reader isn't connected yet, so no ads could be read. This is a missing connection, not an empty market."
          : "No ads could be read this time. The searches are saved — open any of them and add what you see.",
      };
    }

    if (collected === 0) {
      await setStep(
        runId,
        "EVIDENCE_INTAKE",
        "done",
        `${adsSeen} ads read · nothing new since the last sweep`,
      );

      // A re-sweep opens a fresh collection before it knows whether the market
      // has moved. If it hasn't, that collection is empty — and since the board
      // shows the LATEST one, leaving it would blank a board that has ads in it.
      // Drop the empty collection and let the previous ranked one stand.
      const inTarget = await db
        .select()
        .from(evidenceItem)
        .where(and(eq(evidenceItem.runId, runId), eq(evidenceItem.batchId, targetBatch.id)));

      if (inTarget.length === 0) {
        await db
          .delete(evidenceBatch)
          .where(and(eq(evidenceBatch.id, targetBatch.id), eq(evidenceBatch.runId, runId)));
        if (boardTotal > 0) {
          await db
            .update(run)
            .set({ status: "AWAITING_GATE", updatedAt: new Date() })
            .where(eq(run.id, runId));
          await setStep(runId, "HUMAN_GATE", "blocked_on_user", "Pick the angles you want");
        }
      } else {
        // Same ads still in an open collection — rank it so the board isn't stale.
        await analyse(runId, targetBatch.id, user.id);
      }

      await setProgressPhase(runId, "done", "no new ads since last sweep");
      revalidatePath(`/runs/${runId}`);
      revalidatePath(`/runs/${runId}/collect`);
      revalidatePath(`/runs/${runId}/board`);
      return { ok: true };
    }

    await setStep(
      runId,
      "EVIDENCE_INTAKE",
      "done",
      gaps.length > 0
        ? `${collected} ads collected · ${gaps.length} search${gaps.length === 1 ? "" : "es"} came back empty`
        : `${collected} ads collected from ${slice.length} searches`,
    );

    await setProgressPhase(runId, "scoring", `${collected} ads collected`);
    await analyse(runId, targetBatch.id, user.id);
    await setProgressPhase(runId, "done", `${collected} ads collected`);

    revalidatePath(`/runs/${runId}`);
    revalidatePath(`/runs/${runId}/collect`);
    revalidatePath(`/runs/${runId}/board`);
    return { ok: true };
  } catch (error) {
    await setProgressPhase(runId, "done", "the sweep stopped early");
    return fail(error);
  }
}

/** The lamp for one read: ok · empty · blocked · failed. Never guessed. */
function lampFor(outcome: FeedOutcome): string {
  if (outcome.state === "ok") return "ok";
  if (outcome.state === "empty") return "empty";
  if (outcome.state === "no_key" || outcome.state === "rate_limited") return "blocked";
  return "failed";
}

/** Map one live ad onto an evidence row, provenance included. */
function sweptToEvidence(
  ad: LiveAd,
  context: {
    runId: string;
    batchId: string;
    searchReferenceId: string;
    market: string;
    language: string;
    observedAt: Date;
  },
): typeof evidenceItem.$inferInsert {
  const swept = "swept_from_public_library";
  return {
    batchId: context.batchId,
    runId: context.runId,
    searchReferenceId: context.searchReferenceId,
    intakeKind: "url",
    modality: ad.creativeUrl
      ? "full"
      : ad.bodyCopy && ad.headline
        ? "text_only"
        : "partial",

    advertiser: ad.advertiser,
    advertiserProvenance: ad.advertiser ? swept : "unknown",
    libraryUrl: ad.libraryUrl,
    libraryUrlProvenance: swept,
    headline: ad.headline,
    headlineProvenance: ad.headline ? swept : "unknown",
    bodyCopy: ad.bodyCopy,
    bodyCopyProvenance: ad.bodyCopy ? swept : "unknown",
    ctaLabel: ad.ctaLabel,
    ctaProvenance: ad.ctaLabel ? swept : "unknown",
    platforms: ad.platforms.join(","),
    platformsProvenance: ad.platforms.length > 0 ? swept : "unknown",
    activeStatus: ad.activeStatus,
    activeStatusProvenance: ad.activeStatus === "unknown" ? "unknown" : swept,
    visibleStartDate: ad.visibleStartDate,
    visibleStartDateProvenance: ad.visibleStartDate ? swept : "unknown",
    visibleResultRank: String(ad.resultRank),
    visibleResultRankProvenance: swept,
    // The picture the public card displays — kept as the address the Library
    // itself points at, so the reader's browser loads it exactly as it would on
    // the real page. A reference, never a copy.
    creativeUrl: ad.creativeUrl,
    advertiserAvatarUrl: ad.advertiserAvatarUrl,
    isVideo: ad.isVideo,
    // Reach, only where Meta publishes one. Absent stays absent.
    impressionsLower: ad.impressionsLower === null ? null : String(ad.impressionsLower),
    impressionsUpper: ad.impressionsUpper === null ? null : String(ad.impressionsUpper),
    impressionsProvenance: ad.impressionsLower === null ? "unknown" : "published_by_meta",
    adVariantCount: String(ad.variantCount),
    market: context.market,
    language: context.language,
    observedAt: context.observedAt,
    notes: [
      ad.variantCount > 1 ? `Running ${ad.variantCount} creative versions.` : "",
      ad.euTransparency ? "Carries an EU transparency notice." : "",
      ad.displayLink ? `Display link: ${ad.displayLink}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Steps 6–8 over an open batch: dedupe, tear down, score, then stop at the gate.
 *
 * Same arithmetic as the manual close — the scores are computed by the same
 * module, so a swept board and a hand-captured board are scored identically.
 */
async function analyse(runId: string, batchId: string, userId: string) {
  await setStep(runId, "EVIDENCE_NORMALIZE", "running");

  const items = await db
    .select()
    .from(evidenceItem)
    .where(and(eq(evidenceItem.runId, runId), eq(evidenceItem.batchId, batchId)))
    .orderBy(asc(evidenceItem.createdAt));

  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const item of items) {
    const key = item.libraryUrl
      ? `url:${item.libraryUrl.trim().toLowerCase()}`
      : `copy:${item.advertiser.trim().toLowerCase()}|${item.headline.trim().toLowerCase()}|${item.bodyCopy.trim().toLowerCase()}`;
    if (key.endsWith("||")) continue;
    if (seen.get(key)) duplicates.push(item.id);
    else seen.set(key, item.id);
  }
  if (duplicates.length > 0) {
    await db.delete(evidenceItem).where(inArray(evidenceItem.id, duplicates));
  }

  const kept = items.filter((item) => !duplicates.includes(item.id));

  for (const item of kept) {
    const teardown = deriveTeardown({
      id: item.id,
      headline: item.headline,
      bodyCopy: item.bodyCopy,
      ctaLabel: item.ctaLabel,
      modality: item.modality,
    });
    const concept = conceptKeyFor(teardown);
    await db
      .update(evidenceItem)
      .set({
        teardown: JSON.stringify(teardown),
        conceptKey: concept.key,
        conceptLabel: concept.label,
      })
      .where(eq(evidenceItem.id, item.id));
  }

  await setStep(
    runId,
    "EVIDENCE_NORMALIZE",
    "done",
    duplicates.length > 0
      ? `${kept.length} unique ads · ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} merged`
      : `${kept.length} unique ads`,
  );
  await setStep(runId, "EVIDENCE_RANK", "running");

  const variantCounts = new Map<string, number>();
  for (const item of kept) {
    const key = item.conceptKey || item.id;
    variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
  }

  const scoreItems: ScoreItem[] = kept.map((item) => ({
    id: item.id,
    visibleStartDate: item.visibleStartDate,
    visibleResultRank: item.visibleResultRank ? Number(item.visibleResultRank) : null,
    platformCount: item.platforms ? item.platforms.split(",").filter(Boolean).length : null,
    // Meta's own version count for this one ad, floored at how many copies of
    // the concept we collected — whichever is the stronger evidence of effort.
    variantCount: Math.max(
      Number(item.adVariantCount) || 1,
      variantCounts.get(item.conceptKey || item.id) ?? 1,
    ),
    publishedReach: item.impressionsLower ? Number(item.impressionsLower) || null : null,
    observedAt: item.observedAt,
    hasCreativeArtefact: Boolean(item.artefactUrl),
    hasLibraryUrl: Boolean(item.libraryUrl),
    advertiser: item.advertiser,
  }));

  const planned = await db
    .select()
    .from(competitor)
    .where(and(eq(competitor.runId, runId), eq(competitor.pruned, false)));

  const coverage = computeCoverage(
    scoreItems,
    planned.map((row) => row.name),
  );
  const now = new Date();
  const refs = batchReferences(scoreItems, now);
  // The weighting the user has accepted, or the human-chosen default. A merely
  // proposed vector is ignored here by design — that is the whole guarantee.
  const weights = await getActiveWeights(userId);

  await db.delete(adScore).where(eq(adScore.batchId, batchId));

  for (const scoreItem of scoreItems) {
    const result = computeEbos(scoreItem, refs, now, weights);
    await db.insert(adScore).values({
      evidenceItemId: scoreItem.id,
      runId,
      batchId,
      ebos: String(result.ebos),
      coverageScore: String(coverage.score),
      coverageBand: coverage.band,
      inputs: JSON.stringify({
        components: result.components,
        weightsUsed: result.weightsUsed,
        dropped: result.dropped,
        notes: result.notes,
        batchReferences: refs,
      }),
    });
  }

  await db
    .update(evidenceBatch)
    .set({
      state: "closed",
      coverageScore: String(coverage.score),
      coverageBand: coverage.band,
      closedAt: now,
    })
    .where(eq(evidenceBatch.id, batchId));

  await setStep(
    runId,
    "EVIDENCE_RANK",
    "done",
    `Coverage ${coverage.band} (${coverage.score.toFixed(2)})`,
  );
  await setStep(runId, "TEARDOWN", "done", `${kept.length} structural teardowns`);
  await setStep(runId, "HUMAN_GATE", "blocked_on_user", "Pick the angles you want");

  await db
    .update(run)
    .set({ status: "AWAITING_GATE", stepCursor: "8", updatedAt: new Date() })
    .where(eq(run.id, runId));

  // The watchtower entry for this sweep. BOTH close paths must file one, or the
  // market's history gains a gap that looks exactly like a quiet fortnight.
  await recordSnapshot({ runId, batchId });
}

/**
 * The whole unattended stretch in one press: research, discover, sweep, rank.
 * Called straight after intake so the user's next screen is the board.
 */
export async function runAutopilot(runId: string): Promise<ActionResult> {
  const research = await autoResearch(runId);
  if (!research.ok) return research;
  return autoCollect(runId);
}

/** Re-sweep the same searches later — the revisit flow, also unattended. */
export async function resweep(runId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);

    const [open] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
      .limit(1);

    if (!open) {
      await db.insert(evidenceBatch).values({
        runId,
        label: `Re-sweep ${new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })} — ${current.marketLabel}`,
        state: "open",
      });
    }

    for (const name of ["EVIDENCE_INTAKE", "EVIDENCE_NORMALIZE", "EVIDENCE_RANK", "TEARDOWN"]) {
      await setStep(runId, name, "pending");
    }

    return autoCollect(runId);
  } catch (error) {
    return fail(error);
  }
}
