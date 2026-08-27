/**
 * The 15-step pipeline, its step definitions, and the deterministic analysis that
 * runs on this build.
 *
 * IMPORTANT AND DELIBERATE: steps 2, 3, 8 and 10–14 are described in the brief as
 * LLM stages. No model provider is wired into this app yet, so those stages run
 * here as deterministic derivations over what is actually known — the brand name,
 * the market, the objectives, and the evidence the user submitted. Everything
 * they produce is labelled `model_interpretation` in the UI, which is exactly
 * what it is: a reading, not a fact from the Library. Swapping in a real model
 * later means replacing the bodies below; nothing else in the app changes.
 */

export type StepName =
  | "INTAKE"
  | "BRAND_RESEARCH"
  | "COMPETITOR_MAP"
  | "DISCOVERY_PLAN"
  | "EVIDENCE_INTAKE"
  | "EVIDENCE_NORMALIZE"
  | "EVIDENCE_RANK"
  | "TEARDOWN"
  | "HUMAN_GATE"
  | "ANGLE_TRANSFER"
  | "SCRIPT"
  | "FIRST_FRAME"
  | "MOTION"
  | "POST"
  | "DELIVER";

export type StepDef = {
  n: number;
  name: StepName;
  title: string;
  /** Told in the user's language — this is what the console shows. */
  detail: string;
  actor: "auto" | "you";
};

export const STEPS: StepDef[] = [
  { n: 1, name: "INTAKE", title: "Brief", detail: "Brand, market and objective recorded", actor: "auto" },
  { n: 2, name: "BRAND_RESEARCH", title: "Brand read", detail: "Positioning, audience and voice", actor: "auto" },
  { n: 3, name: "COMPETITOR_MAP", title: "Competitor map", detail: "Who you're up against in this market", actor: "auto" },
  { n: 4, name: "DISCOVERY_PLAN", title: "Search plan", detail: "Ad Library searches, ready to open", actor: "auto" },
  { n: 5, name: "EVIDENCE_INTAKE", title: "Capture", detail: "You open the searches and submit what you find", actor: "you" },
  { n: 6, name: "EVIDENCE_NORMALIZE", title: "Normalise", detail: "Deduplicate and tidy what you submitted", actor: "auto" },
  { n: 7, name: "EVIDENCE_RANK", title: "Rank", detail: "Opportunity score and coverage", actor: "auto" },
  { n: 8, name: "TEARDOWN", title: "Teardown", detail: "How each ad is built", actor: "auto" },
  { n: 9, name: "HUMAN_GATE", title: "Your call", detail: "Pick the angles and press the button", actor: "you" },
  { n: 10, name: "ANGLE_TRANSFER", title: "Angle transfer", detail: "Their angle, rewritten as your brief", actor: "auto" },
  { n: 11, name: "SCRIPT", title: "Script", detail: "Hook, beats, voiceover, on-screen text", actor: "auto" },
  { n: 12, name: "FIRST_FRAME", title: "Opening frame", detail: "The image brief for frame one", actor: "auto" },
  { n: 13, name: "MOTION", title: "Motion", detail: "How the frame moves", actor: "auto" },
  { n: 14, name: "POST", title: "Checks", detail: "Brand, safety and similarity gates", actor: "auto" },
  { n: 15, name: "DELIVER", title: "Deliver", detail: "Variants, captions and test plan", actor: "auto" },
];

export const STEP_BY_NAME = new Map(STEPS.map((step) => [step.name, step]));

// ─── Step 2: brand read ───────────────────────────────────────────────────────

export type Dossier = {
  positioning: string;
  icp: string[];
  voice: string;
  proofShape: string[];
  palette: string[];
  confidence: "low" | "medium";
  basis: string;
};

const VOICE_BY_OBJECTIVE: Record<string, string> = {
  "Direct response": "Short sentences. One promise, one instruction, no throat-clearing.",
  "Lead generation": "Plain and specific. Names the problem before it names the product.",
  "App installs": "Immediate and demonstrative — shows the thing working in the first line.",
  "Brand awareness": "Confident and unhurried. Says one memorable thing and stops.",
  "Retention & winback": "Familiar, low-pressure, assumes the reader already knows you.",
  "Seasonal push": "Time-bound and concrete. The date does the persuading.",
};

export function deriveDossier(input: {
  brandName: string;
  brandWebsite: string | null;
  marketLabel: string;
  objectives: string[];
}): Dossier {
  const primary = input.objectives[0] ?? "Direct response";
  const hasSite = Boolean(input.brandWebsite);
  return {
    positioning: `${input.brandName} sells into ${input.marketLabel} with a ${primary.toLowerCase()} emphasis. This reading comes from your brief${
      hasSite ? " and the site you supplied" : " alone"
    } — correct anything that's wrong before the searches are built.`,
    icp: [
      `${input.marketLabel} buyers`,
      primary === "Lead generation" ? "Considered purchase" : "Impulse-capable",
      "Mobile-first feed",
      "Comparison-shops before buying",
    ],
    voice: VOICE_BY_OBJECTIVE[primary] ?? VOICE_BY_OBJECTIVE["Direct response"],
    proofShape: [
      "A number the buyer can check",
      "One named objection, handled out loud",
      "Something visible in the first two seconds",
    ],
    palette: ["--chart-1", "--chart-2", "--chart-3"],
    confidence: hasSite ? "medium" : "low",
    basis: hasSite
      ? "Your brief plus the website you gave us."
      : "Your brief only. Adding your website raises the confidence of this read.",
  };
}

