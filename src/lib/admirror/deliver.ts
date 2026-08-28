import "server-only";

/**
 * Step 15 — the handoff.
 *
 * A generated ad that leaves this app without a record of where its angle came
 * from is exactly the thing the whole product exists to avoid. So delivery is
 * two things, not one:
 *
 *  1. A PROVENANCE RECORD: every asset, the evidence item whose angle it
 *     inherited, the coverage the gate was pressed at, and the gate results —
 *     including the ones that blocked.
 *  2. An EXPORT the buyer can actually use: the copy, the scripts, the render
 *     briefs and the test plan, as text and as a spreadsheet.
 *
 * Nothing here fetches anything, and no figure is derived that the evidence
 * does not contain. The source-mode statement travels with every export.
 */
import type { AngleBrief, GateResult, TestPlan } from "./generate";
import type { RoundedTestPlan } from "./matrix";
import type { BatchRow, EvidenceRow, RunRow, VariantRow } from "./queries";
import { COVERAGE_STATEMENT } from "./provenance";

export type VariantGates = {
  results?: GateResult[];
  testPlan?: TestPlan;
  roundedPlan?: RoundedTestPlan;
  angleBrief?: AngleBrief;
  matrix?: { choice: Record<string, boolean>; cost: { summary: string; total: number } };
};

export function parseGates(variant: VariantRow): VariantGates {
  try {
    return variant.gates ? (JSON.parse(variant.gates) as VariantGates) : {};
  } catch {
    return {};
  }
}

export type ProvenanceLine = {
  assetLabel: string;
  assetKind: string;
  format: string;
  sharedBody: string;
  sourceAdvertiser: string;
  sourceLibraryUrl: string | null;
  observedAt: string;
  angle: string;
  transferred: string;
  blockedBy: string | null;
  warnings: string[];
};

/** One line per delivered asset — the audit trail, in the user's language. */
export function buildProvenanceRecord(input: {
  variants: VariantRow[];
  items: EvidenceRow[];
}): ProvenanceLine[] {
  const itemById = new Map(input.items.map((item) => [item.id, item]));

  return input.variants.map((variant) => {
    const gates = parseGates(variant);
    const source = variant.sourceItemId ? itemById.get(variant.sourceItemId) : undefined;
    const results = gates.results ?? [];
    const blocked = results.find((gate) => gate.state === "block") ?? null;

    return {
      assetLabel: variant.hookLabel,
      assetKind: variant.assetKind === "static" ? "Static" : "Video",
      format: variant.formatAxis === "contrast" ? "Customer-filmed" : "Studio",
      sharedBody: variant.sharedBodyKey ? shortBodyKey(variant.sharedBodyKey) : "—",
      sourceAdvertiser: source?.advertiser || "an ad you submitted",
      sourceLibraryUrl: source?.libraryUrl ?? null,
      observedAt: source?.observedAt ? source.observedAt.toISOString().slice(0, 10) : "—",
      angle: gates.angleBrief?.angle ?? "—",
      transferred: "Hook mechanism, angle, objection, beat order, offer shape",
      blockedBy: blocked ? `${blocked.name}: ${blocked.detail}` : null,
      warnings: results.filter((gate) => gate.state === "warn").map((gate) => gate.detail),
    };
  });
}

function shortBodyKey(key: string) {
  const [itemId, format] = key.split("::");
  return `${format ?? "primary"}-${itemId.slice(0, 6)}`;
}

/** How many bodies were actually written — the proof of the shared-body rule. */
export function countSharedBodies(variants: VariantRow[]): number {
  return new Set(
    variants.filter((variant) => variant.assetKind === "video").map((variant) => variant.sharedBodyKey),
  ).size;
}

// ─── The export ───────────────────────────────────────────────────────────────

function csvCell(value: string | null): string {
  const text = (value ?? "").replace(/\r?\n/g, " ").trim();
  // A leading =, +, - or @ makes a spreadsheet evaluate the cell. Neutralise it:
  // this text came from an untrusted paste and is data, never a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(input: {
  run: RunRow;
  variants: VariantRow[];
  items: EvidenceRow[];
}): string {
  const record = buildProvenanceRecord(input);
  const rows = [
    [
      "Asset",
      "Kind",
      "Format",
      "Shared body",
      "Hook line",
      "Primary text",
      "Headline",
      "CTA",
      "Opening-frame brief",
      "Motion brief",
      "Angle inherited from",
      "Source ad seen on",
      "Angle",
      "Held by a gate",
    ].map((header) => csvCell(header)),
    ...input.variants.map((variant, index) => {
      const line = record[index];
      return [
        variant.hookLabel,
        line.assetKind,
        line.format,
        line.sharedBody,
        variant.hookLine,
        variant.primaryText,
        variant.headline,
        variant.ctaLabel,
        variant.firstFramePrompt,
        variant.motionPrompt,
        line.sourceAdvertiser,
        line.observedAt,
        line.angle,
        line.blockedBy ?? "no",
      ].map((cell) => csvCell(cell));
    }),
  ];

  const notice = [
    csvCell(COVERAGE_STATEMENT),
    csvCell(
      "Angle transfer only: no competitor footage, voice, talent, mark or wording is used in any asset here.",
    ),
  ];

  return [notice.join(","), "", ...rows.map((row) => row.join(","))].join("\n");
}

