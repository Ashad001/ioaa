"use client";

/**
 * S1 — Intake, reduced to the one thing only the user can tell us: their site.
 *
 * Everything the old form asked for — brand name, market, countries, languages,
 * objective, media type — is now DERIVED: the site is read for its own words and
 * country signals, and the market is matched from those. All of it is shown back
 * on the next screen as editable, because a derived value the user cannot correct
 * is just a guess with confidence.
 *
 * The notice is still not boilerplate. It now sets a different expectation: the
 * app goes and reads the public Library itself, that takes a couple of minutes,
 * and there is still no performance figure in any of it.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ChevronDown, Radar } from "lucide-react";
import { toast } from "sonner";

import { startAutoRun } from "@/app/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plate } from "@/components/rack/plate";
import { OBJECTIVES } from "@/lib/admirror/ad-library";
import { cn } from "@/lib/utils";

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
    <form onSubmit={submit} className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="max-w-[62ch]">
        <h1 className="text-balance text-[26px] font-medium leading-[1.15] tracking-[-0.025em] sm:text-[32px]">
          Their best angle, your ad.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
          Give AdMirror your website. It reads what you sell, searches the public Ad Library for who
          else is advertising in your market, collects their live ads, and ranks them — then you pick
          the angle you want as your own.
        </p>
      </div>

      {/* Expectation-setting. First thing, not a footnote. */}
      <div className="mt-6 flex min-w-0 items-start gap-3 rounded-sm border border-primary/25 bg-primary/[0.07] px-4 py-3.5">
        <Radar size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-primary" />
        <p className="min-w-0 text-[13px] leading-relaxed text-foreground/90">
          Collection runs on its own and takes a couple of minutes. It reads only what the public Ad
          Library shows anyone — the copy, the call to action and the date each ad started running.
          Meta publishes no spend, reach or click figures for these ads, so AdMirror never shows one.
        </p>
      </div>

      <div className="mt-7 space-y-6">
        <fieldset className="space-y-3.5">
          <Plate as="legend">Your website</Plate>
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
              className="h-12 text-[15px]"
            />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              That&rsquo;s all we need. Your brand name, your market and your category words come from
              the site itself — and every one of them is editable on the next screen.
            </p>
          </div>
        </fieldset>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            className="plate inline-flex items-center gap-1 text-rack-engrave underline decoration-rack-seam transition-colors duration-150 ease-out hover:text-foreground"
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
            <div className="mt-3 space-y-5 rounded-sm border border-border bg-card/40 p-3.5">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="brand">Brand name, if the site gets it wrong</Label>
                <Input
                  id="brand"
                  value={brandNameOverride}
                  onChange={(event) => setBrandNameOverride(event.target.value)}
                  placeholder="Leave blank to read it from your site"
                />
              </div>

              <div className="space-y-2">
                <Label>What these ads are for</Label>
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
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Shapes the voice of the variants you get at the end, not what gets collected.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Reading your site…" : "Start collecting"}
          <ArrowRight size={15} strokeWidth={1.8} />
        </Button>
        <p className="min-w-0 text-xs text-muted-foreground">
          Next: what we read about you, and who we found advertising against you.
        </p>
      </div>
    </form>
  );
}
