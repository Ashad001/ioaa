import "server-only";

/**
 * THE COMPANY PROFILE — built BEFORE anything is looked up.
 *
 * WHY THIS EXISTS. Collection used to begin the moment a run was created: the
 * site was read, category words were derived, and those words were immediately
 * fired at the ad reader as searches. Two things went wrong with that order.
 * The user never saw what the app believed their company WAS, so a thin or
 * mis-read homepage silently became a set of searches nobody agreed to; and the
 * rival list arrived as a by-product of those searches rather than as a decision
 * anyone made.
 *
 * So the profile is now its own stage and it is entirely OFFLINE. It reads the
 * company's own site, states what it thinks the company sells and to whom,
 * proposes the rivals it would study and the exact search terms it would use —
 * and then stops, because every line of it is the user's to correct. Nothing
 * here contacts the ad reader; that only happens after approval.
 */

import type { SiteRead } from "./discover";

export type ProfileRival = {
  name: string;
  /** DIRECT · ADJACENT · ATTENTION — how close they sit to this company. */
  tier: "DIRECT" | "ADJACENT" | "ATTENTION";
  /** Why studying them is useful, in the user's words. */
  whyUseful: string;
  /** Where this name came from — never presented as a verified fact. */
  source: "named_by_you" | "read_from_your_site" | "proposed_from_category";
  confidence: number;
};

export type CompanyProfile = {
  /** One sentence: what this company sells, and to whom. */
  summary: string;
  /** What the company appears to sell — short noun phrases. */
  sells: string[];
  /** Who it appears to sell to. */
  audience: string[];
  /** The words we would search the ad library under. */
  searchTerms: string[];
  /** Where the read came from, and how confident it is. */
  basis: string;
  confidence: "low" | "medium";
  /** True when the site could not be read at all — say so, never pretend. */
  siteUnreadable: boolean;
};

/** Title-case a company name the user typed in any casing. */
export function tidyName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/[A-Z]/.test(trimmed.slice(1))) return trimmed;
  return trimmed.replace(
    /(^|\s|-)([a-z])/g,
    (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
  );
}

const RIVAL_MENTION =
  /\b(?:vs\.?|versus|unlike|compared to|alternative to|better than|instead of)\s+([A-Z][A-Za-z0-9]{2,}(?:\s+[A-Z][A-Za-z0-9]{2,})?)/g;

/**
 * Company names the site itself mentions. A homepage that says "unlike Runway"
 * is naming a real player in its own market, which is a better source than a
 * category guess.
 */
export function rivalsNamedOnSite(site: SiteRead, ownBrand: string): string[] {
  const haystack = [site.title, site.description, ...site.headings].join(" ");
  const own = ownBrand.trim().toLowerCase();
  const found: string[] = [];

  for (const match of haystack.matchAll(RIVAL_MENTION)) {
    const name = tidyName(match[1] ?? "");
    const key = name.toLowerCase();
    if (!key || key === own) continue;
    if (found.some((existing) => existing.toLowerCase() === key)) continue;
    found.push(name);
  }

  return found.slice(0, 6);
}

/**
 * The profile, from the site read plus whatever the user typed. Deterministic
 * and offline — this is a READING of their company, and the UI labels it as one.
 */
export function buildProfile(input: {
  brandName: string;
  site: SiteRead | null;
  marketLabel: string;
  objectives: string[];
}): CompanyProfile {
  const site = input.site;
  const terms = (site?.categoryTerms ?? []).slice(0, 5);
  const objective = input.objectives[0] ?? "Direct response";
  const readable = Boolean(site?.ok) && terms.length > 0;

  const audience = [
    `${input.marketLabel} buyers`,
    objective === "Lead generation" ? "Considered purchase" : "Ready to act",
    "Mobile-first feed",
  ];

  const summary = readable
    ? `${input.brandName} appears to sell ${terms.slice(0, 3).join(", ")} into ${input.marketLabel}, with a ${objective.toLowerCase()} emphasis.`
    : `${input.brandName} sells into ${input.marketLabel} with a ${objective.toLowerCase()} emphasis. Your site couldn't be read for detail, so correct this before anything is collected.`;

  return {
    summary,
    sells: readable ? terms : ["Not read from your site yet — add what you sell"],
    audience,
    searchTerms: terms,
    basis: readable
      ? site?.note || "Read from your own website's words."
      : site?.note ||
        "Your website couldn't be read, so this is based on your brand and market only.",
    confidence: readable ? "medium" : "low",
    siteUnreadable: !readable,
  };
}

/**
 * The rivals we would study, ordered by how much they're worth studying.
 *
 * Names the SITE ITSELF mentions come first, because a company naming a
 * competitor on its own homepage is a fact about the market rather than a guess.
 * Category slots follow, and every one is clearly labelled as a proposal for the
 * user to replace with a real company name.
 */
export function proposeRivals(input: {
  brandName: string;
  marketLabel: string;
  namedByUser: string[];
  site: SiteRead | null;
}): ProfileRival[] {
  const rivals: ProfileRival[] = [];
  const seen = new Set<string>([input.brandName.trim().toLowerCase()]);

  const add = (rival: ProfileRival) => {
    const key = rival.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rivals.push(rival);
  };

  for (const name of input.namedByUser) {
    add({
      name: tidyName(name),
      tier: "DIRECT",
      whyUseful: "You named this company, so their ads are collected first.",
      source: "named_by_you",
      confidence: 100,
    });
  }

  if (input.site) {
    for (const name of rivalsNamedOnSite(input.site, input.brandName)) {
      add({
        name,
        tier: "DIRECT",
        whyUseful: "Your own site compares you to them, so they're already in your market.",
        source: "read_from_your_site",
        confidence: 80,
      });
    }
  }

  const category = (input.site?.categoryTerms ?? [])[0] ?? "your category";
  add({
    name: "Category leader",
    tier: "DIRECT",
    whyUseful: `Whoever a ${input.marketLabel} buyer names first in ${category}. Replace this with the real company.`,
    source: "proposed_from_category",
    confidence: 45,
  });
  add({
    name: "Nearest challenger",
    tier: "DIRECT",
    whyUseful:
      "Same buyer, similar budget — the closest read on what's working now. Replace with a real name.",
    source: "proposed_from_category",
    confidence: 40,
  });
  add({
    name: "Attention competitor",
    tier: "ATTENTION",
    whyUseful: `Not in ${category}, but fighting for the same feed. Best source of format ideas.`,
    source: "proposed_from_category",
    confidence: 30,
  });

  return rivals;
}
