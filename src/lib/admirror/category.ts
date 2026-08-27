import "server-only";

/**
 * WHAT FIELD IS THIS COMPANY IN?
 *
 * The old flow took the words a homepage happened to repeat and fired them at
 * the ad reader as searches. That is not a category — it is vocabulary. Two
 * companies in the same business describe themselves in completely different
 * words, so keyword-only discovery found whoever used the same phrasing rather
 * than whoever was in the same market.
 *
 * So the site read is first CLASSIFIED into a field and a category. A category
 * carries its own market vocabulary (the words the whole field uses, not just
 * this one company), plus its NEIGHBOURS — the adjacent categories worth
 * sweeping because they fight for the same buyer and the same feed.
 *
 * This is deterministic, offline and inspectable. It is a READING of the
 * company, labelled as one everywhere it surfaces, and the user can override the
 * category on the profile screen.
 */

export type CategoryId =
  | "ai-creative"
  | "ai-assistant"
  | "saas-tools"
  | "ecommerce-fashion"
  | "beauty-care"
  | "health-fitness"
  | "food-drink"
  | "finance-money"
  | "education-courses"
  | "travel-hospitality"
  | "home-interior"
  | "property"
  | "auto"
  | "gaming"
  | "agency-services"
  | "general";

export type CategoryDef = {
  id: CategoryId;
  /** The broad field, as a person would say it. */
  field: string;
  /** The specific category inside that field. */
  label: string;
  /** Words that IDENTIFY this category in a site's own copy. */
  signals: string[];
  /** Search terms the whole category advertises under. */
  marketTerms: string[];
  /** Categories that fight for the same buyer or the same feed. */
  neighbours: CategoryId[];
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "ai-creative",
    field: "AI software",
    label: "AI image & video generation",
    signals: [
      "ai image", "ai video", "image generator", "video generator", "text to image",
      "text to video", "generative", "diffusion", "avatar", "ai art", "ai photo",
      "upscale", "render", "creative studio", "ai model", "prompt",
    ],
    marketTerms: ["ai image generator", "ai video generator", "ai art", "text to video"],
    neighbours: ["ai-assistant", "saas-tools", "agency-services"],
  },
  {
    id: "ai-assistant",
    field: "AI software",
    label: "AI assistants & copilots",
    signals: [
      "ai assistant", "chatbot", "copilot", "ai agent", "automate", "workflow",
      "gpt", "llm", "ai writing", "summarise", "summarize", "transcribe", "meeting notes",
    ],
    marketTerms: ["ai assistant", "ai writing tool", "ai agent", "ai automation"],
    neighbours: ["ai-creative", "saas-tools", "education-courses"],
  },
  {
    id: "saas-tools",
    field: "Software",
    label: "Business software & tools",
    signals: [
      "dashboard", "analytics", "crm", "integration", "api", "platform", "workspace",
      "team", "collaboration", "project management", "invoicing", "scheduling", "saas",
      "subscription plan", "seats",
    ],
    marketTerms: ["software for teams", "business dashboard", "crm software", "project management"],
    neighbours: ["ai-assistant", "agency-services", "finance-money"],
  },
  {
    id: "ecommerce-fashion",
    field: "Retail",
    label: "Fashion & apparel",
    signals: [
      "clothing", "apparel", "dress", "shirt", "jeans", "shoes", "sneakers", "abaya",
      "kaftan", "outfit", "wardrobe", "jewellery", "jewelry", "handbag", "watch",
      "fabric", "linen", "cotton", "fit", "sizing",
    ],
    marketTerms: ["clothing brand", "fashion online", "shoes online", "jewellery"],
    neighbours: ["beauty-care", "home-interior", "general"],
  },
  {
    id: "beauty-care",
    field: "Retail",
    label: "Beauty & personal care",
    signals: [
      "skincare", "serum", "moisturiser", "moisturizer", "perfume", "fragrance", "oud",
      "makeup", "cosmetics", "haircare", "shampoo", "spf", "cleanser", "salon", "clinic",
    ],
    marketTerms: ["skincare", "perfume", "makeup", "haircare"],
    neighbours: ["ecommerce-fashion", "health-fitness", "general"],
  },
  {
    id: "health-fitness",
    field: "Health",
    label: "Health, fitness & supplements",
    signals: [
      "supplement", "protein", "vitamin", "workout", "gym", "training", "coach",
      "nutrition", "weight loss", "wellness", "physio", "therapy", "dental", "clinic",
      "telehealth",
    ],
    marketTerms: ["supplements", "fitness coaching", "gym membership", "weight loss"],
    neighbours: ["beauty-care", "food-drink", "education-courses"],
  },
  {
    id: "food-drink",
    field: "Food",
    label: "Food, drink & delivery",
    signals: [
      "restaurant", "menu", "delivery", "takeaway", "coffee", "roastery", "bakery",
      "meal", "recipe", "grocery", "catering", "chocolate", "dessert", "kitchen",
    ],
    marketTerms: ["food delivery", "restaurant", "coffee beans", "meal plan"],
    neighbours: ["health-fitness", "travel-hospitality", "general"],
  },
  {
    id: "finance-money",
    field: "Finance",
    label: "Finance, payments & insurance",
    signals: [
      "payments", "invoice", "banking", "wallet", "loan", "mortgage", "credit",
      "insurance", "investment", "trading", "crypto", "tax", "accounting", "payroll",
    ],
    marketTerms: ["business banking", "payments platform", "insurance", "investing app"],
    neighbours: ["saas-tools", "property", "education-courses"],
  },
  {
    id: "education-courses",
    field: "Education",
    label: "Courses, coaching & training",
    signals: [
      "course", "curriculum", "lesson", "tutor", "bootcamp", "certification", "academy",
      "learn", "masterclass", "coaching program", "cohort", "students", "syllabus",
    ],
    marketTerms: ["online course", "coaching program", "bootcamp", "certification"],
    neighbours: ["ai-assistant", "health-fitness", "agency-services"],
  },
  {
    id: "travel-hospitality",
    field: "Travel",
    label: "Travel & hospitality",
    signals: [
      "hotel", "resort", "booking", "flights", "holiday", "villa", "tour", "safari",
      "itinerary", "stay", "check in", "destination", "cruise", "visa",
    ],
    marketTerms: ["hotel booking", "holiday packages", "flights", "tours"],
    neighbours: ["food-drink", "property", "general"],
  },
  {
    id: "home-interior",
    field: "Retail",
    label: "Home, furniture & interiors",
    signals: [
      "furniture", "sofa", "mattress", "interior", "decor", "lighting", "kitchen fitting",
      "bedding", "rug", "curtain", "joinery", "renovation", "appliance",
    ],
    marketTerms: ["furniture", "home decor", "mattress", "interior design"],
    neighbours: ["ecommerce-fashion", "property", "general"],
  },
  {
    id: "property",
    field: "Property",
    label: "Real estate & property",
    signals: [
      "property", "real estate", "apartment", "villa for sale", "off plan", "listing",
      "rent", "landlord", "mortgage broker", "developer", "square feet", "bedroom",
    ],
    marketTerms: ["property for sale", "apartments for rent", "real estate agent", "off plan"],
    neighbours: ["home-interior", "finance-money", "travel-hospitality"],
  },
  {
    id: "auto",
    field: "Automotive",
    label: "Cars & mobility",
    signals: [
      "car", "vehicle", "suv", "dealership", "test drive", "lease", "ev", "electric car",
      "mileage", "service centre", "spare parts", "rental car", "bike",
    ],
    marketTerms: ["car dealership", "car rental", "electric car", "car service"],
    neighbours: ["finance-money", "travel-hospitality", "general"],
  },
  {
    id: "gaming",
    field: "Entertainment",
    label: "Games & entertainment apps",
    signals: [
      "game", "gameplay", "player", "level", "puzzle", "rpg", "download the app",
      "app store", "google play", "streaming", "episodes", "characters",
    ],
    marketTerms: ["mobile game", "game download", "streaming app", "puzzle game"],
    neighbours: ["ai-creative", "education-courses", "general"],
  },
  {
    id: "agency-services",
    field: "Services",
    label: "Agencies & professional services",
    signals: [
      "agency", "consulting", "consultancy", "our clients", "case study", "retainer",
      "marketing services", "seo", "law firm", "legal", "recruitment", "studio services",
      "book a call", "audit",
    ],
    marketTerms: ["marketing agency", "consulting services", "book a consultation", "case study"],
    neighbours: ["saas-tools", "education-courses", "finance-money"],
  },
  {
    id: "general",
    field: "General",
    label: "General consumer brand",
    signals: [],
    marketTerms: [],
    neighbours: [],
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((entry) => [entry.id, entry]));

