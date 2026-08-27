"use server";

/**
 * IMPORT RIVAL ADS FROM THE USER'S OWN BROWSER — the no-key route.
 *
 * WHY THIS EXISTS. Meta blocks datacentre reads of the Ad Library, and in some
 * countries the official API cannot be used at all. When AdMirror's own reader is
 * not connected, that used to be the end of the road for collection. It isn't:
 * the user's browser can open the same public page any person can open. So they
 * open the search, copy the page, and paste it here — and the ads land in exactly
 * the same place, in exactly the same shape, as ads the reader collects. Every
 * later stage (ranking, teardown, the board, the variants, the export) works
 * identically and needs no knowledge of which route an ad arrived by.
 *
 * WHAT MAKES IT HONEST. Imported ads carry their own provenance,
 * `read_in_your_browser`: not "we read it" (we didn't), not "you typed it" (they
 * didn't). A field the page did not show stays empty — never a zero, never a
 * guess. And no performance figure is ever written, because the public Library
 * publishes none for a commercial ad.
 *
 * SECURITY. There is no row-level safety net on this database, so every path here
 * loads the session with `requireUser()` and filters by that user's id before it
 * touches a row. A record id arriving from the browser is never a permission.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { evidenceBatch, evidenceItem, run, runStep, searchReference } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import { readLibraryPaste, type PastedAd } from "@/lib/admirror/library-paste";

export type ImportResult =
  | {
      ok: true;
      /** New rows written. */
      imported: number;
      /** Ads read out of the paste, including ones already on the board. */
      read: number;
      /** Read but skipped because the board already had them. */
      duplicates: number;
      /** Plain-words outcome, shown verbatim. */
      note: string;
    }
  | { ok: false; error: string };

async function ownedRun(runId: string, userId: string) {
  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.userId, userId)))
    .limit(1);
  if (!row) throw new Error("That run doesn't exist, or it isn't yours.");
  return row;
}

