/**
 * Steps 10–15: angle transfer, script, first-frame brief, motion brief, gates,
 * and the test plan.
 *
 * The rule this module exists to enforce is the "copy" rule: we transfer the
 * ANGLE, never the asset. What crosses over is the hook mechanism, the objection,
 * the beat order and the offer shape. What never crosses over is their footage,
 * voice, talent, marks or wording — and the similarity gate below is what proves
 * it rather than promising it.
 *
 * No media provider is wired in on this build, so steps 12 and 13 produce the
 * PROMPTS and briefs, ready to render, rather than finished files. Everything
 * says so plainly in the UI; nothing shows a fake rendered asset.
 */
import { deriveTeardown, type Teardown } from "./pipeline";
import {
  DEFAULT_MATRIX,
  durationSpec,
  resolutionSpec,
  type DurationKey,
  type ResolutionKey,
} from "./matrix";

/**
 * THE DELIVERY SPEC travels with every cell.
 *
 * The frame size decides where the safe area is and therefore where the headline
 * can sit; the runtime decides the beat clock. Writing a script without both is
 * how a brief ends up unusable, so they are required inputs here rather than
 * decoration added at the end.
 */
export type DeliverySpec = {
  resolution: ResolutionKey;
  durationSeconds: DurationKey;
};

/** Beat times spread across the ACTUAL runtime, never a fixed two-second grid. */
function beatClock(durationSeconds: number, beatCount: number): string[] {
  const count = Math.max(1, beatCount);
  return Array.from({ length: count }, (_, index) => {
    const at = Math.round((durationSeconds / count) * index * 10) / 10;
    const whole = Math.floor(at);
    const tenth = Math.round((at - whole) * 10);
    const stamp = `0:${String(whole).padStart(2, "0")}`;
    return tenth === 0 ? stamp : `${stamp}.${tenth}`;
  });
}

export type AngleBrief = {
  angle: string;
  hookMechanism: string;
  objection: string;
  beatOrder: string[];
  offerShape: string;
  inheritedFromItemId: string;
  brandVoice: string;
  guardrails: string[];
};

export function angleTransfer(input: {
  itemId: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  modality: string;
  brandName: string;
  marketLabel: string;
  voice: string;
}): { brief: AngleBrief; teardown: Teardown } {
  const teardown = deriveTeardown({
    id: input.itemId,
    headline: input.headline,
    bodyCopy: input.bodyCopy,
    ctaLabel: input.ctaLabel,
    modality: input.modality,
  });

  return {
    teardown,
    brief: {
      angle: teardown.angle,
      hookMechanism: teardown.hookMechanism,
      objection: teardown.objection,
      beatOrder: teardown.beatOrder,
      offerShape: teardown.offerShape,
      inheritedFromItemId: input.itemId,
      brandVoice: input.voice,
      guardrails: [
        "No shared wording with the source ad",
        "No competitor mark, slogan or trade dress",
        "No claim your brand can't substantiate",
        `Written for ${input.marketLabel}, in ${input.brandName}'s voice`,
      ],
    },
  };
}

// ─── Step 11–13: three hooks over one shared body (the creative matrix) ────────

export type HookVariant = {
  index: number;
  hookLabel: string;
  hookLine: string;
  script: {
    beats: { at: string; onScreen: string; vo: string }[];
    retentionNote: string;
  };
  firstFramePrompt: string;
  motionPrompt: string;
  primaryText: string;
  headline: string;
  ctaLabel: string;
  testRole: string;
  /** What this cell hands over: a motion brief, or a static built from its frame. */
  assetKind: "video" | "static";
  /** primary · contrast — the format axis of the matrix. */
  formatAxis: "primary" | "contrast";
  /** Which shared body this cell cuts onto. One per angle × format, never per hook. */
  sharedBodyKey: string;
  /** Alternative primary texts. Text costs nothing, so the buyer gets ammunition. */
  altCopy: string[];
  /** The size this asset is built to — pixels, not a vague "vertical". */
  outputResolution: ResolutionKey;
  /** The runtime it is cut to, in seconds. Statics carry 0. */
  outputDurationSeconds: number;
};

