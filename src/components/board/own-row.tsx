"use client";

/**
 * THE "YOU" ROW — the user's own ad, sitting above the competitor evidence.
 *
 * The asymmetry here is the whole design problem, and it is solved by refusing to
 * resolve it. The user's row carries MEASURED numbers they read off their own
 * dashboard. Every competitor row carries an opportunity score derived from what
 * was collected, because the public Ad Library publishes no performance figure.
 * Those are different quantities.
 *
 * So this row deliberately does NOT get an opportunity ring, and no competitor
 * gets a cost per result. One shared gauge across both would imply a comparison
 * the data cannot support — it would read as "your ad scores 61, theirs scores
 * 74", which would be a sentence made of two incompatible units. Instead each
 * side shows what it actually knows, and the divider between them says why.
 */
import { useState, useTransition } from "react";
import { CircleUser, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { addOwnAd, removeOwnAd } from "@/app/actions/outcome";
import { EdgeCode, Panel, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProvenanceBadge } from "@/components/rack/metric";
import { fmtCount, fmtRate, num } from "@/lib/admirror/outcome";

export type OwnRowData = {
  id: string;
  label: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  assetKind: string;
  impressions: string;
  clicks: string;
  results: string;
  resultLabel: string;
  amountSpent: string;
  currency: string;
  videoPlays: string;
  watched25: string;
  watched75: string;
  daysLive: string;
};

export function OwnRow({ runId, ads }: { runId: string; ads: OwnRowData[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <CircleUser size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">Your own ads</span>
        </span>
      }
      aside={
        <span className="flex shrink-0 items-center gap-2">
          <EdgeCode className="hidden sm:inline">measured, not scored</EdgeCode>
          <Button variant="ghost" size="sm" onClick={() => setAdding((open) => !open)}>
            {adding ? <X size={13} strokeWidth={1.8} /> : <Plus size={13} strokeWidth={1.9} />}
            <span className="min-w-0 truncate">{adding ? "Cancel" : "Add yours"}</span>
          </Button>
        </span>
      }
    >
      <div className="min-w-0 px-4 py-4">
        <p className="max-w-[74ch] text-[12.5px] leading-relaxed text-muted-foreground">
          Your own ads carry real numbers, because you have them. The competitor cards below
          carry an opportunity score built from what Meta does publish — reach where it exists,
          plus how long and how widely each ad runs. Meta publishes no spend or cost per result
          for them, so AdMirror never puts those two on one scale: no ring on this row, no cost
          per result on theirs.
        </p>

        {adding ? <AddForm runId={runId} onDone={() => setAdding(false)} /> : null}

        {ads.length === 0 ? (
          adding ? null : (
            <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-foreground/80">
              Add one of your own ads and AdMirror will read your real voice off your own
              copy instead of guessing it from your website — and you&rsquo;ll have your own
              numbers beside the market for context.
            </p>
          )
        ) : (
          <ul className="mt-4 space-y-3">
            {ads.map((ad) => (
              <OwnCard key={ad.id} runId={runId} ad={ad} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function OwnCard({ runId, ad }: { runId: string; ad: OwnRowData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const impressions = num(ad.impressions);
  const clicks = num(ad.clicks);
  const w25 = num(ad.watched25);
  const w75 = num(ad.watched75);

  const clickRate = impressions && clicks !== null && impressions > 0 ? clicks / impressions : null;
  const stopRate = impressions && w25 !== null && impressions > 0 ? w25 / impressions : null;
  const holdRate = w25 && w75 !== null && w25 > 0 ? w75 / w25 : null;

  const remove = () => {
    startTransition(async () => {
      const result = await removeOwnAd({ ownAdId: ad.id, runId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed from the board.");
      router.refresh();
    });
  };

  return (
    <li className="min-w-0 rounded-sm border border-chart-2/40 bg-chart-2/[0.05] p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="plate shrink-0 rounded-[3px] border border-chart-2/50 px-1.5 py-[3px] leading-none text-chart-2">
              You
            </span>
            <p className="min-w-0 truncate text-[13.5px] text-foreground">{ad.label}</p>
          </div>
          {ad.headline ? (
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-snug text-foreground/85">
              {ad.headline}
            </p>
          ) : null}
          {ad.bodyCopy ? (
            <p className="mt-1 max-w-[66ch] text-[12px] leading-relaxed text-muted-foreground">
              {ad.bodyCopy}
            </p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <ProvenanceBadge
            provenance="user_asserted"
            detail="Your own numbers, from your own ad account. Nothing here was fetched, and nothing like it exists for a competitor's ad."
          />
          <Button variant="ghost" size="sm" disabled={pending} onClick={remove} aria-label="Remove">
            <Trash2 size={13} strokeWidth={1.7} />
          </Button>
        </span>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap gap-x-6 gap-y-3 border-t border-chart-2/25 pt-3">
        <Fig label="Views" value={fmtCount(impressions)} />
        <Fig label="Stopped the scroll" value={fmtRate(stopRate)} />
        <Fig label="Held on" value={fmtRate(holdRate)} />
        <Fig label="Clicks" value={fmtRate(clickRate)} />
        <Fig
          label={ad.resultLabel || "Results"}
          value={ad.results ? fmtCount(num(ad.results)) : "not reported"}
        />
        <Fig
          label="Spent"
          value={ad.amountSpent ? `${ad.amountSpent} ${ad.currency}`.trim() : "not reported"}
        />
      </div>
    </li>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Plate className="block">{label}</Plate>
      <span className="tabular mt-0.5 block truncate text-[13px] text-foreground/90">{value}</span>
    </div>
  );
}

function AddForm({ runId, onDone }: { runId: string; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState({
    label: "",
    headline: "",
    bodyCopy: "",
    ctaLabel: "",
    impressions: "",
    clicks: "",
    amountSpent: "",
    currency: "",
    results: "",
    resultLabel: "",
    videoPlays: "",
    watched25: "",
    watched75: "",
    daysLive: "",
  });

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const save = () => {
    startTransition(async () => {
      const result = await addOwnAd({ runId, ...fields });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your ad is on the board.");
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="mt-4 min-w-0 rounded-sm border border-border bg-rack-rail/40 p-3.5">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Small id="own-label" label="What to call it" value={fields.label} onChange={set("label")} />
        <Small
          id="own-cta"
          label="Call to action"
          value={fields.ctaLabel}
          onChange={set("ctaLabel")}
        />
      </div>

      <div className="mt-3 min-w-0">
        <Label htmlFor="own-headline" className="plate block text-rack-engrave">
          Headline
        </Label>
        <Input
          id="own-headline"
          value={fields.headline}
          onChange={(event) => set("headline")(event.target.value)}
          className="mt-1.5"
        />
      </div>

      <div className="mt-3 min-w-0">
        <Label htmlFor="own-body" className="plate block text-rack-engrave">
          Body copy — this is what AdMirror reads your real voice from
        </Label>
        <Textarea
          id="own-body"
          value={fields.bodyCopy}
          onChange={(event) => set("bodyCopy")(event.target.value)}
          rows={3}
          className="mt-1.5"
        />
      </div>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Small id="own-imp" label="Views" value={fields.impressions} onChange={set("impressions")} />
        <Small id="own-clicks" label="Clicks" value={fields.clicks} onChange={set("clicks")} />
        <Small
          id="own-w25"
          label="Watched 25%"
          value={fields.watched25}
          onChange={set("watched25")}
        />
        <Small
          id="own-w75"
          label="Watched 75%"
          value={fields.watched75}
          onChange={set("watched75")}
        />
        <Small
          id="own-spend"
          label="Amount spent"
          value={fields.amountSpent}
          onChange={set("amountSpent")}
        />
        <Small
          id="own-currency"
          label="Currency"
          value={fields.currency}
          onChange={set("currency")}
        />
        <Small id="own-results" label="Results" value={fields.results} onChange={set("results")} />
        <Small
          id="own-rlabel"
          label="Result name"
          value={fields.resultLabel}
          onChange={set("resultLabel")}
        />
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          <span className="min-w-0 truncate">{pending ? "Saving…" : "Put it on the board"}</span>
        </Button>
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          Numbers are optional — the copy alone is worth adding, because it&rsquo;s better
          evidence of your voice than your homepage.
        </p>
      </div>
    </div>
  );
}

function Small({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="plate block text-rack-engrave">
        <span className="min-w-0 truncate">{label}</span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="—"
        className="mt-1.5"
      />
    </div>
  );
}