async function openBatchFor(runId: string) {
  const [existing] = await db
    .select()
    .from(evidenceBatch)
    .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(evidenceBatch)
    .values({
      runId,
      label: `Capture ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      state: "open",
    })
    .returning();
  return created;
}

/**
 * One pasted card onto an evidence row.
 *
 * The provenance rule in one place: a field the page showed is
 * `read_in_your_browser`; a field it did not show is `unknown`. There is no third
 * case, and nothing here may write a reach or spend figure.
 */
function toEvidence(
  ad: PastedAd,
  context: {
    runId: string;
    batchId: string;
    searchReferenceId: string | null;
    market: string;
    language: string;
    observedAt: Date;
  },
): typeof evidenceItem.$inferInsert {
  const browser = "read_in_your_browser";
  const seen = (field: string) => (ad.readFields.includes(field) ? browser : "unknown");

  return {
    batchId: context.batchId,
    runId: context.runId,
    searchReferenceId: context.searchReferenceId,
    intakeKind: "text",
    modality: ad.bodyCopy || ad.headline ? "text_only" : "partial",
    advertiser: ad.advertiser,
    advertiserProvenance: seen("advertiser"),
    libraryUrl: ad.libraryUrl,
    libraryUrlProvenance: ad.libraryUrl ? browser : "unknown",
    headline: ad.headline,
    headlineProvenance: seen("headline"),
    bodyCopy: ad.bodyCopy,
    bodyCopyProvenance: seen("bodyCopy"),
    ctaLabel: ad.ctaLabel,
    ctaProvenance: seen("ctaLabel"),
    platforms: ad.platforms.join(","),
    platformsProvenance: seen("platforms"),
    activeStatus: ad.activeStatus,
    activeStatusProvenance: seen("activeStatus"),
    visibleStartDate: ad.visibleStartDate || null,
    visibleStartDateProvenance: seen("visibleStartDate"),
    // The order the user's own browser showed. It is a position, never a metric.
    visibleResultRank: String(ad.resultRank),
    visibleResultRankProvenance: browser,
    // No reach figure can be read off a page, so both columns stay empty and
    // every surface says "not published" rather than showing a zero.
    impressionsLower: null,
    impressionsUpper: null,
    impressionsProvenance: "unknown",
    adVariantCount: String(ad.variantCount),
    market: context.market,
    language: context.language,
    observedAt: context.observedAt,
    notes: [
      ...ad.notes,
      ad.displayLink ? `Display link: ${ad.displayLink}` : "",
      ad.missing.length > 0
        ? `The page didn't show: ${ad.missing.join(", ")}. Add them yourself if you saw them.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Commit a pasted Ad Library page.
 *
 * Deduping happens on the Library id, which is the only fully transparent key —
 * two pastes of the same search, or a paste over ads the reader already
 * collected, add nothing twice and delete nothing.
 */
export async function importLibraryPaste(input: {
  runId: string;
  searchReferenceId: string | null;
  pasted: string;
  /** Country/market the user had filtered to, as they state it. */
  market: string;
  language: string;
}): Promise<ImportResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);

    if ((input.pasted ?? "").trim().length === 0) {
      return { ok: false, error: "Paste the Library page first — there's nothing to read yet." };
    }

    const reading = readLibraryPaste(input.pasted);
    if (reading.ads.length === 0) {
      return {
        ok: false,
        error:
          reading.problem ??
          "No ads could be read out of that text. Select the whole Library page and copy it again.",
      };
    }

    // The search this paste belongs to, if the user had one selected and it is
    // genuinely part of THIS run.
    let reference: typeof searchReference.$inferSelect | null = null;
    if (input.searchReferenceId) {
      const [row] = await db
        .select()
        .from(searchReference)
        .where(
          and(
            eq(searchReference.id, input.searchReferenceId),
            eq(searchReference.runId, input.runId),
          ),
        )
        .limit(1);
      reference = row ?? null;
    }

    const batch = await openBatchFor(input.runId);
    const observedAt = new Date();

    const existing = await db
      .select({ libraryUrl: evidenceItem.libraryUrl })
      .from(evidenceItem)
      .where(eq(evidenceItem.runId, input.runId));
    const known = new Set(
      existing
        .map((row) => row.libraryUrl?.match(/[?&]id=([0-9]{6,})/)?.[1] ?? null)
        .filter((id): id is string => Boolean(id)),
    );

    const fresh: PastedAd[] = [];
    for (const ad of reading.ads) {
      if (ad.libraryId && known.has(ad.libraryId)) continue;
      if (ad.libraryId) known.add(ad.libraryId);
      fresh.push(ad);
    }

    const rows = fresh.map((ad) =>
      toEvidence(ad, {
        runId: input.runId,
        batchId: batch.id,
        searchReferenceId: reference?.id ?? null,
        market: input.market || reference?.country || current.marketLabel,
        language: input.language || reference?.language || "",
        observedAt,
      }),
    );

    for (let start = 0; start < rows.length; start += 25) {
      await db.insert(evidenceItem).values(rows.slice(start, start + 25));
    }

    // The search's lamp now reflects what the USER'S read actually did — so a
    // search the server could not reach stops claiming the market is quiet.
    if (reference) {
      await db
        .update(searchReference)
        .set({
          lastSweptAt: observedAt,
          lastSweepCount: String(reading.ads.length),
          lastSweepNote:
            rows.length === 0
              ? `${reading.ads.length} ads read from your browser — all already on your board.`
              : `${rows.length} ad${rows.length === 1 ? "" : "s"} imported from the Library page you opened yourself.`,
          lastSweepState: "ok",
        })
        .where(and(eq(searchReference.id, reference.id), eq(searchReference.runId, input.runId)));
    }

    if (rows.length > 0) {
      await db
        .update(runStep)
        .set({ state: "blocked_on_user", detail: `${rows.length} ads imported from your browser` })
        .where(and(eq(runStep.runId, input.runId), eq(runStep.name, "EVIDENCE_INTAKE")));
      await db
        .update(run)
        .set({ status: "AWAITING_EVIDENCE", updatedAt: new Date() })
        .where(and(eq(run.id, input.runId), eq(run.userId, user.id)));
    }

    revalidatePath(`/runs/${input.runId}`);
    revalidatePath(`/runs/${input.runId}/collect`);
    revalidatePath(`/runs/${input.runId}/board`);

    const duplicates = reading.ads.length - rows.length;
    return {
      ok: true,
      imported: rows.length,
      read: reading.ads.length,
      duplicates,
      note:
        rows.length === 0
          ? `All ${reading.ads.length} ads on that page were already on your board.`
          : `${rows.length} ad${rows.length === 1 ? "" : "s"} imported${duplicates > 0 ? `, ${duplicates} already had` : ""}. Rank the collection to see them scored.`,
    };
  } catch (error) {
    return { ok: false, error: describeDataError(error, "saving").message };
  }
}
