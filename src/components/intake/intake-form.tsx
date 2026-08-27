"use client";

/**
 * S1 — Intake, reduced to the one thing only the user can tell us: their site.
 *
 * Everything the old form asked for — brand name, market, countries, languages,
 * media type — is DERIVED: the site is read for its own words and country
 * signals, and the market is matched from those. All of it is shown back on the
 * next screen as editable, because a derived value the user cannot correct is
 * just a guess wearing confidence.
 *
 * In the light-table world this screen is THE UNEXPOSED SHEET: an empty grid of
 * film frames waiting to be shot, with one slot to load. The frames fill in for
 * real on the next screen, so the empty grid here is a promise the app keeps
 * rather than decoration.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ChevronDown, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { startAutoRun } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EdgeCode, Plate } from "@/components/rack/plate";
import { OBJECTIVES } from "@/lib/admirror/ad-library";
import { cn } from "@/lib/utils";

/** The empty sheet. Twelve frames, edge-coded, waiting to be exposed. */
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

export function IntakeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [website, setWebsite] = useState("");
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
      const result = await startAutoRun({
        website,
        brandNameOverride,
        objectives: objectives.length > 0 ? objectives : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/runs/${result.id}`);
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
          {/* The thesis: your market's ads, laid out as a sheet you read. */}
          <div className="min-w-0">
            <Plate className="block">Contact sheet · your market</Plate>
            <h1 className="mt-3 text-balance text-[30px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[40px]">
              Their best angle,
              <br />
              your ad.
            </h1>
            <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Give AdMirror your website. It reads what you sell, finds who else is really
              advertising in your market, collects their live ads from the public Ad Library with the
              artwork attached, and lays the lot out as a sheet you can read at a glance. You circle
              the angle you want; it comes back as three ads of your own.
            </p>

            <div className="mt-8 min-w-0">
              <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
                <Plate className="min-w-0 truncate">The sheet, before exposure</Plate>
                <EdgeCode className="shrink-0">
                  {website.trim() ? "loaded" : "empty"}
                </EdgeCode>
              </div>
              <EmptySheet armed={website.trim().length > 2} />
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Each frame becomes one real ad, with the picture the Library itself displays.
              </p>
            </div>
          </div>

          {/* The one control. */}
          <form onSubmit={submit} className="min-w-0">
            <div className="panel lightbox min-w-0 rounded-sm p-4 sm:p-5">
              <fieldset className="min-w-0 space-y-3">
                <Plate as="legend">Load the sheet</Plate>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="site" className="sr-only">
                    Your website
                  </Label>
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
                    That&rsquo;s all we need. Your brand name, your market and your category words
                    come from the site itself — and every one is editable on the next screen.
                  </p>
                </div>
              </fieldset>

              <div className="mt-5 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  className="plate inline-flex items-center gap-1 text-rack-engrave transition-colors duration-150 ease-out hover:text-foreground"
                >
                  {advancedOpen ? "Hide the optional bits" : "Optional: steer it"}
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
                      <Label>What these ads are for</Label>
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
                  {pending ? "Reading your site…" : "Start collecting"}
                  <ArrowRight size={15} strokeWidth={1.8} />
                </Button>
              </div>
            </div>

            {/* Expectation-setting, and the honesty line. Not a footnote. */}
            <div className="mt-4 flex min-w-0 items-start gap-3 border-l-2 border-film-edge/60 bg-film-edge/[0.06] px-3.5 py-3">
              <ScanSearch size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-film-edge" />
              <p className="min-w-0 text-[12.5px] leading-relaxed text-foreground/85">
                Collection runs on its own — about forty seconds per search. It reads only what the
                public Ad Library shows anyone: the copy, the call to action, the artwork, the date
                each ad started running, and the reach range Meta publishes on some of them.{" "}
                <span className="text-muted-foreground">
                  Meta publishes no spend, click or conversion figures for these ads, so AdMirror
                  never shows one — and where it publishes no reach either, the ad says so rather
                  than showing a zero.
                </span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
