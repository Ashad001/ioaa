import "server-only";

/**
 * COMPOSING THE PROFILE — the one implementation, used from two places.
 *
 * The profile screen needs it during render (so the screen is never blank), and
 * the "read my company again" button needs it as an action. An action calls
 * `revalidatePath`, which Next refuses during render — so the work itself lives
 * here, with no revalidation, and the action wraps it. Two copies of this logic
 * would drift, and the copy that drifted would be the one deciding who gets
 * looked up.
 *
 * Everything here is OFFLINE: the company's own site, a deterministic
 * classification of it, and a proposed rival list. Nothing contacts the ad
 * reader — that happens only when the user presses the lookup button.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { competitor, run } from "@/db/schema";
import {
  classify,
  sweepTerms,
  CATEGORY_BY_ID,
  type CategoryId,
  type CategoryReading,
} from "./category";
import { readSite, type SiteRead } from "./discover";
import { buildProfile, proposeRivals, type CompanyProfile } from "./profile";

/**
 * The field read, stored on the run.
 *
 * `chosenByYou` is load-bearing: once the user has picked a field, rebuilding the
 * profile must never quietly re-read it back to our guess.
 */
export type StoredCategory = {
  id: CategoryId;
  field: string;
  label: string;
  note: string;
  matched: string[];
  neighbours: string[];
  uncertain: boolean;
  chosenByYou: boolean;
};

export type ProfileBundle = {
  profile: CompanyProfile;
  category: StoredCategory;
  site: SiteRead | null;
};

export function readStored(dossier: string | null): Record<string, unknown> {
  try {
    return dossier ? (JSON.parse(dossier) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function categoryFor(reading: ReturnType<typeof classify>): StoredCategory {
  return {
    id: reading.primary.category.id,
    field: reading.primary.category.field,
    label: reading.primary.category.label,
    note: reading.note,
    matched: reading.primary.matched,
    neighbours: reading.neighbours.map((entry) => entry.label),
    uncertain: reading.uncertain,
    chosenByYou: false,
  };
}

export function categoryFromChoice(id: CategoryId): StoredCategory | null {
  const category = CATEGORY_BY_ID.get(id);
  if (!category) return null;
  return {
    id: category.id,
    field: category.field,
    label: category.label,
    note: "You chose this field yourself, so the rival lookup follows it exactly.",
    matched: [],
    neighbours: category.neighbours
      .map((entry) => CATEGORY_BY_ID.get(entry)?.label)
      .filter((label): label is string => Boolean(label)),
    uncertain: false,
    chosenByYou: true,
  };
}

/**
 * Read the company, write the profile and the field, and propose rivals into an
 * EMPTY list only. Once the user has a list it is theirs — a rebuild must never
 * delete or re-add names they curated.
 */
export async function composeProfile(
  current: typeof run.$inferSelect,
  options: { reread?: boolean } = {},
): Promise<ProfileBundle> {
  const stored = readStored(current.dossier);

  let site = (stored.siteRead as SiteRead | undefined) ?? null;
  const needsRead = options.reread || !site || (site.categoryTerms ?? []).length === 0;
  if (needsRead && current.brandWebsite) {
    const fresh = await readSite(current.brandWebsite);
    site = { ...fresh, headings: fresh.headings.slice(0, 12) };
  }

  const objectives = current.objectives.split(",").filter(Boolean);
  const profile = buildProfile({
    brandName: current.brandName,
    site,
    marketLabel: current.marketLabel,
    objectives,
  });

  const previous = stored.category as StoredCategory | undefined;
  const reading = classify({
    title: site?.title ?? current.brandName,
    description: site?.description ?? "",
    headings: site?.headings ?? [],
    categoryTerms: site?.categoryTerms ?? [],
  });
  const category = previous?.chosenByYou ? previous : categoryFor(reading);

  // Keep whatever the user has already edited into the profile — a rebuild
  // refreshes the READING, it does not overwrite their corrections.
  const kept = stored.profile as CompanyProfile | undefined;
  const isEmptyFallback =
    kept?.basis === "Corrected by you." &&
    kept.siteUnreadable &&
    kept.searchTerms.length === 0 &&
    kept.sells.some((item) => item.startsWith("Not read from your site yet"));
  const merged: CompanyProfile =
    kept && kept.basis === "Corrected by you." && !isEmptyFallback
      ? { ...profile, ...kept }
      : profile;

  const existing = await db
    .select()
    .from(competitor)
    .where(eq(competitor.runId, current.id));

  if (existing.length === 0) {
    const proposed = proposeRivals({
      brandName: current.brandName,
      marketLabel: current.marketLabel,
      namedByUser: [],
      site,
    });
    if (proposed.length > 0) {
      await db.insert(competitor).values(
        proposed.map((rival) => ({
          runId: current.id,
          name: rival.name,
          tier: rival.tier,
          whyUseful: rival.whyUseful,
          confidence: String(rival.confidence),
          pruned: false,
          foundVia: rival.source === "read_from_your_site" ? "your_site" : "named_by_you",
          field: category.field,
          categoryLabel: rival.source === "proposed_from_category" ? category.label : "",
          categoryRelation: "unknown",
        })),
      );
    }
  }

  await db
    .update(run)
    .set({
      dossier: JSON.stringify({
        ...stored,
        siteRead: site,
        profile: merged,
        category,
        categoryTerms: merged.searchTerms,
      }),
      status: current.profileApproved ? current.status : "BRAND_RESEARCH",
      stepCursor: current.profileApproved ? current.stepCursor : "2",
      updatedAt: new Date(),
    })
    .where(eq(run.id, current.id));

  return { profile: merged, category, site };
}

/**
 * Rebuild a full CategoryReading from what was stored, so the lookup and the
 * screen both work from the same object. The stored form is deliberately flat —
 * it is JSON on the run — and this is the one place that inflates it.
 */
export function readingFrom(category: StoredCategory): CategoryReading {
  const primary = CATEGORY_BY_ID.get(category.id) ?? CATEGORY_BY_ID.get("general")!;
  return {
    primary: { category: primary, score: category.uncertain ? 20 : 60, matched: category.matched },
    neighbours: primary.neighbours
      .map((id) => CATEGORY_BY_ID.get(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    note: category.note,
    uncertain: category.uncertain,
  };
}

/**
 * The EXACT searches the lookup will run, computed before it runs — so the user
 * can see them on the screen and nothing happens they did not look at first.
 */
export function plannedTerms(category: StoredCategory, ownTerms: string[]): string[] {
  return sweepTerms(readingFrom(category), ownTerms);
}
