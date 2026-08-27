"use server";

/**
 * Watch actions — the standing watch on a run, and the digest email.
 *
 * WHAT THIS DOES NOT DO: schedule a fetch. A cadence here produces a REMINDER
 * carrying the saved searches and their exact filters; the person decides to
 * look again, and the sweep they already use does the reading. Nothing in the
 * watchtower requests anything from Meta on a timer, and a "just to check if it
 * changed" exception would reintroduce the whole surface this product avoids.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { periodBriefing, run, watchTarget } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { describeDataError } from "@/lib/errors";
import { nextReminderFrom, VERDICT_LABEL, type Development } from "@/lib/admirror/watchtower";

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

/**
 * Turn the watch on or off, and set its cadence.
 *
 * One action rather than three: the control is a single panel, and a half-saved
 * watch (enabled, no cadence) is a state nobody wants to reason about.
 */
export async function setWatch(input: {
  runId: string;
  enabled: boolean;
  cadenceDays: string;
  emailDigest: boolean;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await ownedRun(input.runId, user.id);

    const cadence = ["7", "14", "30"].includes(input.cadenceDays) ? input.cadenceDays : "14";
    const now = new Date();

    const [existing] = await db
      .select()
      .from(watchTarget)
      .where(eq(watchTarget.runId, input.runId))
      .limit(1);

    if (existing) {
      await db
        .update(watchTarget)
        .set({
          enabled: input.enabled,
          cadenceDays: cadence,
          emailDigest: input.emailDigest,
          nextReminderAt: input.enabled
            ? nextReminderFrom(existing.lastLookedAt ?? now, Number(cadence))
            : null,
          updatedAt: now,
        })
        .where(eq(watchTarget.id, existing.id));
    } else {
      await db.insert(watchTarget).values({
        runId: input.runId,
        userId: user.id,
        enabled: input.enabled,
        cadenceDays: cadence,
        emailDigest: input.emailDigest,
        lastLookedAt: now,
        nextReminderAt: input.enabled ? nextReminderFrom(now, Number(cadence)) : null,
      });
    }

    revalidatePath(`/runs/${input.runId}/watch`);
    revalidatePath("/watch");
    revalidatePath("/library");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Email one briefing.
 *
 * Refuses on a quiet or non-comparable period, and says why. That refusal is the
 * feature — see the note on `shouldSendDigest`.
 */
export async function sendBriefingDigest(input: {
  runId: string;
  briefingId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const current = await ownedRun(input.runId, user.id);

    const [briefing] = await db
      .select()
      .from(periodBriefing)
      .where(
        and(eq(periodBriefing.id, input.briefingId), eq(periodBriefing.runId, input.runId)),
      )
      .limit(1);

    if (!briefing) {
      return { ok: false, error: "That briefing isn't here any more. Refresh and try again." };
    }
    if (briefing.verdict === "quiet") {
      return {
        ok: false,
        error:
          "This period was quiet, so there's nothing worth an email. Sending one anyway is how a digest gets ignored.",
      };
    }
    if (briefing.verdict === "not_comparable") {
      return {
        ok: false,
        error:
          "These sweeps weren't comparable, so there's no change to report — sweep the same searches again first.",
      };
    }

    let developments: Development[] = [];
    try {
      developments = (JSON.parse(briefing.developments || "[]") ?? []) as Development[];
    } catch {
      developments = [];
    }

    const rows = developments
      .map(
        (item) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e0d8;font-size:13px;line-height:1.5">` +
          `<strong>${escapeHtml(item.what)}</strong><br/>` +
          `<span style="color:#6c665c">${escapeHtml(item.who)}</span><br/>` +
          `<span style="color:#6c665c">${escapeHtml(item.interpretation)}</span></td></tr>`,
      )
      .join("");

    const verdictLabel =
      VERDICT_LABEL[briefing.verdict as keyof typeof VERDICT_LABEL] ?? briefing.verdict;

    const sent = await sendEmail({
      to: user.email,
      subject: `${current.brandName} — ${briefing.headline}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:600px;color:#1c1a17">
          <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8479;margin:0 0 6px">${escapeHtml(
            verdictLabel,
          )}</p>
          <p style="font-size:16px;margin:0 0 4px"><strong>${escapeHtml(briefing.headline)}</strong></p>
          <p style="font-size:13px;color:#6c665c;margin:0 0 16px">${escapeHtml(
            current.brandName,
          )} · ${escapeHtml(current.marketLabel)}</p>
          ${
            briefing.comparabilityNote
              ? `<p style="font-size:13px;color:#9a3412;margin:0 0 12px">${escapeHtml(
                  briefing.comparabilityNote,
                )}</p>`
              : ""
          }
          <p style="font-size:13px;color:#6c665c;margin:0 0 16px">${escapeHtml(briefing.coverageNote)}</p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e0d8">${rows}</table>
          <p style="font-size:11.5px;color:#8a8479;margin:18px 0 0;line-height:1.6">${escapeHtml(
            briefing.limitations,
          )}</p>
        </div>
      `,
    });

    if (!sent) {
      return {
        ok: false,
        error: "We couldn't send that just now. The briefing is still here on screen.",
      };
    }

    await db
      .update(periodBriefing)
      .set({ digestSent: true, digestSkippedReason: null })
      .where(eq(periodBriefing.id, briefing.id));

    revalidatePath(`/runs/${input.runId}/watch`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
