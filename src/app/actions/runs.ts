"use server";

/**
 * Run lifecycle: intake, brand read, competitor map, search plan.
 *
 * Every action here calls requireUser() and filters by that id. There is no
 * row-level security doing it for us.
 */
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { competitor, evidenceBatch, run, runStep, searchReference } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { describeDataError } from "@/lib/errors";
import {
  buildSearchUrl,
  describeFilters,
  MARKET_PRESETS,
  parseSearchUrl,
  type SearchSpec,
} from "@/lib/admirror/ad-library";
import { deriveCompetitorSlots, deriveDossier, STEPS } from "@/lib/admirror/pipeline";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(error: unknown, context: "loading" | "saving" = "saving"): ActionResult {
  return { ok: false, error: describeDataError(error, context).message };
}

/** Confirm this run belongs to the caller before anything touches it. */
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

export async function createRun(input: {
  brandName: string;
  brandWebsite: string;
  marketPresetId: string;
  customMarketLabel: string;
  customCountries: string;
  customLanguages: string;
  objectives: string[];
  mediaType: string;
  lookbackDays: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const brandName = input.brandName.trim();
    if (!brandName) return { ok: false, error: "Add your brand name to start a run." };

    const preset = MARKET_PRESETS.find((m) => m.id === input.marketPresetId);
    const marketLabel = preset?.label ?? input.customMarketLabel.trim();
    if (!marketLabel) {
      return { ok: false, error: "Pick a market, or describe the one you sell into." };
    }

    const countries = preset
      ? preset.countries.join(",")
      : input.customCountries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
          .join(",");
    const languages = preset
      ? preset.languages.join(",")
      : input.customLanguages
          .split(",")
          .map((l) => l.trim().toLowerCase())
          .filter(Boolean)
          .join(",");

    if (!countries) {
      return { ok: false, error: "Name at least one country code for this market, e.g. AE." };
    }

    const [created] = await db
      .insert(run)
      .values({
        userId: user.id,
        brandName,
        brandWebsite: input.brandWebsite.trim() || null,
        marketLabel,
        marketCountries: countries,
        marketLanguages: languages || "any",
        objectives: input.objectives.join(","),
        mediaType: input.mediaType,
        lookbackDays: input.lookbackDays,
        status: "INTAKE",
        stepCursor: "1",
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

/** Steps 2–4, run in order. Unattended, and each one writes its own step row. */
export async function advanceResearch(runId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);
    const objectives = current.objectives.split(",").filter(Boolean);

    // Step 2 — brand read.
    if (!current.dossier) {
      await setStep(runId, "BRAND_RESEARCH", "running");
      const dossier = deriveDossier({
        brandName: current.brandName,
        brandWebsite: current.brandWebsite,
        marketLabel: current.marketLabel,
        objectives,
      });
      await db
        .update(run)
        .set({ dossier: JSON.stringify(dossier), status: "COMPETITOR_MAP", stepCursor: "2", updatedAt: new Date() })
        .where(eq(run.id, runId));
      await setStep(runId, "BRAND_RESEARCH", "done", "Positioning, audience and voice read from your brief");
    }

    // Step 3 — competitor map.
    const existing = await db.select().from(competitor).where(eq(competitor.runId, runId));
    if (existing.length === 0) {
      await setStep(runId, "COMPETITOR_MAP", "running");
      const slots = deriveCompetitorSlots({
        brandName: current.brandName,
        marketLabel: current.marketLabel,
        objectives,
      });
      await db.insert(competitor).values(
        slots.map((slot) => ({
          runId,
          name: slot.name,
          tier: slot.tier,
          whyUseful: slot.whyUseful,
          confidence: String(slot.confidence),
        })),
      );
      await db
        .update(run)
        .set({ status: "COMPETITOR_MAP", stepCursor: "3", updatedAt: new Date() })
        .where(eq(run.id, runId));
      await setStep(runId, "COMPETITOR_MAP", "blocked_on_user", "Name the real companies, then build the plan");
    }

    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function renameCompetitor(input: {
  runId: string;
  competitorId: string;
  name: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    await db
      .update(competitor)
      .set({ name: input.name.trim() })
      .where(and(eq(competitor.id, input.competitorId), eq(competitor.runId, input.runId)));
    revalidatePath(`/runs/${input.runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleCompetitor(input: {
  runId: string;
  competitorId: string;
  pruned: boolean;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    await db
      .update(competitor)
      .set({ pruned: input.pruned })
      .where(and(eq(competitor.id, input.competitorId), eq(competitor.runId, input.runId)));
    revalidatePath(`/runs/${input.runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addCompetitor(input: { runId: string; name: string }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Give the competitor a name first." };
    await db.insert(competitor).values({
      runId: input.runId,
      name,
      tier: "DIRECT",
      whyUseful: "Added by you.",
      confidence: "100",
    });
    revalidatePath(`/runs/${input.runId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Step 4 — the manual discovery plan, kept for a run the user drives themselves.
 * The automatic path builds its own plan and then sweeps it; see `autopilot.ts`.
 */
export async function buildDiscoveryPlan(runId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(runId, user.id);
    await setStep(runId, "DISCOVERY_PLAN", "running");

    const kept = await db
      .select()
      .from(competitor)
      .where(and(eq(competitor.runId, runId), eq(competitor.pruned, false)));

    if (kept.length === 0) {
      return { ok: false, error: "Keep at least one competitor before building the plan." };
    }

    const existing = await db
      .select()
      .from(searchReference)
      .where(and(eq(searchReference.runId, runId), eq(searchReference.origin, "plan")));
    if (existing.length > 0) {
      for (const row of existing) {
        await db.delete(searchReference).where(eq(searchReference.id, row.id));
      }
    }

    const countries = current.marketCountries.split(",").filter(Boolean);
    const languages = current.marketLanguages.split(",").filter(Boolean);
    const rows: (typeof searchReference.$inferInsert)[] = [];

    for (const comp of kept) {
      for (const country of countries) {
        for (const language of languages.length > 0 ? languages : ["any"]) {
          const spec: SearchSpec = {
            competitorName: comp.name,
            country,
            language,
            mediaType: current.mediaType,
            activeStatus: "active",
          };
          rows.push({
            runId,
            competitorName: comp.name,
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
      }
    }

    await db.insert(searchReference).values(rows);

    const openBatch = await db
      .select()
      .from(evidenceBatch)
      .where(and(eq(evidenceBatch.runId, runId), eq(evidenceBatch.state, "open")))
      .limit(1);

    if (openBatch.length === 0) {
      const label = `${current.marketLabel} — ${new Date().toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })}`;
      await db.insert(evidenceBatch).values({ runId, label, state: "open" });
    }

    await db
      .update(run)
      .set({ status: "AWAITING_EVIDENCE", stepCursor: "4", updatedAt: new Date() })
      .where(eq(run.id, runId));
    await setStep(runId, "DISCOVERY_PLAN", "done", `${rows.length} searches ready to open`);
    await setStep(runId, "EVIDENCE_INTAKE", "blocked_on_user", "Open the searches and submit what you find");

    revalidatePath(`/runs/${runId}`);
    revalidatePath(`/runs/${runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Save a search URL the user pasted. We parse the filters to show them back and
 * store the link, so the next sweep can read this search too.
 */
export async function savePastedSearch(input: {
  runId: string;
  url: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);
    const raw = input.url.trim();
    if (!raw) return { ok: false, error: "Paste a link first." };

    const parsed = parseSearchUrl(raw);
    await db.insert(searchReference).values({
      runId: input.runId,
      competitorName: parsed.spec.competitorName || "Unnamed search",
      country: parsed.spec.country || "—",
      language: parsed.spec.language,
      mediaType: parsed.spec.mediaType,
      activeStatus: parsed.spec.activeStatus,
      filterSummary: parsed.ok ? parsed.summary : "Saved as a plain reference — filters couldn't be read",
      url: raw,
      origin: "user_pasted",
      rawInput: raw,
      parsed: parsed.ok,
    });

    revalidatePath(`/runs/${input.runId}/collect`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function listRuns() {
  const user = await requireUser();
  return db
    .select()
    .from(run)
    .where(eq(run.userId, user.id))
    .orderBy(asc(run.createdAt));
}
