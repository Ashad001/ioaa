/**
 * Comparing two captures.
 *
 * The rule that governs every word on this screen: an ad missing from the newer
 * capture has NOT been "killed" or "stopped". It was not observed in the latest
 * submitted snapshot — which might mean it ended, or might mean the user scrolled
 * less far that day. Only after THREE comparable snapshots miss it does IOAA.AI
 * say "likely no longer active", and it states that rule inline wherever the
 * status appears.
 */
import type { BatchRow, EvidenceRow } from "./queries";

export type Comparability = {
  comparable: boolean;
  differences: string[];
  sameSearches: boolean;
};

export type DiffBucket = {
  id: "new" | "absent" | "copy" | "creative" | "repeated";
  label: string;
  note: string;
  items: { key: string; advertiser: string; headline: string; extra?: string }[];
};

function fingerprint(item: EvidenceRow) {
  return item.libraryUrl
    ? `url:${item.libraryUrl.trim().toLowerCase()}`
    : `copy:${item.advertiser.trim().toLowerCase()}|${item.headline.trim().toLowerCase()}`;
}

export function assessComparability(input: {
  older: BatchRow;
  newer: BatchRow;
  olderItems: EvidenceRow[];
  newerItems: EvidenceRow[];
}): Comparability {
  const differences: string[] = [];

  const searchesOf = (items: EvidenceRow[]) =>
    new Set(items.map((item) => item.searchReferenceId).filter(Boolean) as string[]);
  const olderSearches = searchesOf(input.olderItems);
  const newerSearches = searchesOf(input.newerItems);
  const sameSearches =
    olderSearches.size > 0 &&
    newerSearches.size > 0 &&
    [...olderSearches].every((id) => newerSearches.has(id)) &&
    [...newerSearches].every((id) => olderSearches.has(id));

  if (!sameSearches) {
    differences.push("These captures were made against different saved searches.");
  }

  const marketsOf = (items: EvidenceRow[]) => new Set(items.map((item) => item.market).filter(Boolean));
  const olderMarkets = [...marketsOf(input.olderItems)].sort().join("|");
  const newerMarkets = [...marketsOf(input.newerItems)].sort().join("|");
  if (olderMarkets && newerMarkets && olderMarkets !== newerMarkets) {
    differences.push("The markets covered aren't the same.");
  }

  if (input.olderItems.length > 0 && input.newerItems.length > 0) {
    const ratio =
      Math.min(input.olderItems.length, input.newerItems.length) /
      Math.max(input.olderItems.length, input.newerItems.length);
    if (ratio < 0.6) {
      differences.push(
        `One capture has far more items than the other (${input.olderItems.length} vs ${input.newerItems.length}), so absence means less.`,
      );
    }
  }

  return { comparable: differences.length === 0, differences, sameSearches };
}

export function buildDiff(input: {
  olderItems: EvidenceRow[];
  newerItems: EvidenceRow[];
  comparable: boolean;
}): DiffBucket[] {
  const olderMap = new Map(input.olderItems.map((item) => [fingerprint(item), item]));
  const newerMap = new Map(input.newerItems.map((item) => [fingerprint(item), item]));

  const newly = [...newerMap.entries()].filter(([key]) => !olderMap.has(key));
  const absent = [...olderMap.entries()].filter(([key]) => !newerMap.has(key));

  const changedCopy: DiffBucket["items"] = [];
  const changedCreative: DiffBucket["items"] = [];
  for (const [key, newItem] of newerMap) {
    const oldItem = olderMap.get(key);
    if (!oldItem) continue;
    if (oldItem.bodyCopy.trim() !== newItem.bodyCopy.trim()) {
      changedCopy.push({
        key,
        advertiser: newItem.advertiser || "Advertiser not captured",
        headline: newItem.headline || "—",
        extra: `Was: ${oldItem.bodyCopy.slice(0, 90) || "(no copy captured)"}`,
      });
    }
    if (
      oldItem.artefactUrl &&
      newItem.artefactUrl &&
      oldItem.artefactUrl !== newItem.artefactUrl
    ) {
      changedCreative.push({
        key,
        advertiser: newItem.advertiser || "Advertiser not captured",
        headline: newItem.headline || "—",
        extra: "Same ad, a different creative was submitted.",
      });
    }
  }

  const conceptCount = (items: EvidenceRow[]) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.conceptKey) continue;
      counts.set(item.conceptKey, (counts.get(item.conceptKey) ?? 0) + 1);
    }
    return counts;
  };
  const olderConcepts = conceptCount(input.olderItems);
  const newerConcepts = conceptCount(input.newerItems);
  const grown: DiffBucket["items"] = [];
  for (const [key, count] of newerConcepts) {
    const before = olderConcepts.get(key) ?? 0;
    if (count > before) {
      const sample = input.newerItems.find((item) => item.conceptKey === key);
      grown.push({
        key,
        advertiser: sample?.conceptLabel || key,
        headline: `${before} → ${count} submitted variants`,
      });
    }
  }

  const indicative = input.comparable ? "" : " Indicative only — these captures aren't directly comparable.";

  return [
    {
      id: "new",
      label: "Newly observed",
      note: `Present in the newer capture, absent from the older one.${indicative}`,
      items: newly.map(([key, item]) => ({
        key,
        advertiser: item.advertiser || "Advertiser not captured",
        headline: item.headline || "—",
      })),
    },
    {
      id: "absent",
      label: "Not observed in the latest submitted snapshot",
      note: `Present in the older capture, absent from the newer one. That is not the same as stopped — you may simply not have captured it this time.${indicative}`,
      items: absent.map(([key, item]) => ({
        key,
        advertiser: item.advertiser || "Advertiser not captured",
        headline: item.headline || "—",
      })),
    },
    {
      id: "copy",
      label: "Changed copy",
      note: `Same ad, different text.${indicative}`,
      items: changedCopy,
    },
    {
      id: "creative",
      label: "Changed creative",
      note: `Same ad, a different asset was submitted.${indicative}`,
      items: changedCreative,
    },
    {
      id: "repeated",
      label: "Newly repeated concepts",
      note: `Angles whose submitted variant count grew.${indicative}`,
      items: grown,
    },
  ];
}

export const THREE_SNAPSHOT_RULE =
  "An ad is only marked likely no longer active after three comparable snapshots miss it.";
