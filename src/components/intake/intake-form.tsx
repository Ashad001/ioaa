"use client";

/**
 * S1 — Intake. Brand, market, objective, and the expectation-setting notice.
 *
 * The notice is not boilerplate: telling someone up front that capture is their
 * job, and roughly how long it takes, is what stops the board from disappointing
 * them twenty minutes later.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Hand } from "lucide-react";
import { toast } from "sonner";

import { createRun } from "@/app/actions/runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/rack/plate";
import { MARKET_PRESETS, MEDIA_TYPES, OBJECTIVES } from "@/lib/admirror/ad-library";
import { cn } from "@/lib/utils";

export function IntakeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [brandName, setBrandName] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [marketPresetId, setMarketPresetId] = useState<string>(MARKET_PRESETS[0].id);
  const [customMarketLabel, setCustomMarketLabel] = useState("");
  const [customCountries, setCustomCountries] = useState("");
  const [customLanguages, setCustomLanguages] = useState("");
  const [objectives, setObjectives] = useState<string[]>([OBJECTIVES[0]]);
  const [mediaType, setMediaType] = useState("all");
  const [lookbackDays, setLookbackDays] = useState("90");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isCustom = marketPresetId === "custom";

  const toggleObjective = (value: string) => {
    setObjectives((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createRun({
        brandName,
        brandWebsite,
        marketPresetId: isCustom ? "" : marketPresetId,
        customMarketLabel,
        customCountries,
        customLanguages,
        objectives,
        mediaType,
        lookbackDays,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/runs/${result.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="max-w-[62ch]">
        <h1 className="text-balance text-[26px] font-medium leading-[1.15] tracking-[-0.025em] sm:text-[32px]">
          Their best angle, your ad.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
          Tell AdMirror who you are and where you sell. It reads your brand, maps who you&rsquo;re up
          against, and hands you ready-made public Ad Library searches for each of them.
        </p>
      </div>

      {/* The expectation-setting notice. First thing, not a footnote. */}
      <div className="mt-6 flex min-w-0 items-start gap-3 rounded-sm border border-primary/25 bg-primary/[0.07] px-4 py-3.5">
        <Hand size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-primary" />
        <p className="min-w-0 text-[13px] leading-relaxed text-foreground/90">
          AdMirror doesn&rsquo;t pull from Meta automatically. You&rsquo;ll search the public Ad Library
          yourself and submit what you find — usually 10&ndash;20 minutes for a market. That&rsquo;s what
          keeps every number in here something a person actually saw.
        </p>
      </div>

      <div className="mt-7 space-y-6">
        <fieldset className="space-y-3.5">
          <Plate as="legend">Your brand</Plate>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="brand">Brand name</Label>
              <Input
                id="brand"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Northwind Coffee"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="site">
                Website <span className="text-muted-foreground">— optional</span>
              </Label>
              <Input
                id="site"
                type="url"
                value={brandWebsite}
                onChange={(e) => setBrandWebsite(e.target.value)}
                placeholder="https://"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Raises the confidence of the brand read.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3.5">
          <Plate as="legend">Target market</Plate>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_PRESETS.map((preset) => {
              const active = marketPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setMarketPresetId(preset.id)}
                  className={cn(
                    "min-w-0 rounded-sm border px-3 py-2.5 text-left transition-colors duration-150 ease-out",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-card/50 hover:border-rack-seam hover:bg-card",
                  )}
                >
                  <span className="block truncate text-[13px] text-foreground">{preset.label}</span>
                  <span className="tabular mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {preset.countries.join(" · ")}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMarketPresetId("custom")}
              className={cn(
                "min-w-0 rounded-sm border px-3 py-2.5 text-left transition-colors duration-150 ease-out",
                isCustom
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card/50 hover:border-rack-seam hover:bg-card",
              )}
            >
              <span className="block truncate text-[13px] text-foreground">Build my own</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                Countries and languages
              </span>
            </button>
          </div>

          {isCustom ? (
            <div className="grid gap-3.5 rounded-sm border border-border bg-card/40 p-3.5 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="market-label">Name it</Label>
                <Input
                  id="market-label"
                  value={customMarketLabel}
                  onChange={(e) => setCustomMarketLabel(e.target.value)}
                  placeholder="Benelux — Dutch"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="market-countries">Country codes</Label>
                <Input
                  id="market-countries"
                  value={customCountries}
                  onChange={(e) => setCustomCountries(e.target.value)}
                  placeholder="NL, BE"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="market-languages">Languages</Label>
                <Input
                  id="market-languages"
                  value={customLanguages}
                  onChange={(e) => setCustomLanguages(e.target.value)}
                  placeholder="nl, fr"
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3.5">
          <Plate as="legend">What these ads are for</Plate>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVES.map((objective) => {
              const active = objectives.includes(objective);
              return (
                <button
                  key={objective}
                  type="button"
                  onClick={() => toggleObjective(objective)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors duration-150 ease-out",
                    active
                      ? "border-primary/60 bg-primary/12 text-foreground"
                      : "border-border bg-card/50 text-muted-foreground hover:border-rack-seam hover:text-foreground",
                  )}
                >
                  {objective}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            className="plate text-rack-engrave underline decoration-rack-seam transition-colors hover:text-foreground"
          >
            {advancedOpen ? "Hide advanced" : "Advanced"}
          </button>

          {advancedOpen ? (
            <div className="mt-3 grid gap-3.5 rounded-sm border border-border bg-card/40 p-3.5 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="media">Media type in the searches</Label>
                <select
                  id="media"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="h-9 w-full min-w-0 rounded-sm border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {MEDIA_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="lookback">Lookback (days)</Label>
                <Input
                  id="lookback"
                  type="number"
                  min={7}
                  max={365}
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Setting up the run…" : "Start the run"}
          <ArrowRight size={15} strokeWidth={1.8} />
        </Button>
        <p className="min-w-0 text-xs text-muted-foreground">
          Next: the brand read and your competitor map. Nothing is fetched from Meta.
        </p>
      </div>
    </form>
  );
}