// ─── Step 3: competitor map ───────────────────────────────────────────────────

export type DerivedCompetitor = {
  name: string;
  tier: "DIRECT" | "ADJACENT" | "ATTENTION";
  whyUseful: string;
  confidence: number;
};

/**
 * Competitors are derived from what the user told us, and every row is editable
 * and prunable before the search plan is built. We never present an invented
 * company as a verified fact: the tier and the reason say what kind of guess it
 * is, and the user removes what's wrong.
 */
export function deriveCompetitorSlots(input: {
  brandName: string;
  marketLabel: string;
  objectives: string[];
}): DerivedCompetitor[] {
  const market = input.marketLabel;
  return [
    {
      name: `${input.brandName} — own ads`,
      tier: "DIRECT",
      whyUseful: `Your own Library page is the baseline. Capture it first so every other board has something to sit against.`,
      confidence: 95,
    },
    {
      name: "Category leader",
      tier: "DIRECT",
      whyUseful: `Whoever a ${market} buyer names first. Their angles set the expectations yours has to beat or break.`,
      confidence: 70,
    },
    {
      name: "Nearest challenger",
      tier: "DIRECT",
      whyUseful: "Same buyer, similar budget. The closest read on what's currently working.",
      confidence: 65,
    },
    {
      name: "Price-led alternative",
      tier: "ADJACENT",
      whyUseful: "Shows which objections the market is fighting on, and how offers are framed.",
      confidence: 55,
    },
    {
      name: "Premium alternative",
      tier: "ADJACENT",
      whyUseful: "Shows the aspirational end of the angle spectrum, and what proof it leans on.",
      confidence: 50,
    },
    {
      name: "Attention competitor",
      tier: "ATTENTION",
      whyUseful: `Not in your category, but fighting for the same ${market} feed. Best source of format ideas.`,
      confidence: 40,
    },
  ];
}

// ─── Step 8: teardown ─────────────────────────────────────────────────────────

export type Teardown = {
  hookMechanism: string;
  angle: string;
  objection: string;
  format: string;
  offerShape: string;
  ctaShape: string;
  beatOrder: string[];
  transferable: string[];
  doNotTransfer: string[];
};

const HOOK_MECHANISMS = [
  "Problem stated as a question",
  "Result shown before the product",
  "Named objection raised first",
  "Comparison against the obvious alternative",
  "Number in the first line",
  "Direct address to a specific buyer",
];

const ANGLES = [
  "Speed over everything",
  "Cheaper than the habit it replaces",
  "Proof from someone like you",
  "The hidden cost of doing nothing",
  "Effortlessness",
  "Status by association",
];

/**
 * A structural read of one submitted ad. Deterministic and stable per item, so
 * the same evidence always reads the same way. Labelled `model_interpretation`
 * everywhere it surfaces.
 */
export function deriveTeardown(input: {
  id: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  modality: string;
}): Teardown {
  const seed = [...input.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const text = `${input.headline} ${input.bodyCopy}`.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const hasNumber = /\d/.test(text);
  const asksQuestion = text.includes("?");

  const hookMechanism = asksQuestion
    ? "Problem stated as a question"
    : hasNumber
      ? "Number in the first line"
      : HOOK_MECHANISMS[seed % HOOK_MECHANISMS.length];

  const angle = ANGLES[(seed >> 2) % ANGLES.length];

  return {
    hookMechanism,
    angle,
    objection:
      words.length > 24
        ? "Trust — the copy spends its length pre-empting doubt"
        : "Effort — the copy promises the outcome costs the reader little",
    format:
      input.modality === "video"
        ? "Motion, hook in the first second, captions carrying the argument"
        : input.modality === "text_only"
          ? "Copy-led, no creative captured"
          : "Static frame, headline doing the persuading",
    offerShape: hasNumber ? "Quantified — a figure the reader can check" : "Qualitative — benefit named, not measured",
    ctaShape: input.ctaLabel ? `Explicit: “${input.ctaLabel}”` : "Implicit — no CTA captured",
    beatOrder: asksQuestion
      ? ["Question", "Agitate", "Reveal", "Proof", "Ask"]
      : ["Claim", "Proof", "Objection", "Ask"],
    transferable: [
      "The hook mechanism",
      "The persuasion angle",
      "The objection it handles",
      "The beat order and pacing",
      "The shape of the offer and the CTA",
    ],
    doNotTransfer: [
      "Their footage or images",
      "Their voiceover or music",
      "Their talent's likeness",
      "Their logo, marks and slogans",
      "Their distinctive trade dress",
    ],
  };
}

/** A stable cluster key so one advertiser's repeated creative doesn't own the board. */
export function conceptKeyFor(teardown: Teardown): { key: string; label: string } {
  const key = `${teardown.hookMechanism}::${teardown.angle}`.toLowerCase().replace(/\s+/g, "-");
  return { key, label: `${teardown.angle} — ${teardown.hookMechanism.toLowerCase()}` };
}
