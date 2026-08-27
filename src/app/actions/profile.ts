"use server";

/**
 * THE PROFILE GATE — the stage that now comes before any ad lookup.
 *
 * Every action here is offline: it reads the company's own site, writes the
 * profile and the proposed rival list, and lets the user correct both. The ad
 * reader is not contacted anywhere in this file. `approveProfile` is the only
 * door to collection, and it flips one boolean the collector checks.
 *
 * Every action calls requireUser() and filters by that id. There is no
 * row-level security underneath doing it for us.
 */

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { competitor, run, runStep, searchReference } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { buildSearchUrl, describeFilters, type SearchSpec } from "@/lib/admirror/ad-library";
import type { SiteRead } from "@/lib/admirror/discover";
import type { CategoryId } from "@/lib/admirror/category";
import {
  categoryFromChoice,
  composeProfile,
  readStored,
  readingFrom,
  type StoredCategory,
} from "@/lib/admirror/profile-build";
import { tidyName, type CompanyProfile, type ProfileRival } from "@/lib/admirror/profile";
import {
  profileNamedRival,
  scanCategoryRivals,
  type RivalScanReport,
} from "@/lib/admirror/rival-scan";
import { advanceProgress, beginProgress, setProgressPhase } from "@/lib/admirror/progress";

export type ProfileResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ProfileResult {
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
  if (state === "done") patch.finishedAt = new Date();
  await db
    .update(runStep)
    .set(patch)
    .where(and(eq(runStep.runId, runId), eq(runStep.name, name)));
}

/**
 * Build (or rebuild) the company profile from the site, and propose rivals.
 * Offline and idempotent — safe to run on every open of the profile screen.
 */
