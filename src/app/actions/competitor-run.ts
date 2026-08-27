"use server";

/**
 * START A RUN — website first, competitor names optional.
 *
 * The names used to be REQUIRED, because collection went straight from a name to
 * a lookup. It doesn't any more: the run now opens on the profile screen, where
 * the company is read, the field is decided, and the rival list is looked up out
 * of that field's own advertising vocabulary. So a user who knows exactly who
 * they compete with can type them here and skip a step, and a user who doesn't
 * gets the same list found for them.
 */

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
