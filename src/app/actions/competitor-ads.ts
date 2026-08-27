"use server";

/**
 * COLLECT ONE ADVERTISER'S ADS, ON DEMAND.
 *
 * WHY THIS IS SEPARATE FROM THE SWEEP. The sweep asks keyword questions — "who is
 * running ads about perfume in the UAE" — and a keyword search is a loose net: a
 * named rival can be genuinely running ads and still not come back, because their
 * copy never uses the word we searched. The user's actual request is simpler than
 * the question we were asking, so this asks it directly: show me THIS company's
 * live ads. It is the advertiser lookup, not the keyword one.
 *
 * Every rule from the sweep holds unchanged: requireUser() and a userId filter on
 * everything, reach only where Meta publishes it, and an unreadable result is
 * reported as unreadable rather than as an empty market.
 */

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { competitor, evidenceBatch, evidenceItem, run, searchReference } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { buildSearchUrl, describeFilters } from "@/lib/admirror/ad-library";
import { readCompanyAds, type LiveAd } from "@/lib/admirror/library-feed";

export type CollectResult =
  | { ok: true; collected: number; read: number; note: string }
  | { ok: false; error: string };

export async function collectCompetitorAds(input: {
  runId: string;
  competitorId: string;
}): Promise<CollectResult> {
  try {
    const user = await requireUser();

    const [current] = await db
      .select()
      .from(run)
      .where(and(eq(run.id, input.runId), eq(run.userId, user.id)))
      .limit(1);
    if (!current) return { ok: false, error: "That run doesn't exist, or it isn't yours." };
    if (!current.profileApproved) {
      return {
        ok: false,
        error: "Approve your company profile first — that's what decides who we collect.",
      };
    }

    const [target] = await db
      .select()
      .from(competitor)
      .where(and(eq(competitor.id, input.competitorId), eq(competitor.runId, input.runId)))
      .limit(1);
    if (!target) return { ok: false, error: "That competitor isn't on this run." };

    const country = current.marketCountries.split(",").filter(Boolean)[0] ?? "US";
    const language = current.marketLanguages.split(",").filter(Boolean)[0] ?? "any";

    const outcome = await readCompanyAds(
      { companyName: target.name, country, language },
      { limit: 20 },
    );

    if (outcome.state !== "ok" && outcome.state !== "empty") {
      return { ok: false, error: outcome.note };
    }

    // File into the open collection, or open one. A lookup that finds ads and
    // has nowhere to put them is the same as a lookup that failed.
    const [open] = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, input.runId), eq(evidenceBatch.state, "open")))
      .limit(1);

    const batch =
      open ??
      (
        await db
          .insert(evidenceBatch)
          .values({
            runId: input.runId,
            label: `${target.name} — direct lookup`,
            state: "open",
          })
          .returning()
      )[0];

    // The search row this advertiser's ads hang off, so the collect screen can
    // show where they came from and a human can open the same search.
    const searches = await db
      .select()
      .from(searchReference)
      .where(eq(searchReference.runId, input.runId))
      .orderBy(asc(searchReference.createdAt));

    let reference =
      searches.find(
        (row) => row.competitorName.trim().toLowerCase() === target.name.trim().toLowerCase(),
      ) ?? null;

    if (!reference) {
      const spec = {
        competitorName: target.name,
        country,
        language,
        mediaType: current.mediaType,
        activeStatus: "active",
      };
      reference = (
        await db
          .insert(searchReference)
          .values({
            runId: input.runId,
            competitorName: target.name,
            country,
            language,
            mediaType: current.mediaType,
            activeStatus: "active",
            filterSummary: describeFilters(spec),
            url: buildSearchUrl(spec),
            origin: "plan",
          })
          .returning()
      )[0];
    }

    const already = await db
      .select()
      .from(evidenceItem)
      .where(eq(evidenceItem.runId, input.runId));
    const known = new Set(
      already.map((row) => (row.libraryUrl ?? "").trim().toLowerCase()).filter(Boolean),
    );

    const observedAt = new Date();
    const rows = outcome.ads
      .filter((ad) => {
        const key = ad.libraryUrl.trim().toLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      })
      .map((ad) =>
        toEvidence(ad, {
          runId: input.runId,
          batchId: batch.id,
          searchReferenceId: reference!.id,
          market: country,
          language,
          observedAt,
        }),
      );

    for (let start = 0; start < rows.length; start += 25) {
      await db.insert(evidenceItem).values(rows.slice(start, start + 25));
    }

    await db
      .update(searchReference)
      .set({
        lastSweptAt: observedAt,
        lastSweepCount: String(outcome.ads.length),
        lastSweepNote:
          outcome.ads.length > 0 && rows.length === 0
            ? `${outcome.ads.length} live ads read — all already on your board.`
            : outcome.note,
        lastSweepState: outcome.state === "ok" ? "ok" : "empty",
      })
      .where(
        and(eq(searchReference.id, reference.id), eq(searchReference.runId, input.runId)),
      );

    revalidatePath(`/runs/${input.runId}`);
    revalidatePath(`/runs/${input.runId}/collect`);
    revalidatePath(`/runs/${input.runId}/board`);

    return {
      ok: true,
      collected: rows.length,
      read: outcome.ads.length,
      note:
        outcome.ads.length === 0
          ? `${target.name} isn't running any live ads in ${country} right now.`
          : rows.length === 0
            ? `All ${outcome.ads.length} of ${target.name}'s live ads were already on your board.`
            : `${rows.length} new ad${rows.length === 1 ? "" : "s"} collected from ${target.name}. Rank them to see them scored.`,
    };
  } catch (error) {
    return { ok: false, error: describeDataError(error, "saving").message };
  }
}

/** One live ad onto an evidence row. Same provenance rules as the sweep. */
function toEvidence(
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
  const lib = "swept_from_public_library";
  return {
    batchId: context.batchId,
    runId: context.runId,
    searchReferenceId: context.searchReferenceId,
    intakeKind: "url",
    modality: ad.creativeUrl ? "full" : ad.bodyCopy || ad.headline ? "text_only" : "partial",
    advertiser: ad.advertiser,
    advertiserProvenance: ad.advertiser ? lib : "unknown",
    libraryUrl: ad.libraryUrl,
    libraryUrlProvenance: lib,
    headline: ad.headline,
    headlineProvenance: ad.headline ? lib : "unknown",
    bodyCopy: ad.bodyCopy,
    bodyCopyProvenance: ad.bodyCopy ? lib : "unknown",
    ctaLabel: ad.ctaLabel,
    ctaProvenance: ad.ctaLabel ? lib : "unknown",
    platforms: ad.platforms.join(","),
    platformsProvenance: ad.platforms.length > 0 ? lib : "unknown",
    activeStatus: ad.activeStatus,
    activeStatusProvenance: ad.activeStatus === "unknown" ? "unknown" : lib,
    visibleStartDate: ad.visibleStartDate,
    visibleStartDateProvenance: ad.visibleStartDate ? lib : "unknown",
    visibleResultRank: String(ad.resultRank),
    visibleResultRankProvenance: lib,
    creativeUrl: ad.creativeUrl,
    advertiserAvatarUrl: ad.advertiserAvatarUrl,
    isVideo: ad.isVideo,
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
