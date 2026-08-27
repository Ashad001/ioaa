"use client";

/**
 * S2 — the competitor map, as a strip of film chips on the light box.
 *
 * Every row here came back from a real sweep of the public Ad Library: the
 * advertiser was seen running ads in this country under a word the brand's own
 * site uses, and it then passed the market test. That makes the "why" a piece of
 * evidence rather than a rationale.
 *
 * The SET ASIDE list is the visible proof of the filter. A filter the user cannot
 * inspect is indistinguishable from a bug, and "why isn't X here?" is the first
 * question anyone asks of a competitor map.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addCompetitor, renameCompetitor, toggleCompetitor } from "@/app/actions/runs";
import { autoCollect } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EdgeCode, Plate, Rebate } from "@/components/rack/plate";
import type { CompetitorRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<string, string> = {
  DIRECT: "Same shelf",
  ADJACENT: "Next shelf",
  ATTENTION: "Same attention",
};

export type SetAsideRow = { name: string; reason: string };

export function CompetitorMap({
  runId,
  competitors,
  hasEvidence,
  setAside = [],
  adsByAdvertiser = {},
}: {
  runId: string;
  competitors: CompetitorRow[];
  hasEvidence: boolean;
  setAside?: SetAsideRow[];
  adsByAdvertiser?: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const kept = competitors.filter((row) => !row.pruned);

  const commitName = (row: CompetitorRow) => {
    const value = (drafts[row.id] ?? row.name).trim();
    if (!value || value === row.name) return;
    startTransition(async () => {
      const result = await renameCompetitor({ runId, competitorId: row.id, name: value });
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  };

  const tiers: ("DIRECT" | "ADJACENT" | "ATTENTION")[] = ["DIRECT", "ADJACENT", "ATTENTION"];

  if (competitors.length === 0) {
    return (
      <p className="max-w-[65ch] text-[13.5px] leading-relaxed text-muted-foreground">
        Nobody has been found yet. As soon as the Ad Library searches come back, whoever is actually
        running ads in your market appears here — with the category word that found them.
      </p>
    );
  }

  const adCount = (name: string) => adsByAdvertiser[name.trim().toLowerCase()] ?? 0;

  return (
    <div className="space-y-6">
      <p className="max-w-[65ch] text-[13.5px] leading-relaxed text-muted-foreground">
        Everyone here was seen running live ads in your market under your own category words — not
        guessed from your industry. The line under each name is the evidence that put them here.
      </p>

      {tiers.map((tier) => {
        const rows = competitors.filter((row) => row.tier === tier);
        if (rows.length === 0) return null;
        return (
          <div key={tier}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Plate className="shrink-0">{TIER_LABEL[tier]}</Plate>
              <span className="h-px min-w-0 flex-1 bg-border/70" />
              <EdgeCode className="shrink-0">{rows.length}</EdgeCode>
            </div>

            <div className="mt-2.5 grid gap-2 xl:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex min-w-0 border border-border bg-film-base transition-opacity duration-200 ease-out",
                    row.pruned && "opacity-40",
                  )}
                >
                  <Rebate className="self-stretch" />
                  <div className="min-w-0 flex-1 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Input
                        value={drafts[row.id] ?? row.name}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [row.id]: event.target.value }))
                        }
                        onBlur={() => commitName(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitName(row);
                          }
                        }}
                        disabled={row.pruned}
                        aria-label={`Advertiser name: ${row.name}`}
                        className="h-8 min-w-0 flex-1 truncate border-transparent bg-transparent px-1.5 text-[13.5px] font-medium hover:border-border focus-visible:border-ring"
                      />
                      <EdgeCode className="shrink-0">
                        {adCount(row.name)} {adCount(row.name) === 1 ? "ad" : "ads"}
                      </EdgeCode>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={row.pruned ? `Bring back ${row.name}` : `Remove ${row.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await toggleCompetitor({
                              runId,
                              competitorId: row.id,
                              pruned: !row.pruned,
                            });
                            if (!result.ok) toast.error(result.error);
                            router.refresh();
                          })
                        }
                      >
                        {row.pruned ? (
                          <RotateCcw size={14} strokeWidth={1.6} />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.6} />
                        )}
                      </Button>
                    </div>

                    <p className="mt-1 px-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {row.whyUseful}
                    </p>

                    <div className="mt-2.5 flex min-w-0 items-center gap-2 px-1.5">
                      <Plate className="shrink-0">Evidence</Plate>
                      <div className="h-[3px] min-w-0 flex-1 overflow-hidden bg-rack-rail">
                        <div
                          className="h-full bg-film-edge"
                          style={{ width: `${Math.min(100, Number(row.confidence))}%` }}
                        />
                      </div>
                      <EdgeCode className="w-8 shrink-0 text-right">{row.confidence}</EdgeCode>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {setAside.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="group flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            <ChevronDown
              size={14}
              strokeWidth={1.7}
              className="shrink-0 transition-transform duration-200 ease-out group-data-[panel-open]:rotate-180"
            />
            <span className="min-w-0 truncate">
              {setAside.length} advertiser{setAside.length === 1 ? "" : "s"} set aside as
              out-of-market
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2.5 border-l-2 border-border/70 pl-3">
              <p className="max-w-[65ch] text-[11.5px] leading-relaxed text-muted-foreground">
                These names came back from the Ad Library but didn&rsquo;t sell what you sell, so
                they&rsquo;re not on your board. Add any of them by hand if you disagree.
              </p>
              <ul className="mt-2 space-y-1">
                {setAside.map((entry) => (
                  <li key={`${entry.name}-${entry.reason}`} className="min-w-0 text-[12px]">
                    <span className="text-foreground/80">{entry.name}</span>
                    <span className="text-muted-foreground"> — {entry.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-5">
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-72">
          <Plate as="div">Add someone we missed</Plate>
          <div className="flex min-w-0 gap-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Company name"
              className="min-w-0"
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={pending || !newName.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await addCompetitor({ runId, name: newName });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  const added = newName.trim();
                  setNewName("");
                  router.refresh();
                  // Collect for them straight away — a name with no ads behind it
                  // is not what the user asked for when they added a competitor.
                  toast.success(`Added ${added} — reading their ads now.`);
                  const swept = await autoCollect(runId);
                  if (!swept.ok) toast.error(swept.error);
                  router.refresh();
                })
              }
            >
              <Plus size={14} strokeWidth={1.8} />
              Add
            </Button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Their ads get read as soon as you add them.
          </p>
        </div>

        {hasEvidence ? (
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Button
              variant="outline"
              disabled={pending || kept.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await autoCollect(runId);
                  if (!result.ok) toast.error(result.error);
                  else toast.success("Read the updated list — your sheet is refreshed.");
                  router.refresh();
                })
              }
            >
              <RefreshCw size={14} strokeWidth={1.7} />
              {pending ? "Reading…" : "Read this list again"}
            </Button>
            <p className="min-w-0 text-[11.5px] text-muted-foreground">
              {kept.length} kept · only new ads get added
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