export type CategoryMatch = {
  category: CategoryDef;
  /** 0–100 — how strongly the site's own words point at this category. */
  score: number;
  /** The site words that matched, so the read is inspectable. */
  matched: string[];
};

export type CategoryReading = {
  primary: CategoryMatch;
  /** Neighbouring categories worth sweeping, closest first. */
  neighbours: CategoryDef[];
  /** Plain-words note: how the field was decided, and how sure it is. */
  note: string;
  /** True when nothing matched and we fell back to the general bucket. */
  uncertain: boolean;
};

/**
 * Classify a site read into a field and category.
 *
 * The scoring is deliberately simple: count how many of a category's signal
 * phrases appear in the site's own copy, weight the title and headings above
 * body text because they say what the company IS rather than what a page
 * happens to mention.
 */
export function classify(input: {
  title: string;
  description: string;
  headings: string[];
  categoryTerms: string[];
}): CategoryReading {
  const strong = [input.title, input.description, ...input.headings]
    .join(" ")
    .toLowerCase();
  const terms = input.categoryTerms.join(" ").toLowerCase();
  const haystack = `${strong} ${terms}`;

  const scored: CategoryMatch[] = CATEGORIES.filter((entry) => entry.id !== "general")
    .map((category) => {
      const matched: string[] = [];
      let points = 0;
      for (const signal of category.signals) {
        if (!haystack.includes(signal)) continue;
        matched.push(signal);
        points += strong.includes(signal) ? 3 : 1;
      }
      return {
        category,
        score: Math.min(100, points * 9),
        matched: matched.slice(0, 6),
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.category.label.localeCompare(b.category.label));

  const best = scored[0];

  if (!best) {
    const general = CATEGORY_BY_ID.get("general")!;
    return {
      primary: { category: general, score: 0, matched: [] },
      neighbours: [],
      note: "Your site's words didn't match a category we know, so pick the closest field yourself and the rival search follows it.",
      uncertain: true,
    };
  }

  const runnerUp = scored[1];
  const neighbourIds = new Set<CategoryId>(best.category.neighbours);
  if (runnerUp && runnerUp.score >= best.score * 0.5) neighbourIds.add(runnerUp.category.id);

  const neighbours = [...neighbourIds]
    .map((id) => CATEGORY_BY_ID.get(id))
    .filter((entry): entry is CategoryDef => Boolean(entry) && entry!.id !== best.category.id)
    .slice(0, 3);

  return {
    primary: best,
    neighbours,
    note: `Read as ${best.category.field} · ${best.category.label} from your own words (${best.matched.slice(0, 3).join(", ")}). Change it if that's wrong.`,
    uncertain: best.score < 25,
  };
}

/**
 * The terms to sweep for rivals: the CATEGORY's own market vocabulary first,
 * then each neighbour's, then the company's own words as a backstop.
 *
 * Category terms lead because they are what a whole field advertises under. A
 * company's own phrasing is last: it finds the companies that copy this brand's
 * wording, which is a much narrower question than who is in the same market.
 */
export function sweepTerms(reading: CategoryReading, ownTerms: string[]): string[] {
  const out: string[] = [];
  const push = (term: string) => {
    const clean = term.trim().toLowerCase();
    if (!clean || out.includes(clean)) return;
    out.push(clean);
  };

  for (const term of reading.primary.category.marketTerms) push(term);
  for (const neighbour of reading.neighbours) {
    for (const term of neighbour.marketTerms.slice(0, 2)) push(term);
  }
  for (const term of ownTerms.slice(0, 3)) push(term);

  return out.slice(0, 8);
}
