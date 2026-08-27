/**
 * Provenance and the honesty rules, in one place.
 *
 * The whole product rests on a single claim being true: a number about a
 * competitor's ad is either something a human saw and entered, or something we
 * derived from what they submitted — and the interface always says which. That
 * claim is only as good as this module, so every fact rendered in the app is
 * typed as a Fact and carries its own provenance. There is no default.
 */

export const PROVENANCE_KINDS = [
  "observed_in_user_evidence",
  "swept_from_public_library",
  "user_asserted",
  "derived_from_evidence",
  "model_interpretation",
  "unknown",
] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export type Fact<T = string> = {
  value: T | null;
  provenance: ProvenanceKind;
  /** Where it came from: a saved search label, an uploaded artefact, the user. */
  source?: string;
  /** When the user saw it. Required to show any user-asserted figure. */
  capturedAt?: string;
  /** For derived facts: the formula and this ad's inputs. */
  derivation?: string;
};

export const PROVENANCE_META: Record<
  ProvenanceKind,
  { short: string; label: string; explain: string }
> = {
  observed_in_user_evidence: {
    short: "OBS",
    label: "Observed in your evidence",
    explain: "Your submitted artefact shows this.",
  },
  swept_from_public_library: {
    short: "LIB",
    label: "Read from the public Ad Library",
    explain:
      "AdMirror opened the public Ad Library search itself and read this off the page on the date shown. Nobody typed it — and no performance figure exists in it, because Meta does not publish one.",
  },
  user_asserted: {
    short: "YOU",
    label: "Entered by you",
    explain: "You typed this in. No submitted artefact confirms it.",
  },
  derived_from_evidence: {
    short: "DER",
    label: "Derived from your evidence",
    explain: "Computed by AdMirror from what you submitted.",
  },
  model_interpretation: {
    short: "READ",
    label: "Model reading",
    explain: "A model's interpretation of the evidence, not a fact from the Library.",
  },
  unknown: {
    short: "—",
    label: "Not captured",
    explain: "Nobody captured this, so AdMirror shows nothing rather than a zero.",
  },
};

export function fact<T>(
  value: T | null | undefined,
  provenance: ProvenanceKind,
  extra: Omit<Fact<T>, "value" | "provenance"> = {},
): Fact<T> {
  const empty = value === null || value === undefined || value === "";
  return {
    value: empty ? null : (value as T),
    provenance: empty ? "unknown" : provenance,
    ...extra,
  };
}

export function asProvenance(input: string | null | undefined): ProvenanceKind {
  return PROVENANCE_KINDS.includes(input as ProvenanceKind)
    ? (input as ProvenanceKind)
    : "unknown";
}

/**
 * Words that must never describe a commercial competitor ad. The public Ad
 * Library does not publish them, so writing one here would be inventing it.
 * Kept as data so the wording check can read the same list the UI does.
 */
export const FORBIDDEN_METRIC_WORDS = [
  "best performing",
  "top performing",
  "impressions",
  "spend",
  "roas",
  "ctr",
  "conversion rate",
  "scaling budget",
] as const;

/** The phrasings that ARE true about submitted evidence. */
export const ALLOWED_PHRASINGS = [
  "appeared first in the result order you captured",
  "running since {date}, as visible in your evidence",
  "repeated across {n} submitted variants",
  "highest opportunity score in this evidence set",
  "observed in consecutive snapshots",
] as const;

export const COVERAGE_STATEMENT =
  "This board reflects the ads you submitted, not a complete Meta inventory.";
