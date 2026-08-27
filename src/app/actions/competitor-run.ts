"use server";

import { addCompetitor } from "@/app/actions/runs";
import { startAutoRun, type ActionResult } from "@/app/actions/autopilot";

export async function startCompetitorRun(input: {
  website: string;
  brandNameOverride?: string;
  objectives?: string[];
  competitorNames: string[];
}): Promise<ActionResult> {
  const names = Array.from(
    new Map(
      input.competitorNames
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [name.toLocaleLowerCase(), name]),
    ).values(),
  );

  if (names.length === 0) {
    return { ok: false, error: "Add at least one competitor to track." };
  }

  const created = await startAutoRun({
    website: input.website,
    brandNameOverride: input.brandNameOverride,
    objectives: input.objectives,
  });
  if (!created.ok || !created.id) return created;

  for (const name of names) {
    const added = await addCompetitor({ runId: created.id, name });
    if (!added.ok) return added;
  }

  return created;
}