/** The whole run as one readable brief the buyer can paste into a doc. */
export function buildBrief(input: {
  run: RunRow;
  variants: VariantRow[];
  items: EvidenceRow[];
  batch: BatchRow | null;
}): string {
  const { run, variants } = input;
  const record = buildProvenanceRecord(input);
  const first = variants[0] ? parseGates(variants[0]) : {};
  const bodies = countSharedBodies(variants);
  const out: string[] = [];

  out.push(`${run.brandName} — ${run.marketLabel}`);
  out.push("Creative handoff from IOAA.AI");
  out.push("");
  out.push(COVERAGE_STATEMENT);
  if (input.batch) {
    out.push(
      `Coverage when the angles were chosen: ${input.batch.coverageBand} (${Number(
        input.batch.coverageScore,
      ).toFixed(2)}).`,
    );
  }
  out.push("");

  if (first.angleBrief) {
    out.push("THE ANGLE");
    out.push(`Angle: ${first.angleBrief.angle}`);
    out.push(`Hook mechanism: ${first.angleBrief.hookMechanism}`);
    out.push(`Objection handled: ${first.angleBrief.objection}`);
    out.push(`Offer shape: ${first.angleBrief.offerShape}`);
    out.push("Guardrails:");
    for (const rule of first.angleBrief.guardrails) out.push(`  - ${rule}`);
    out.push("");
  }

  out.push("THE ASSETS");
  out.push(
    `${variants.length} asset${variants.length === 1 ? "" : "s"} over ${bodies} shared bod${
      bodies === 1 ? "y" : "ies"
    } — only the first three seconds differ between hooks.`,
  );
  out.push("");

  variants.forEach((variant, index) => {
    const line = record[index];
    out.push(`--- ${variant.hookLabel} (${line.assetKind}, ${line.format}) ---`);
    if (line.blockedBy) out.push(`HELD BY A GATE — ${line.blockedBy}`);
    out.push(`Hook: ${variant.hookLine}`);
    out.push("");
    out.push("Primary text:");
    out.push(variant.primaryText);
    out.push("");
    out.push(`Headline: ${variant.headline}`);
    out.push(`CTA: ${variant.ctaLabel}`);
    out.push("");
    out.push(`Opening frame: ${variant.firstFramePrompt}`);
    out.push(`Motion: ${variant.motionPrompt}`);
    out.push("");
    out.push(`Angle inherited from: ${line.sourceAdvertiser} (seen ${line.observedAt})`);
    out.push("");
  });

  const plan = first.roundedPlan;
  if (plan) {
    out.push("THE TEST PLAN");
    out.push(plan.readabilityNote);
    out.push("");
    for (const round of plan.rounds) {
      out.push(`Round ${round.round} — ${round.variableUnderTest}`);
      out.push(`  Cells: ${round.variants.join(", ")}`);
      out.push(`  Held constant: ${round.shared.join("; ")}`);
      out.push(`  Read on: ${round.primaryMetric}`);
      out.push(`  Kill: ${round.killCriterion}`);
      out.push(`  Winner: ${round.winnerCriterion}`);
      out.push(`  Minimum: ${round.minDays} days of equal delivery per cell`);
      out.push("");
    }
    out.push(`What round one feeds: ${plan.nextRoundLogic}`);
    out.push("");
    out.push("Assumptions:");
    for (const assumption of plan.assumptions) out.push(`  - ${assumption}`);
    out.push("");
  }

  out.push("WHERE EVERY ASSET CAME FROM");
  for (const line of record) {
    out.push(
      `${line.assetLabel} — angle from ${line.sourceAdvertiser}, seen ${line.observedAt}. Transferred: ${line.transferred}. Nothing from their media, voice, talent or marks.`,
    );
  }

  return out.join("\n");
}
