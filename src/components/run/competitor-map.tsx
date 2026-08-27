"use client";

/**
 * S2 — the competitor map, now DISCOVERED rather than derived.
 *
 * Every row here came back from a real sweep of the public Ad Library: the
 * advertiser was seen running ads in this country under a word the brand's own
 * site uses. That makes the "why" a piece of evidence rather than a rationale,
 * and the confidence bar a measure of how broadly they own the category words.
 *
 * Editing stays, and stays first-class. A discovered advertiser can still be the
 * wrong read of a market, and a user who cannot correct the map has to accept a
 * board built on it.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addCompetitor, renameCompetitor, toggleCompetitor } from "@/app/actions/runs";
import { autoCollect } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plate } from "@/components/rack/plate";
import type { CompetitorRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<string, string> = {
  DIRECT: "Direct",
  ADJACENT: "Adjacent",
  ATTENTION: "Attention",
};

export function CompetitorMap({
  runId,
  competitors,
  hasEvidence,
}: {
  runId: string;
  competitors: CompetitorRow[];
  hasEvidence: boolean;
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
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-muted-foreground">
        Nobody has been found yet. As soon as the Ad Library searches come back, whoever is actually
        running ads in your market appears here — with the category word that found them.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-[68ch]">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Everyone here was found running live ads in your market — not guessed from your category.
          The note under each name is the search that found them. Drop anyone who isn&rsquo;t really a
          competitor and add anyone we missed.
        </p>
      </div>

      {tiers.map((tier) => {
        const rows = competitors.filter((row) => row.tier === tier);
        if (rows.length === 0) return null;
        return (
          <div key={tier}>
            <Plate className="block">{TIER_LABEL[tier]}</Plate>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "min-w-0 rounded-sm border bg-card/50 p-3 transition-opacity duration-200 ease-out",
                    row.pruned ? "border-border/60 opacity-45" : "border-border",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
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
                      className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-[13.5px] hover:border-border focus-visible:border-ring"
                    />
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
                  <p className="mt-1.5 px-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    {row.whyUseful}
                  </p>
                  <div className="mt-2.5 flex min-w-0 items-center gap-2 px-1.5">
                    <span className="plate shrink-0 text-rack-engrave">Evidence</span>
                    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-rack-rail">
                      <div
                        className="h-full bg-rack-engrave"
                        style={{ width: `${Number(row.confidence)}%` }}
                      />
                    </div>
                    <span className="tabular w-8 shrink-0 text-right text-[11px] text-muted-foreground">
                      {row.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-5">
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
                  if (!result.ok) toast.error(result.error);
                  else setNewName("");
                  router.refresh();
                })
              }
            >
              <Plus size={14} strokeWidth={1.8} />
              Add
            </Button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Added by hand? Sweep again to pull their ads in too.
          </p>
        </div>
      </div>

      {hasEvidence ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button
            variant="outline"
            disabled={pending || kept.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await autoCollect(runId);
                if (!result.ok) toast.error(result.error);
                else toast.success("Swept the updated list — the board is refreshed.");
                router.refresh();
              })
            }
          >
            <RefreshCw size={14} strokeWidth={1.7} />
            {pending ? "Sweeping…" : "Sweep this list again"}
          </Button>
          <p className="min-w-0 text-xs text-muted-foreground">
            {kept.length} advertiser{kept.length === 1 ? "" : "s"} kept. Only ads not already on your
            board get added.
          </p>
        </div>
      ) : null}
    </div>
  );
}
