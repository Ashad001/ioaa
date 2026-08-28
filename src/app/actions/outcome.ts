"use server";

/**
 * The closed loop's write side: what you shipped, what it did, and what your
 * account's normal looks like.
 *
 * WHAT THIS DOES NOT DO, deliberately. The brief's phases 16–17 have IOAA.AI
 * publish to Ads Manager and pull Insights on a nightly job. That needs an ad
 * account token and a reviewed app, and neither exists here — so rather than
 * shipping a button that cannot work, the loop closes the honest way: the user
 * launches in their own ads manager and reports the numbers back. Every figure
 * below is therefore `self_reported_own_account`, which is a claim IOAA.AI can
 * actually stand behind.
 *
 * Every action loads the session and filters by that user's id. A record id from
 * the browser is not a permission check, so ownership is verified against the
 * parent run or ad on every single write.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  accountBaseline,
  creativeVariant,
  hookPattern,
  ownAd,
  run,
  shippedAd,
  shippedResult,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import {
  baselineFromOwnAds,
  deriveRates,
  indexRates,
  num,
  rollUpPatterns,
  statedBaseline,
  type PatternInput,
  toReading,
  type ReportedReading,
  NO_BASELINE,
} from "@/lib/admirror/outcome";

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

/** Digits only, and an empty box stays empty — never silently becomes a zero. */
function clean(input: string | undefined | null): string {
  if (!input) return "";
  const value = num(input);
  return value === null ? "" : String(value);
}

/* ── Marking a generated ad as shipped ───────────────────────────────────── */

/**
 * Record that a generated variant actually went live.
 *
 * The chain from real result back to borrowed angle runs through here:
 * variant → `sourceItemId` → the competitor ad whose angle it inherited. The
 * mechanism and format are COPIED onto the row rather than joined at read time,
 * so a later edit to the variant can't silently rewrite history in the pattern
 * library.
 */
export async function markShipped(input: {
  runId: string;
  variantId: string;
  label?: string;
  objective?: string;
  launchedOn?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);

    const [variant] = await db
      .select()
      .from(creativeVariant)
      .where(
        and(eq(creativeVariant.id, input.variantId), eq(creativeVariant.runId, input.runId)),
      )
      .limit(1);
    if (!variant) {
      return { ok: false, error: "That variant isn't here any more. Refresh and try again." };
    }

    const [existing] = await db
      .select()
      .from(shippedAd)
      .where(
        and(eq(shippedAd.variantId, input.variantId), eq(shippedAd.userId, user.id)),
      )
      .limit(1);
    if (existing) {
      return { ok: true, id: existing.id };
    }

    const mechanism = variant.hookLabel || "Unlabelled hook";
    const launched = input.launchedOn ? new Date(input.launchedOn) : new Date();

    const [row] = await db
      .insert(shippedAd)
      .values({
        userId: user.id,
        runId: input.runId,
        variantId: variant.id,
        sourceItemId: variant.sourceItemId,
        label: (input.label ?? "").trim() || `${current.brandName} — ${mechanism}`,
        hookMechanism: mechanism,
        formatLabel: variant.formatAxis === "contrast" ? "Customer-filmed" : "Studio",
        assetKind: variant.assetKind,
        objective: input.objective || current.objectives || "sales",
        marketLabel: current.marketLabel,
        categoryLabel: categoryOf(current.objectives, current.brandName),
        launchedOn: Number.isNaN(launched.getTime()) ? new Date() : launched,
        state: "live",
      })
      .returning({ id: shippedAd.id });

    revalidatePath(`/runs/${input.runId}/deliver`);
    revalidatePath("/results");
    return { ok: true, id: row.id };
  } catch (error) {
    return fail(error);
  }
}

