"use client";

/**
 * THE COMPETITOR PROFILES — one card per company, before a single ad is filed.
 *
 * A rival used to be a NAME and a sentence. That is indistinguishable from a
 * name we invented, so every card now carries the same interrogable facts: the
 * field and category their own ads read as, how they position themselves in
 * their own words, how they entered this list, how many live ads came back, and
 * — only where Meta published one — the reach band, verbatim.
 *
 * WHAT IS NOT HERE, AND NEVER WILL BE: spend, clicks, conversions or any rate.
 * Meta publishes none of those for commercial ads, so a figure would be invented.
 * A company whose ads carry no reach figure says exactly that, in words, rather
 * than showing a zero someone would read as failure.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Globe,
  Plus,
  Radar,
  RotateCcw,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import { addCompetitor, toggleCompetitor } from "@/app/actions/runs";
import { scanRivals } from "@/app/actions/profile";
import { EdgeCode, Lamp, Plate, Rebate } from "@/components/rack/plate";
import { FetchTicker } from "@/components/run/fetch-ticker";
import { ProvenanceBadge } from "@/components/rack/metric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type RivalCard = {
  id: string;
  name: string;
  tier: string;
  whyUseful: string;
  pruned: boolean;
  field: string;
  categoryLabel: string;
  categoryRelation: string;
  positioning: string;
  foundVia: string;
  foundUnder: string;
  adsSeen: number;
  displayLink: string;
  reachBand: string;
  profiled: boolean;
  /** True for the "Category leader" style prompts — not a company. */
  placeholder: boolean;
};

export type SweptTermView = {
  term: string;
  categoryLabel: string;
  relation: string;
  adsRead: number;
  state: string;
};

const RELATION_LABEL: Record<string, string> = {
  same_category: "Same category as you",
  neighbour_category: "Nearby category",
  named_by_you: "You named them",
  unknown: "Not looked up yet",
};

const FOUND_LABEL: Record<string, string> = {
  named_by_you: "You named them",
  your_site: "Named on your own site",
  category_sweep: "Found advertising in your category",
  neighbour_sweep: "Found in a nearby category",
};

const STATE_LAMP: Record<string, "live" | "cold" | "alert"> = {
  ok: "live",
  empty: "cold",
  no_key: "alert",
  failed: "alert",
  rate_limited: "alert",
};

