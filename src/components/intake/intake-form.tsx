"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ChevronDown, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { startCompetitorRun } from "@/app/actions/competitor-run";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EdgeCode, Plate } from "@/components/rack/plate";
import { ReaderStatus } from "@/components/run/reader-status";
import { OBJECTIVES } from "@/lib/admirror/ad-library";
import { cn } from "@/lib/utils";

function EmptySheet({ armed }: { armed: boolean }) {
  return (
    <div aria-hidden className="grid grid-cols-4 gap-px bg-film-rebate sm:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "emulsion relative flex aspect-[4/5] items-end justify-start p-1.5 transition-colors duration-500 ease-out",
            armed && "bg-card",
          )}
          style={{ transitionDelay: `${index * 40}ms` }}
        >
          <EdgeCode className={cn("opacity-45", armed && "opacity-80")}>
            {String(index + 1).padStart(2, "0")}
          </EdgeCode>
        </div>
      ))}
    </div>
  );
}

export function IntakeForm({
  readerConnected = true,
}: {
  readerConnected?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [website, setWebsite] = useState("");
  const [competitorNames, setCompetitorNames] = useState("");
  const [brandNameOverride, setBrandNameOverride] = useState("");
  const [objectives, setObjectives] = useState<string[]>([OBJECTIVES[0]]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const toggleObjective = (value: string) => {
    setObjectives((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value) || []
        : [...current, value],
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await startCompetitorRun({
        website,
        brandNameOverride,
        objectives: objectives.length > 0 ? objectives : undefined,
        competitorNames: competitorNames
          .split(/[\n,]/)
          .map((name) => name.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/runs/${result.id}/profile`);
    });
  };

  const armed = website.trim().length > 2;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12">
        {readerConnected ? null : (
          <div className="mb-7 min-w-0">
            <ReaderStatus connected={readerConnected} context="start" />
          </div>
        )}

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
          <div className="min-w-0">
            <Plate className="block">Competitor intelligence · live ads</Plate>
            <h1 className="mt-3 text-balance text-[30px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[40px]">
              Their live ads,
              <br />
              your next angle.
            </h1>
            <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Give AdMirror your website. It works out what you sell and what field you&rsquo;re in,
              finds the companies advertising in that field and the ones next to it, and builds a
              profile for each one from their own live ads — before a single ad is collected. You
              approve the list, then the sheet loads.
            </p>

            <div className="mt-8 min-w-0">
              <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
                <Plate className="min-w-0 truncate">The sheet, ready to load</Plate>
                <EdgeCode className="shrink-0">{armed ? "armed" : "waiting"}</EdgeCode>
              </div>
              <EmptySheet armed={armed} />
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Each frame becomes one observed ad, with the creative the Library itself displays.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="min-w-0">
            <div className="panel lightbox min-w-0 rounded-sm p-4 sm:p-5">
              <fieldset className="min-w-0 space-y-4">
                <Plate as="legend">Start with your company</Plate>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="site">Your website</Label>
                  <Input
                    id="site"
                    required
                    autoFocus
                    inputMode="url"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    placeholder="yourbrand.com"
                    className="h-12 font-mono text-[15px]"
                  />
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    Read for what you sell and what field you compete in — which is what decides
                    who gets looked up.
                  </p>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="competitors">Competitors you already know — optional</Label>
                  <Textarea
                    id="competitors"
                    value={competitorNames}
                    onChange={(event) => setCompetitorNames(event.target.value)}
                    placeholder={"ImagineArt\nHiggsfield\nRunway"}
                    className="min-h-28 resize-y font-mono text-[14px]"
                  />
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    One brand per line. Leave it empty and AdMirror looks up who advertises in your
                    field for you — you approve the list either way.
                  </p>
                </div>
              </fieldset>

              <div className="mt-5 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  className="plate inline-flex items-center gap-1 text-rack-engrave transition-colors duration-150 ease-out hover:text-foreground"
                >
                  {advancedOpen ? "Hide the optional bits" : "Optional: steer the output"}
                  <ChevronDown
                    size={12}
                    strokeWidth={1.8}
                    className={cn(
                      "transition-transform duration-150 ease-out",
                      advancedOpen && "rotate-180",
                    )}
                  />
                </button>

                {advancedOpen ? (
                  <div className="mt-3.5 space-y-5">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="brand">Brand name, if the site gets it wrong</Label>
                      <Input
                        id="brand"
                        value={brandNameOverride}
                        onChange={(event) => setBrandNameOverride(event.target.value)}
                        placeholder="Read from your site"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>What your ads are for</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {OBJECTIVES.map((objective) => {
                          const active = objectives.includes(objective);
                          return (
                            <button
                              key={objective}
                              type="button"
                              onClick={() => toggleObjective(objective)}
                              className={cn(
                                "min-w-0 max-w-full truncate rounded-[3px] border px-2.5 py-1.5 text-[12px] transition-colors duration-150 ease-out",
                                active
                                  ? "border-primary/70 bg-primary/12 text-foreground"
                                  : "border-border bg-secondary/40 text-muted-foreground hover:border-rack-seam hover:text-foreground",
                              )}
                            >
                              {objective}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                        Shapes the voice of the ads you get at the end, not what gets collected.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 border-t border-border/70 pt-4">
                <Button type="submit" size="lg" disabled={pending} className="w-full">
                  {pending ? "Loading competitors…" : "Collect these competitors"}
                  <ArrowRight size={15} strokeWidth={1.8} />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex min-w-0 items-start gap-3 border-l-2 border-film-edge/60 bg-film-edge/[0.06] px-3.5 py-3">
              <ScanSearch size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-film-edge" />
              <p className="min-w-0 text-[12.5px] leading-relaxed text-foreground/85">
                Each named company is checked directly, so your board reflects the advertisers you
                chose—not a broad list of loosely related brands. The public Ad Library supplies the
                copy, artwork, start date and any reach range it publishes; nothing else is inferred.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