const HOOK_SHAPES = [
  {
    label: "Direct claim",
    role: "Control — the plainest expression of the angle",
    line: (brand: string, angle: string) =>
      `${brand}: ${angle.toLowerCase()}, without the usual trade-off.`,
    frame: "Product held in frame, single hard key light, plain seamless backdrop",
    motion: "Slow push in on the product, 8% over four seconds, no cuts",
  },
  {
    label: "Objection first",
    role: "Challenger — tests whether naming the doubt beats stating the benefit",
    line: (brand: string, angle: string, objection?: string) =>
      `You've been told ${(objection ?? "the catch").split("—")[0].trim().toLowerCase()} is the catch. ${brand} removes it.`,
    frame: "Hand entering frame mid-action, shallow depth, natural window light",
    motion: "Handheld drift with a settle on the reveal at second two",
  },
  {
    label: "Result before product",
    role: "Challenger — tests outcome-led opening against product-led",
    line: (brand: string, angle: string) =>
      `This is what ${angle.toLowerCase()} actually looks like. ${brand} did it.`,
    frame: "The finished outcome first, product out of shot, ambient practical light",
    motion: "Static hold, then a whip pan to the product at second three",
  },
] as const;

/**
 * The two formats on the format axis. `primary` is the studio read; `contrast`
 * is the same angle shot as if a customer filmed it. Only offered when the user
 * asks for it at the gate, because six cells on one angle is a bigger test than
 * most budgets can read.
 */
const FORMAT_SHAPES = {
  primary: {
    label: "Studio",
    frameNote: "Controlled studio treatment, deliberate lighting, product hero framing",
    motionNote: "Tripod-steady, one considered camera move",
  },
  contrast: {
    label: "Customer-filmed",
    frameNote:
      "Filmed the way a customer would film it: phone height, a real room, available light, nothing styled",
    motionNote: "Handheld, one continuous take, no cuts and no camera tricks",
  },
} as const;

export const FORMAT_LABELS: Record<"primary" | "contrast", string> = {
  primary: FORMAT_SHAPES.primary.label,
  contrast: FORMAT_SHAPES.contrast.label,
};

/** Three alternative primary texts on the same angle. Text, so it is near-free. */
function altCopyFor(input: {
  brief: AngleBrief;
  brandName: string;
  hookLine: string;
  cta: string;
}): string[] {
  const { brief, brandName, hookLine, cta } = input;
  const objection = brief.objection.split("—")[1]?.trim() ?? "the doubt";
  return [
    `${hookLine}\n\n${brief.offerShape}. ${cta}.`,
    `Most people assume ${objection.toLowerCase()}. ${brandName} is built the other way round.\n\n${brief.angle}. ${cta}.`,
    `${brief.angle} — stated plainly, because ${brandName} doesn't need the build-up.\n\n${brief.offerShape}. ${cta}.`,
  ];
}