export async function unmarkShipped(input: {
  shippedAdId: string;
  runId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db
      .delete(shippedAd)
      .where(and(eq(shippedAd.id, input.shippedAdId), eq(shippedAd.userId, user.id)));
    revalidatePath(`/runs/${input.runId}/deliver`);
    revalidatePath("/results");
    await refreshPatterns(user.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ── Reporting the numbers ───────────────────────────────────────────────── */

/**
 * File one reading of a shipped ad's real numbers.
 *
 * Readings are APPENDED, never overwritten: an ad read at day 3 and again at day
 * 14 tells you something the day-14 figure alone cannot, and a corrected reading
 * should sit beside the original rather than quietly replacing it.
 *
 * Raw counts only. A rate the user typed cannot be checked, cannot be re-derived
 * when the next reading lands, and cannot refuse itself for thin volume.
 */
export async function reportResult(input: {
  shippedAdId: string;
  daysLive?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  amountSpent?: string;
  currency?: string;
  results?: string;
  resultLabel?: string;
  videoPlays?: string;
  watched25?: string;
  watched75?: string;
  watched100?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [ad] = await db
      .select()
      .from(shippedAd)
      .where(and(eq(shippedAd.id, input.shippedAdId), eq(shippedAd.userId, user.id)))
      .limit(1);
    if (!ad) {
      return { ok: false, error: "That ad isn't here any more. Refresh and try again." };
    }

    if (clean(input.impressions) === "") {
      return {
        ok: false,
        error:
          "The view count is the one figure IOAA.AI needs — it's what decides whether there's enough here to read anything into.",
      };
    }

    const [row] = await db
      .insert(shippedResult)
      .values({
        shippedAdId: ad.id,
        userId: user.id,
        readOn: new Date(),
        daysLive: clean(input.daysLive),
        impressions: clean(input.impressions),
        reach: clean(input.reach),
        clicks: clean(input.clicks),
        amountSpent: clean(input.amountSpent),
        currency: (input.currency ?? "").trim().slice(0, 8),
        results: clean(input.results),
        resultLabel: (input.resultLabel ?? "").trim().slice(0, 60),
        videoPlays: clean(input.videoPlays),
        watched25: clean(input.watched25),
        watched75: clean(input.watched75),
        watched100: clean(input.watched100),
      })
      .returning({ id: shippedResult.id });

    await db
      .update(shippedAd)
      .set({ updatedAt: new Date() })
      .where(eq(shippedAd.id, ad.id));

    revalidatePath("/results");
    revalidatePath("/patterns");
    revalidatePath(`/runs/${ad.runId}/deliver`);
    await refreshPatterns(user.id);
    return { ok: true, id: row.id };
  } catch (error) {
    return fail(error);
  }
}

/* ── Your account's normal ───────────────────────────────────────────────── */

/**
 * Save the user's own account averages.
 *
 * This is the only reason a verdict can exist. An absolute rate is meaningless
 * across accounts; a rate indexed against the user's own average is the whole
 * comparison. Where these are blank, the app falls back to the middle of the
 * user's own other ads and says so — it never substitutes an industry figure,
 * because there isn't one it could honestly know.
 */
export async function saveBaseline(input: {
  clickThroughPct?: string;
  thumbstopPct?: string;
  holdPct?: string;
  costPerResult?: string;
  currency?: string;
  basisNote?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const values = {
      clickThroughPct: clean(input.clickThroughPct),
      thumbstopPct: clean(input.thumbstopPct),
      holdPct: clean(input.holdPct),
      costPerResult: clean(input.costPerResult),
      currency: (input.currency ?? "").trim().slice(0, 8),
      basisNote: (input.basisNote ?? "").trim().slice(0, 200),
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: accountBaseline.id })
      .from(accountBaseline)
      .where(eq(accountBaseline.userId, user.id))
      .limit(1);

    if (existing) {
      await db.update(accountBaseline).set(values).where(eq(accountBaseline.id, existing.id));
    } else {
      await db.insert(accountBaseline).values({ userId: user.id, ...values });
    }

    revalidatePath("/results");
    revalidatePath("/patterns");
    await refreshPatterns(user.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ── Your own ad on the board ────────────────────────────────────────────── */

/**
 * Pin one of the user's OWN ads to a run's board (the brief's phase 0).
 *
 * It lands in its own table, never in the evidence batch. That is structural: if
 * an own-brand row could sit in the evidence table behind a flag, then every
 * percentile base, coverage count and ranking query would need to remember to
 * exclude it — and one day one of them wouldn't. A separate table cannot be
 * forgotten.
 */
export async function addOwnAd(input: {
  runId: string;
  label?: string;
  headline?: string;
  bodyCopy?: string;
  ctaLabel?: string;
  assetKind?: string;
  impressions?: string;
  clicks?: string;
  amountSpent?: string;
  currency?: string;
  results?: string;
  resultLabel?: string;
  videoPlays?: string;
  watched25?: string;
  watched75?: string;
  daysLive?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);

    const headline = (input.headline ?? "").trim();
    const bodyCopy = (input.bodyCopy ?? "").trim();
    if (!headline && !bodyCopy) {
      return {
        ok: false,
        error: "Add at least the headline or the body copy — that's what makes this a usable read on your own voice.",
      };
    }

    const [row] = await db
      .insert(ownAd)
      .values({
        userId: user.id,
        runId: input.runId,
        label: (input.label ?? "").trim() || "Your ad",
        headline,
        bodyCopy,
        ctaLabel: (input.ctaLabel ?? "").trim(),
        voiceNote: `${headline} ${bodyCopy}`.trim().slice(0, 400),
        assetKind: input.assetKind === "static" ? "static" : "video",
        impressions: clean(input.impressions),
        clicks: clean(input.clicks),
        amountSpent: clean(input.amountSpent),
        currency: (input.currency ?? "").trim().slice(0, 8),
        results: clean(input.results),
        resultLabel: (input.resultLabel ?? "").trim().slice(0, 60),
        videoPlays: clean(input.videoPlays),
        watched25: clean(input.watched25),
        watched75: clean(input.watched75),
        daysLive: clean(input.daysLive),
      })
      .returning({ id: ownAd.id });

    revalidatePath(`/runs/${input.runId}/board`);
    return { ok: true, id: row.id };
  } catch (error) {
    return fail(error);
  }
}

export async function removeOwnAd(input: {
  ownAdId: string;
  runId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db
      .delete(ownAd)
      .where(and(eq(ownAd.id, input.ownAdId), eq(ownAd.userId, user.id)));
    revalidatePath(`/runs/${input.runId}/board`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ── The pattern library ─────────────────────────────────────────────────── */

/**
 * Recompute the whole pattern library for one user from their shipped ads.
 *
 * RECOMPUTED, never incremented. An incremented aggregate keeps a ghost of a
 * corrected reading forever, and there is no way to tell from the row that it is
 * wrong. Rebuilding is cheap at this scale and it is always right.
 *
 * Cells under the minimum come back with no numbers at all — the aggregation
 * drops them, so no screen could render one even by mistake.
 */
export async function refreshPatterns(userId: string): Promise<void> {
  try {
    const ads = await db.select().from(shippedAd).where(eq(shippedAd.userId, userId));
    if (ads.length === 0) {
      await db.delete(hookPattern).where(eq(hookPattern.userId, userId));
      return;
    }

    const readings = await db
      .select()
      .from(shippedResult)
      .where(eq(shippedResult.userId, userId));

    const latestByAd = new Map<string, (typeof readings)[number]>();
    for (const row of readings) {
      const current = latestByAd.get(row.shippedAdId);
      if (!current || row.readOn.getTime() > current.readOn.getTime()) {
        latestByAd.set(row.shippedAdId, row);
      }
    }

    const stated = statedBaseline(
      (
        await db
          .select()
          .from(accountBaseline)
          .where(eq(accountBaseline.userId, userId))
          .limit(1)
      )[0] ?? null,
    );

    const allReadings: ReportedReading[] = [...latestByAd.values()].map(toReading);
    const baseline = stated ?? baselineFromOwnAds(allReadings) ?? NO_BASELINE;

    const inputs: PatternInput[] = ads.map((ad) => {
      const reading = latestByAd.get(ad.id);
      const rates = reading ? deriveRates(toReading(reading)) : null;
      return {
        mechanism: ad.hookMechanism,
        formatLabel: ad.formatLabel,
        categoryLabel: ad.categoryLabel,
        marketLabel: ad.marketLabel,
        indexed: rates
          ? indexRates(rates, baseline)
          : { thumbstop: null, hold: null, click: null, cost: null },
        measured: Boolean(reading && num(reading.impressions) !== null),
      };
    });

    const cells = rollUpPatterns(inputs);

    await db.delete(hookPattern).where(eq(hookPattern.userId, userId));
    if (cells.length === 0) return;

    await db.insert(hookPattern).values(
      cells.map((cell) => ({
        userId,
        mechanism: cell.mechanism,
        formatLabel: cell.formatLabel,
        categoryLabel: cell.categoryLabel,
        marketLabel: cell.marketLabel,
        shippedCount: String(cell.shippedCount),
        measuredCount: String(cell.measuredCount),
        thumbstopIndex: cell.thumbstopIndex === null ? "" : String(cell.thumbstopIndex),
        holdIndex: cell.holdIndex === null ? "" : String(cell.holdIndex),
        clickIndex: cell.clickIndex === null ? "" : String(cell.clickIndex),
        costIndex: cell.costIndex === null ? "" : String(cell.costIndex),
        standing: cell.standing,
        updatedAt: new Date(),
      })),
    );
  } catch {
    // The library is a derived convenience. A failure here must never take down
    // the write that triggered it — the user's reading is the thing that matters.
  }
}

/**
 * A crude category label from what we know, used only to GROUP patterns.
 *
 * It never appears as a claim about the user's business, and it is derived here
 * rather than asked for because one more intake field to make a grouping key
 * slightly tidier is not a trade worth making.
 */
function categoryOf(objectives: string, brandName: string): string {
  const text = `${objectives} ${brandName}`.toLowerCase();
  const buckets: [string, string[]][] = [
    ["Beauty & skincare", ["skin", "beauty", "cosmetic", "serum", "derma"]],
    ["Health & fitness", ["fit", "health", "gym", "supplement", "clinic"]],
    ["Food & drink", ["food", "coffee", "restaurant", "kitchen", "bakery"]],
    ["Software", ["app", "software", "saas", "platform", "dashboard"]],
    ["Education", ["course", "academy", "school", "learn", "training"]],
    ["Retail", ["shop", "store", "wear", "furniture", "retail"]],
    ["Services", ["agency", "service", "consult", "studio", "legal"]],
  ];
  for (const [label, words] of buckets) {
    if (words.some((word) => text.includes(word))) return label;
  }
  return "General";
}
