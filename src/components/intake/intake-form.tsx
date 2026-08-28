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
    <div aria-hidden className="grid grid-cols-4 gap-px border border-border bg-film-rebate sm:grid-cols-6">
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

export function IntakeForm({ readerConnected = true }: { readerConnected?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [website, setWebsite] = useState("");
  const [competitorNames, setCompetitorNames] = useState("");
  const [brandNameOverride, setBrandNameOverride] = useState("");
  const [objectives, setObjectives] = useState<string[]>([OBJECTIVES[0]]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const toggleObjective = (value: string) => {
    setObjectives((current) =>
      current.includes(value) ? current.filter((item) => item !== value) || [] : [...current, value],
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
            <Plate className="block">New competitive analysis</Plate>
            <h1 className="mt-3 max-w-[14ch] text-balance text-[30px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[42px]">
              Start with your market. Keep the evidence close.
            </h1>
            <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted-foreground">
              We read your website, build a reviewable competitor list, then collect only after you confirm who belongs on it. Each finding keeps the original ad beside it.
            </p>

            <div className="mt-8 min-w-0">
              <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
                <Plate className="min-w-0 truncate">Collection queue</Plate>
                <EdgeCode className="shrink-0">{armed ? "site ready" : "awaiting site"}</EdgeCode>
              </div>
              <EmptySheet armed={armed} />
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Every slot becomes one observed ad, including the creative the library displays.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="min-w-0">
            <div className="panel lightbox min-w-0 rounded-sm p-4 sm:p-5">
              <fieldset className="min-w-0 space-y-4">
                <Plate as="legend">Company details</Plate>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="site">Website</Label>
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
                    This gives IOAA.AI the product category and market terms for the first pass.
                  </p>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="competitors">Companies to include <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    id="competitors"
                    value={competitorNames}
                    onChange={(event) => setCompetitorNames(event.target.value)}
                    placeholder={"ImagineArt\nHiggsfield\nRunway"}
                    className="min-h-28 resize-y font-mono text-[14px]"
                  />
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    Add one company per line, or leave this blank and review the companies found for your market.
                  </p>
                </div>
              </fieldset>

              <div className="mt-5 border-t border-border/70 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  className="h-auto px-0 text-rack-engrave hover:bg-transparent hover:text-foreground"
                >
                  <span className="plate">{advancedOpen ? "Hide options" : "Output options"}</span>
                  <ChevronDown
                    size={12}
                    strokeWidth={1.8}
                    className={cn("transition-transform duration-150 ease-out", advancedOpen && "rotate-180")}
                  />
                </Button>

                {advancedOpen ? (
                  <div className="mt-3.5 space-y-5">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="brand">Brand name, if the site has it wrong</Label>
                      <Input
                        id="brand"
                        value={brandNameOverride}
                        onChange={(event) => setBrandNameOverride(event.target.value)}
                        placeholder="Read from your site"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>What should the new ads do?</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {OBJECTIVES.map((objective) => {
                          const active = objectives.includes(objective);
                          return (
                            <Button
                              key={objective}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleObjective(objective)}
                              className={cn(
                                "min-w-0 max-w-full truncate rounded-[3px] text-[12px]",
                                active
                                  ? "border-primary/70 bg-primary/12 text-foreground hover:bg-primary/18"
                                  : "border-border bg-secondary/40 text-muted-foreground hover:border-rack-seam hover:text-foreground",
                              )}
                            >
                              {objective}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                        This shapes the creative you receive at the end. It does not change the ads collected.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 border-t border-border/70 pt-4">
                <Button type="submit" size="lg" disabled={pending} className="w-full">
                  {pending ? "Building competitor list…" : "Build competitor list"}
                  <ArrowRight size={15} strokeWidth={1.8} />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex min-w-0 items-start gap-3 border border-primary/20 bg-primary/[0.055] px-3.5 py-3">
              <ScanSearch size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-film-edge" />
              <p className="min-w-0 text-[12.5px] leading-relaxed text-foreground/85">
                Named companies are checked directly. The public Ad Library supplies the copy, creative, start date, and any reach range it publishes. IOAA.AI does not fill in anything else.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