export function RivalList({
  runId,
  rivals,
  setAside,
  terms,
  plannedTerms,
  scanNote,
  scannedAt,
  locked,
}: {
  runId: string;
  rivals: RivalCard[];
  setAside: Array<{ name: string; reason: string }>;
  terms: SweptTermView[];
  /** The EXACT searches the lookup will run, shown before it runs. */
  plannedTerms: string[];
  scanNote: string;
  scannedAt: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  const kept = rivals.filter((rival) => !rival.pruned);
  const dropped = rivals.filter((rival) => rival.pruned);

  const lookUp = (profileOnly: boolean) => {
    startTransition(async () => {
      const result = await scanRivals({ runId, profileOnly });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        profileOnly
          ? "Competitor profiles refreshed from their own live ads."
          : "Looked up who's advertising in your field.",
      );
      router.refresh();
    });
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await addCompetitor({ runId, name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewName("");
      toast.success(`${name} added — press Profile these companies to read them.`);
      router.refresh();
    });
  };

  const toggle = (rival: RivalCard) => {
    startTransition(async () => {
      const result = await toggleCompetitor({
        runId,
        competitorId: rival.id,
        pruned: !rival.pruned,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="min-w-0 space-y-4 px-4 py-4 sm:px-6">
      {/* ── THE LOOKUP ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-3 border-b border-border/70 pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!locked ? (
            <>
              <Button size="sm" onClick={() => lookUp(false)} disabled={pending}>
                <Radar size={14} strokeWidth={1.7} />
                <span className="min-w-0 truncate">
                  {scannedAt ? "Look up my field again" : "Find who advertises in my field"}
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => lookUp(true)}
                disabled={pending || kept.length === 0}
              >
                <UserRoundSearch size={14} strokeWidth={1.7} />
                <span className="min-w-0 truncate">Profile these companies</span>
              </Button>
            </>
          ) : null}
          {pending ? (
            <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
              <Lamp state="hold" pulsing />
              <span className="min-w-0 truncate">
                Reading live ads — about forty seconds per search
              </span>
            </span>
          ) : null}
        </div>

        <FetchTicker runId={runId} active={pending} className="pt-1" />

        {scanNote ? (
          <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
            {scanNote}
            {scannedAt
              ? ` Last looked up ${new Date(scannedAt).toLocaleDateString()}.`
              : ""}
          </p>
        ) : (
          <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
            Nothing has been looked up yet. The search runs on your field&rsquo;s own words plus the
            categories next to it — so it finds companies selling what you sell, not just companies
            writing like you.
          </p>
        )}

        {terms.length === 0 && plannedTerms.length > 0 ? (
          <div className="min-w-0">
            <Plate className="block">The searches this lookup will run</Plate>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {plannedTerms.map((term) => (
                <span
                  key={term}
                  className="min-w-0 max-w-full truncate border border-film-edge/35 bg-film-edge/[0.07] px-2 py-1 text-[12px] text-foreground/85"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {terms.length > 0 ? (
          <div className="min-w-0">
            <Plate className="block">Searched under</Plate>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {terms.map((term) => (
                <Tooltip key={`${term.term}-${term.categoryLabel}`}>
                  <TooltipTrigger
                    render={<span />}
                    className="flex min-w-0 max-w-full items-center gap-1.5 border border-border bg-secondary/40 px-2 py-1"
                  >
                    <Lamp state={STATE_LAMP[term.state] ?? "cold"} />
                    <span className="min-w-0 truncate text-[12px] text-foreground/85">
                      {term.term}
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                      {term.adsRead}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    <p className="font-medium">{term.categoryLabel}</p>
                    <p className="mt-1 text-xs opacity-85">
                      {term.state === "ok"
                        ? `${term.adsRead} live ads came back under this term.`
                        : term.state === "empty"
                          ? "Nobody was advertising under this term in your market."
                          : "This search couldn't be read — a reading problem on our side, not an empty field."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── THE PROFILES ───────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-2.5">
        {kept.length === 0 ? (
          <p className="max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            No companies on your list yet. Look up your field, or add a name you already know.
          </p>
        ) : (
          kept.map((rival) => (
            <RivalRow key={rival.id} rival={rival} locked={locked} onToggle={() => toggle(rival)} />
          ))
        )}
      </div>

      {/* ── ADD ONE YOURSELF ───────────────────────────────────────────────── */}
      {!locked ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border/70 pt-4">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Add a company you already compete with"
            className="min-w-0 flex-1 sm:max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={pending}>
            <Plus size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">Add</span>
          </Button>
        </div>
      ) : null}

      {/* ── SET ASIDE, WITH REASONS ────────────────────────────────────────── */}
      {setAside.length > 0 ? (
        <Collapsible className="min-w-0 border-t border-border/70 pt-3">
          <CollapsibleTrigger
            render={<button type="button" />}
            className="flex min-w-0 w-full items-center gap-2 text-left"
          >
            <ChevronDown size={14} strokeWidth={1.8} className="shrink-0 text-muted-foreground" />
            <Plate className="min-w-0 truncate">
              {setAside.length} advertiser{setAside.length === 1 ? "" : "s"} set aside
            </Plate>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1.5">
              {setAside.map((entry) => (
                <li key={entry.name} className="min-w-0">
                  <span className="block truncate text-[12.5px] text-foreground/85">
                    {entry.name}
                  </span>
                  <span className="block text-[12px] leading-relaxed text-muted-foreground">
                    {entry.reason}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {dropped.length > 0 ? (
        <Collapsible className="min-w-0 border-t border-border/70 pt-3">
          <CollapsibleTrigger
            render={<button type="button" />}
            className="flex min-w-0 w-full items-center gap-2 text-left"
          >
            <ChevronDown size={14} strokeWidth={1.8} className="shrink-0 text-muted-foreground" />
            <Plate className="min-w-0 truncate">{dropped.length} removed by you</Plate>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1.5">
              {dropped.map((rival) => (
                <li key={rival.id} className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">
                    {rival.name}
                  </span>
                  {!locked ? (
                    <Button size="sm" variant="ghost" onClick={() => toggle(rival)}>
                      <RotateCcw size={13} strokeWidth={1.7} />
                      <span className="min-w-0 truncate">Put back</span>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function RivalRow({
  rival,
  locked,
  onToggle,
}: {
  rival: RivalCard;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="flex min-w-0 items-stretch border border-border bg-film-base/60">
      <Rebate />
      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Building2 size={14} strokeWidth={1.6} className="shrink-0 text-muted-foreground" />
              <h3 className="min-w-0 truncate text-[14px] font-medium text-foreground">
                {rival.name}
              </h3>
              <ProvenanceBadge
                provenance={rival.profiled ? "swept_from_public_library" : "model_interpretation"}
                detail={
                  rival.profiled
                    ? "Their profile is written from their own live ads, read out of the public Ad Library."
                    : "Nobody has been read for this company yet — press Profile these companies."
                }
              />
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {FOUND_LABEL[rival.foundVia] ?? "On your list"}
              {rival.foundUnder ? ` · under “${rival.foundUnder}”` : ""}
            </p>
          </div>

          {!locked ? (
            <Button size="sm" variant="ghost" onClick={onToggle} className="shrink-0">
              <Trash2 size={13} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Remove</span>
            </Button>
          ) : null}
        </div>

        {rival.placeholder ? (
          <p className="mt-2 max-w-[65ch] border-l-2 border-film-edge/50 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
            This is a slot, not a company — replace it with a real name, or look up your field and
            it will be replaced by companies actually running ads.
          </p>
        ) : (
          <>
            {rival.positioning ? (
              <p className="mt-2 max-w-[65ch] text-[13px] leading-relaxed text-foreground/85">
                &ldquo;{rival.positioning}&rdquo;
              </p>
            ) : null}

            <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
              {rival.field ? (
                <span className="min-w-0 truncate text-[12px] text-foreground/80">
                  {rival.field}
                  {rival.categoryLabel ? ` · ${rival.categoryLabel}` : ""}
                </span>
              ) : null}
              <span className="min-w-0 truncate text-[12px] text-muted-foreground">
                {RELATION_LABEL[rival.categoryRelation] ?? RELATION_LABEL.unknown}
              </span>
              {rival.displayLink ? (
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Globe size={12} strokeWidth={1.7} className="shrink-0" />
                  <span className="min-w-0 truncate">{rival.displayLink}</span>
                </span>
              ) : null}
            </div>

            <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
              <EdgeCode>
                {rival.adsSeen} live ad{rival.adsSeen === 1 ? "" : "s"} seen
              </EdgeCode>
              {rival.reachBand ? (
                <Tooltip>
                  <TooltipTrigger
                    render={<span />}
                    className="plate inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-primary bg-primary px-1.5 py-[3px] leading-none text-primary-foreground"
                  >
                    {rival.reachBand} reached
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    <p className="font-medium">Published by Meta</p>
                    <p className="mt-1 text-xs opacity-85">
                      The widest range Meta publishes across their ads we read, reproduced exactly.
                      IOAA.AI never narrows it to a single number, and it says nothing about
                      whether the ad worked.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : rival.profiled ? (
                <span className="text-[12px] text-muted-foreground">Reach not published</span>
              ) : null}
            </div>

            {rival.whyUseful ? (
              <p className="mt-2 max-w-[65ch] text-[12px] leading-relaxed text-muted-foreground">
                {rival.whyUseful}
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