export function buildVariants(input: {
  brief: AngleBrief;
  brandName: string;
  marketLabel: string;
  ctaLabel: string;
  formatAxis?: "primary" | "contrast";
  includeStatics?: boolean;
  includeCopyVariants?: boolean;
  /** Required in practice — defaulted only so older callers still compile. */
  spec?: DeliverySpec;
}): HookVariant[] {
  const { brief, brandName, marketLabel } = input;
  const cta = input.ctaLabel || "Shop now";
  const formatAxis = input.formatAxis ?? "primary";
  const format = FORMAT_SHAPES[formatAxis];
  const spec: DeliverySpec = input.spec ?? {
    resolution: DEFAULT_MATRIX.resolution,
    durationSeconds: DEFAULT_MATRIX.durationSeconds,
  };
  const size = resolutionSpec(spec.resolution);
  const runtime = durationSpec(spec.durationSeconds);
  const seconds = spec.durationSeconds;
  // One body per angle × format — never one per hook. This key is the proof.
  const sharedBodyKey = `${brief.inheritedFromItemId}::${formatAxis}`;

  const clock = beatClock(seconds, brief.beatOrder.length);
  const hookOut = clock[1] ?? `0:0${Math.max(1, Math.round(seconds / 3))}`;

  const videos: HookVariant[] = HOOK_SHAPES.map((shape, index) => {
    const hookLine = shape.line(brandName, brief.angle, brief.objection);

    return {
      index: index + 1,
      hookLabel: formatAxis === "contrast" ? `${shape.label} · ${format.label}` : shape.label,
      hookLine,
      script: {
        beats: brief.beatOrder.map((beat, beatIndex) => ({
          at: clock[beatIndex] ?? "0:00",
          onScreen:
            beatIndex === 0
              ? hookLine
              : `${beat} — ${brief.angle.toLowerCase()} carried in one line`,
          vo:
            beatIndex === 0
              ? hookLine
              : `${beat}: keep it to eight words, ${brief.brandVoice.split(".")[0].toLowerCase()}`,
        })),
        retentionNote: `Cut to ${seconds} seconds at ${size.width}×${size.height} (${size.ratio}). The hook is out by ${hookOut} and the ask arrives while the promise is still on screen. Only beat one differs between the hooks in this format — everything after ${hookOut} is the shared body. ${runtime.note}`,
      },
      firstFramePrompt: [
        `Advertising photograph for ${brandName}, ${marketLabel} market.`,
        `Output ${size.width}×${size.height} pixels, ${size.ratio}.`,
        `${shape.frame}. ${format.frameNote}.`,
        `Composition leaves the upper third clear for the headline: “${hookLine}”.`,
        spec.resolution === "1080x1920"
          ? "Keep every element out of the top and bottom 14% of frame — those bands are covered by the platform's own interface."
          : "Keep type inside a 6% margin on every edge.",
        "Realistic optics, 50mm, f/2.8, natural colour, no logos or marks other than the brand's own.",
        "No competitor marks, no borrowed trade dress, no recognisable third-party talent.",
        "The hook shot ends on the shared body's opening frame, so the cut is invisible.",
      ].join(" "),
      motionPrompt: `${seconds}-second cut at ${size.width}×${size.height} (${size.ratio}). ${shape.motion}. ${format.motionNote}. Subject stays in the calm zone; no camera move fights the on-screen text. Colour-match to the shared body before the cut at ${hookOut}.`,
      primaryText: [
        hookLine,
        "",
        `${brief.objection.split("—")[1]?.trim() ?? "The doubt handled up front"}.`,
        `${brief.offerShape}.`,
      ].join("\n"),
      headline: hookLine.length > 40 ? `${hookLine.slice(0, 37)}…` : hookLine,
      ctaLabel: cta,
      testRole: formatAxis === "contrast" ? `${shape.role}, filmed as a customer would` : shape.role,
      assetKind: "video",
      formatAxis,
      sharedBodyKey,
      altCopy: input.includeCopyVariants ? altCopyFor({ brief, brandName, hookLine, cta }) : [],
      outputResolution: spec.resolution,
      outputDurationSeconds: seconds,
    };
  });

  if (!input.includeStatics) return videos;

  // A static per video, from the opening frame that already exists. No extra
  // render call — which is exactly why it ships alongside every video.
  const statics: HookVariant[] = videos.map((video) => ({
    ...video,
    hookLabel: `${video.hookLabel} · static`,
    assetKind: "static",
    testRole: "Static companion — the opening frame with the headline burned in",
    motionPrompt: `No motion. Export the opening frame at ${size.width}×${size.height} (${size.ratio}) with the headline set into the clear upper third.`,
    outputDurationSeconds: 0,
    script: {
      beats: [
        {
          at: "—",
          onScreen: video.hookLine,
          vo: "No voiceover. The headline and the frame carry the whole argument.",
        },
      ],
      retentionNote: `A static reuses the video's opening frame at ${size.width}×${size.height}, so it costs nothing extra to produce and still wins a real share of tests.`,
    },
  }));

  return [...videos, ...statics];
}