export async function buildCompanyProfile(input: {
  runId: string;
  /** Force a fresh read of the site even if we already have one. */
  reread?: boolean;
}): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);

    await setStep(input.runId, "BRAND_RESEARCH", "running", "Reading your company");
    const built = await composeProfile(current, { reread: input.reread });

    await setStep(input.runId, "BRAND_RESEARCH", "done", built.profile.basis);
    if (!current.profileApproved) {
      await setStep(
        input.runId,
        "COMPETITOR_MAP",
        "blocked_on_user",
        "Check your profile and your rival list, then look up who's advertising",
      );
    }

    revalidatePath(`/runs/${input.runId}`);
    revalidatePath(`/runs/${input.runId}/profile`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Correct the profile by hand. Every field here is the user's to overrule. */
export async function saveProfileEdits(input: {
  runId: string;
  brandName?: string;
  summary?: string;
  sells?: string[];
  searchTerms?: string[];
}): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);
    const stored = readStored(current.dossier);
    const profile = (stored.profile as CompanyProfile | undefined) ?? null;
    if (!profile) return { ok: false, error: "Build the profile first." };

    const sells = (input.sells ?? profile.sells).map((term) => term.trim()).filter(Boolean);
    const searchTerms = (input.searchTerms ?? profile.searchTerms)
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);

    const brandName = (input.brandName ?? current.brandName).trim() || current.brandName;

    await db
      .update(run)
      .set({
        brandName,
        dossier: JSON.stringify({
          ...stored,
          profile: {
            ...profile,
            summary: (input.summary ?? profile.summary).trim() || profile.summary,
            sells,
            searchTerms,
            basis: "Corrected by you.",
          },
          categoryTerms: searchTerms,
        }),
        updatedAt: new Date(),
      })
      .where(eq(run.id, input.runId));

    revalidatePath(`/runs/${input.runId}/profile`);
    revalidatePath(`/runs/${input.runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * APPROVE — the only door to collection.
 *
 * On approval every kept rival gets its own advertiser lookup, so the collector
 * reads the companies on this list rather than whatever a category keyword
 * happens to return. A rival with no lookup behind it is invisible to the
 * collector, which is why the searches are written here and not later.
 */
export async function approveProfile(runId: string): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);

    const kept = await db
      .select()
      .from(competitor)
      .where(and(eq(competitor.runId, runId), eq(competitor.pruned, false)));

    if (kept.length === 0) {
      return {
        ok: false,
        error: "Keep at least one competitor before collecting — that's who we read ads for.",
      };
    }

    const country = current.marketCountries.split(",").filter(Boolean)[0] ?? "US";
    const language = current.marketLanguages.split(",").filter(Boolean)[0] ?? "any";

    const searches = await db
      .select()
      .from(searchReference)
      .where(eq(searchReference.runId, runId))
      .orderBy(asc(searchReference.createdAt));
    const known = new Set(searches.map((row) => row.competitorName.trim().toLowerCase()));

    const rows: (typeof searchReference.$inferInsert)[] = [];
    for (const rival of kept) {
      const name = tidyName(rival.name);
      if (known.has(name.toLowerCase())) continue;
      known.add(name.toLowerCase());
      const spec: SearchSpec = {
        competitorName: name,
        country,
        language,
        mediaType: current.mediaType,
        activeStatus: "active",
      };
      rows.push({
        runId,
        competitorName: name,
        country,
        language,
        mediaType: current.mediaType,
        activeStatus: "active",
        filterSummary: describeFilters(spec),
        url: buildSearchUrl(spec),
        origin: "plan",
        parsed: true,
      });
    }

    if (rows.length > 0) await db.insert(searchReference).values(rows);

    await db
      .update(run)
      .set({
        profileApproved: true,
        status: "AWAITING_EVIDENCE",
        stepCursor: "4",
        updatedAt: new Date(),
      })
      .where(eq(run.id, runId));

    await setStep(runId, "COMPETITOR_MAP", "done", `${kept.length} companies approved by you`);
    await setStep(runId, "DISCOVERY_PLAN", "done", `${kept.length} advertiser lookups ready`);
    await setStep(runId, "EVIDENCE_INTAKE", "pending", "Reading their live ads");

    revalidatePath(`/runs/${runId}`);
    revalidatePath(`/runs/${runId}/profile`);
    revalidatePath(`/runs/${runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * OVERRULE THE FIELD. The classifier is a reading, so the user gets the final
 * word on it — and because the rival lookup searches the field's vocabulary,
 * changing the field changes who gets looked up next.
 */
export async function setCategory(input: {
  runId: string;
  categoryId: CategoryId;
}): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);
    const stored = readStored(current.dossier);
    const next = categoryFromChoice(input.categoryId);
    if (!next) return { ok: false, error: "That field isn't one we know." };

    await db
      .update(run)
      .set({
        dossier: JSON.stringify({ ...stored, category: next }),
        updatedAt: new Date(),
      })
      .where(eq(run.id, input.runId));

    revalidatePath(`/runs/${input.runId}/profile`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * LOOK UP RIVALS IN THIS FIELD — the one place in the profile stage that reads
 * the ad library, and it only ever runs because the user pressed the button.
 *
 * It does two different jobs, and both are needed: it sweeps the field's own
 * vocabulary plus its neighbours' to find companies nobody named, AND it profiles
 * every company already on the list from that company's own ads. A name with no
 * profile behind it is indistinguishable from a name we invented.
 */
export async function scanRivals(input: {
  runId: string;
  /** Only refresh the profiles of companies already listed. */
  profileOnly?: boolean;
}): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);
    const stored = readStored(current.dossier);
    const site = (stored.siteRead as SiteRead | undefined) ?? null;
    const profile = (stored.profile as CompanyProfile | undefined) ?? null;
    const storedCategory = stored.category as StoredCategory | undefined;

    if (!profile || !storedCategory) {
      return { ok: false, error: "Build your company profile first — the lookup follows your field." };
    }

    const country = current.marketCountries.split(",").filter(Boolean)[0] ?? "US";
    const language = current.marketLanguages.split(",").filter(Boolean)[0] ?? "any";
    const reading = readingFrom(storedCategory);

    const existing = await db
      .select()
      .from(competitor)
      .where(eq(competitor.runId, input.runId));
    const live = existing.filter((row) => !row.pruned);

    // A placeholder slot — "Category leader", "Nearest challenger" — is a prompt,
    // not a company, so it must never be looked up as one.
    const isPlaceholder = (name: string) =>
      /^(category leader|nearest challenger|attention competitor)$/i.test(name.trim());

    const namedRows = live.filter((row) => !isPlaceholder(row.name));
    const searchCount = input.profileOnly ? namedRows.length : namedRows.length + 8;

    await setStep(input.runId, "COMPETITOR_MAP", "running", "Looking up who advertises in your field");
    await beginProgress(input.runId, "discovering", Math.max(searchCount, 1), "Reading your field");

    // ── 1. PROFILE THE COMPANIES ALREADY ON THE LIST ────────────────────────
    for (const row of namedRows) {
      const result = await profileNamedRival({
        name: row.name,
        pageId: null,
        country,
        language,
        ownCategoryId: storedCategory.id,
      });
      await db
        .update(competitor)
        .set({
          field: result.profile.field,
          categoryLabel: result.profile.categoryLabel,
          categoryRelation:
            row.tier === "ATTENTION" ? "neighbour_category" : result.profile.categoryRelation,
          positioning: result.profile.positioning,
          adsSeen: String(result.profile.adsSeen),
          displayLink: result.profile.displayLink,
          reachBand: result.profile.reachBand,
          whyUseful: result.ok ? row.whyUseful || result.note : result.note,
          profiledAt: new Date(),
        })
        .where(and(eq(competitor.id, row.id), eq(competitor.runId, input.runId)));

      await advanceProgress(
        input.runId,
        {
          label: row.name,
          ads: result.profile.adsSeen,
          state: result.ok ? "ok" : "empty",
          newAds: 0,
          withArt: 0,
        },
        "Reading your field",
      );
    }

    if (input.profileOnly) {
      await setProgressPhase(input.runId, "done", "");
      await setStep(
        input.runId,
        "COMPETITOR_MAP",
        "blocked_on_user",
        `${namedRows.length} competitor profile${namedRows.length === 1 ? "" : "s"} refreshed — your call`,
      );
      revalidatePath(`/runs/${input.runId}/profile`);
      revalidatePath(`/runs/${input.runId}`);
      return { ok: true };
    }

    // ── 2. SWEEP THE FIELD AND ITS NEIGHBOURS ───────────────────────────────
    const report: RivalScanReport = await scanCategoryRivals({
      brandName: current.brandName,
      site,
      reading,
      country,
      language,
      mediaType: current.mediaType,
      ownTerms: profile.searchTerms,
      exclude: existing.map((row) => row.name),
      onTermSettled: async (term, adsRead) => {
        await advanceProgress(
          input.runId,
          { label: term, ads: adsRead, state: adsRead > 0 ? "ok" : "empty", newAds: 0, withArt: 0 },
          term,
        );
      },
    });

    if (report.found.length > 0) {
      await db.insert(competitor).values(
        report.found.map((rival) => ({
          runId: input.runId,
          name: rival.name,
          tier: rival.tier,
          whyUseful: rival.whyUseful,
          confidence: String(rival.confidence),
          pruned: false,
          field: rival.field,
          categoryLabel: rival.categoryLabel,
          categoryRelation: rival.categoryRelation,
          positioning: rival.positioning,
          foundVia: rival.foundVia,
          foundUnder: rival.foundUnder,
          adsSeen: String(rival.adsSeen),
          displayLink: rival.displayLink,
          reachBand: rival.reachBand,
          profiledAt: new Date(),
        })),
      );
    }

    // The placeholder slots exist only to say "we don't know who this is yet".
    // Once real advertisers are on the list they are noise, so they go.
    const placeholders = live.filter((row) => isPlaceholder(row.name));
    if (report.found.length > 0 && placeholders.length > 0) {
      for (const row of placeholders) {
        await db
          .update(competitor)
          .set({ pruned: true, whyUseful: "Replaced by companies actually running ads in your field." })
          .where(and(eq(competitor.id, row.id), eq(competitor.runId, input.runId)));
      }
    }

    await db
      .update(run)
      .set({
        dossier: JSON.stringify({
          ...stored,
          category: storedCategory,
          rivalScan: {
            note: report.note,
            unreadable: report.unreadable,
            terms: report.terms,
            setAside: report.setAside,
            scannedAt: new Date().toISOString(),
          },
          setAside: report.setAside,
          discoveryNote: report.note,
        }),
        updatedAt: new Date(),
      })
      .where(eq(run.id, input.runId));

    await setProgressPhase(input.runId, "done", "");
    await setStep(
      input.runId,
      "COMPETITOR_MAP",
      "blocked_on_user",
      report.unreadable ? report.note : `${report.note} Approve the list to start collecting.`,
    );

    revalidatePath(`/runs/${input.runId}/profile`);
    revalidatePath(`/runs/${input.runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Reopen the profile — stops the run collecting again until re-approved. */
export async function reopenProfile(runId: string): Promise<ProfileResult> {
  try {
    const user = await requireUser();
    await ownedRun(runId, user.id);

    await db
      .update(run)
      .set({ profileApproved: false, status: "BRAND_RESEARCH", updatedAt: new Date() })
      .where(eq(run.id, runId));
    await setStep(
      runId,
      "COMPETITOR_MAP",
      "blocked_on_user",
      "Profile reopened — approve it again to collect",
    );

    revalidatePath(`/runs/${runId}`);
    revalidatePath(`/runs/${runId}/profile`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type { CompanyProfile, ProfileRival };
