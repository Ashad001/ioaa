/**
 * The blocking honesty check (`10 §3.1`).
 *
 * The public Ad Library does not publish per-ad impressions, spend, CTR, ROAS or
 * conversions for ordinary commercial ads. So if one of those words appears in a
 * user-facing string about a competitor's ad, the interface is claiming to know
 * something it cannot know. This grep is cheap and it blocks.
 *
 * Run it with `npm run check:wording`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const FORBIDDEN = [
  "best performing",
  "top performing",
  "best-performing",
  "top-performing",
  "impressions",
  "roas",
  "ctr",
  "conversion rate",
  "scaling budget",
  "market's best",
  "killed",
  "stopped running",
];

/**
 * The two modules that DEFINE the rule are exempt: `provenance.ts` holds the
 * banned-word list itself, and `diff.ts` documents why "killed" is banned. A
 * check that flags its own rulebook flags nothing useful.
 */
const RULE_FILES = ["src/lib/admirror/provenance.ts", "src/lib/admirror/diff.ts"];

/** A line that is a comment is documentation, not a claim shown to anyone. */
function isComment(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

const ROOTS = ["src"];
const EXTENSIONS = [".tsx", ".ts"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.some((ext) => full.endsWith(ext))) out.push(full);
  }
  return out;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const normalised = file.split(sep).join("/");
    if (RULE_FILES.includes(normalised)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (isComment(line)) return;
      const lower = line.toLowerCase();
      for (const word of FORBIDDEN) {
        if (!lower.includes(word)) continue;
        // `ctr` and `roas` are substrings of ordinary identifiers, so require a
        // word boundary for the short ones.
        if (word.length <= 4 && !new RegExp(`\\b${word}\\b`).test(lower)) continue;
        findings.push(`${file}:${index + 1}  “${word}”  →  ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Forbidden metric wording found. These figures do not exist for commercial ads:\n");
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    `\n${findings.length} finding${findings.length === 1 ? "" : "s"}. Use the allowed phrasings in src/lib/admirror/provenance.ts.`,
  );
  process.exit(1);
}

console.log("Wording check passed: no forbidden metric claims in any user-facing string.");