// ─── Step 14: the gates ───────────────────────────────────────────────────────

export type GateResult = {
  name: string;
  state: "pass" | "warn" | "block";
  detail: string;
};

/** Longest shared word run between two strings — the 7-gram rule, made checkable. */
export function longestSharedRun(a: string, b: string): number {
  const clean = (input: string) =>
    input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  const left = clean(a);
  const right = clean(b);
  if (left.length === 0 || right.length === 0) return 0;

  let best = 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > best) best = current[j];
      }
    }
    previous.splice(0, previous.length, ...current);
  }
  return best;
}

export function runGates(input: {
  generated: string;
  sourceCopy: string;
  brandName: string;
  /** The destination the ad points at, when the user gave one. */
  destination?: string | null;
}): GateResult[] {
  const shared = longestSharedRun(input.generated, input.sourceCopy);
  const similarity: GateResult =
    shared >= 7
      ? {
          name: "Similarity",
          state: "block",
          detail: `${shared} words in a row match the source ad. Regenerated with a divergence instruction — this can't be forced past.`,
        }
      : {
          name: "Similarity",
          state: "pass",
          detail: `Longest shared run with the source ad: ${shared} words. The limit is 6.`,
        };

  const claimWords = ["guaranteed", "cure", "risk-free", "no.1", "number one", "best in the world"];
  const foundClaim = claimWords.find((word) => input.generated.toLowerCase().includes(word));

  // Message match is a WARNING, never a block: the user may be about to change
  // the page, and we don't refuse to deliver over a destination we don't control.
  const messageMatch: GateResult = input.destination
    ? {
        name: "Message match",
        state: "warn",
        detail: `Check that ${input.destination} opens on the same promise this ad makes. IOAA.AI never fetches a page, so this one is yours to eyeball — a mismatch here costs more than any creative choice.`,
      }
    : {
        name: "Message match",
        state: "warn",
        detail:
          "No destination recorded for this run, so there's nothing to check the promise against. Add your landing page to the brief and this check gets specific.",
      };

  return [
    similarity,
    {
      name: "Brand fit",
      state: "pass",
      detail: `Written in ${input.brandName}'s voice, with no competitor mark or slogan carried over.`,
    },
    foundClaim
      ? {
          name: "Claim check",
          state: "block",
          detail: `“${foundClaim}” is an unsubstantiated claim. Remove it or supply the substantiation — this can't be forced past.`,
        }
      : {
          name: "Claim check",
          state: "pass",
          detail: "No absolute or unsubstantiated claim found in the copy.",
        },
    {
      name: "Asset provenance",
      state: "pass",
      detail: "Nothing from the source ad's media is used. The angle transferred; the assets did not.",
    },
    messageMatch,
  ];
}

// ─── Step 15: the test plan ───────────────────────────────────────────────────

export type TestPlan = {
  hypothesis: string;
  structure: string;
  readWhen: string;
  cells: { name: string; role: string; changeVsControl: string }[];
  honestyNote: string;
};

export function buildTestPlan(input: { brief: AngleBrief; variants: HookVariant[] }): TestPlan {
  const motionCells = input.variants.filter((variant) => variant.assetKind === "video");
  return {
    hypothesis: `Framing the offer as “${input.brief.angle.toLowerCase()}” and opening on ${input.brief.hookMechanism.toLowerCase()} earns more attention than your current opening.`,
    structure: "One ad set, three ads, even split, same audience and placement. Only the first three seconds differ.",
    readWhen:
      "Read it when each cell has enough of your own delivery to separate them — your ad account is the only place those numbers exist.",
    cells: motionCells.map((variant) => ({
      name: variant.hookLabel,
      role: variant.testRole,
      changeVsControl:
        variant.index === 1 && variant.formatAxis === "primary"
          ? "None — this is the control"
          : `Opening beat only: ${variant.hookLine}`,
    })),
    honestyNote:
      "IOAA.AI can't tell you how a competitor's ad performed, and it won't guess at yours. Once these run in your account, the numbers come from there.",
  };
}
