"use client";

/**
 * S6 — the delivered variants.
 *
 * Each variant shows its script, its ad copy, the render briefs, and the gate
 * results. A variant a gate BLOCKED is shown as blocked, with the reason — never
 * quietly dropped and never presented as if it shipped.
 */
import { useState } from "react";
import { Check, Copy, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { EdgeCode, Lamp, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolutionSpec, type ResolutionKey } from "@/lib/admirror/matrix";
import type { GateResult, TestPlan } from "@/lib/admirror/generate";
import type { VariantRow } from "@/lib/admirror/queries";
import { cn } from "@/lib/utils";

type ScriptShape = {
  beats: { at: string; onScreen: string; vo: string }[];
  retentionNote: string;
};

type GatesShape = {
  results?: GateResult[];
  testPlan?: TestPlan;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(`${label} copied.`);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          toast.error("Your browser wouldn't let us reach the clipboard.");
        }
      }}
    >
      {copied ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.6} />}
      <span className="min-w-0 truncate">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}

export function VariantPanel({ variant }: { variant: VariantRow }) {
  const script: ScriptShape = variant.script ? (JSON.parse(variant.script) as ScriptShape) : { beats: [], retentionNote: "" };
  const gates: GatesShape = variant.gates ? (JSON.parse(variant.gates) as GatesShape) : {};
  const results = gates.results ?? [];
  const blocked = variant.state === "blocked";
  const isStatic = variant.assetKind === "static";
  // The delivery spec travels with the asset: a brief without a frame size and a
  // runtime is a brief the buyer has to finish themselves.
  const size = resolutionSpec(variant.outputResolution as ResolutionKey);
  const seconds = Number(variant.outputDurationSeconds) || 0;
  const altCopy: string[] = (() => {
    try {
      return variant.altCopy ? (JSON.parse(variant.altCopy) as string[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <article
      className={cn(
        "panel min-w-0 rounded-sm",
        blocked && "shadow-[inset_0_0_0_1px_var(--lamp-alert)]",
      )}
    >
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Lamp state={blocked ? "alert" : "done"} />
            <span className="min-w-0 truncate text-[13.5px] font-medium">{variant.hookLabel}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{variant.testRole}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "plate rounded-[3px] border px-1.5 py-[3px]",
              isStatic
                ? "border-border text-rack-engrave"
                : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            {isStatic ? "static" : "video"}
          </span>
          {variant.formatAxis === "contrast" ? (
            <span className="plate rounded-[3px] border border-border px-1.5 py-[3px] text-rack-engrave">
              customer-filmed
            </span>
          ) : null}
          <span className="plate rounded-[3px] border border-border px-1.5 py-[3px] text-rack-engrave">
            variant {variant.variantIndex}
          </span>
        </div>
      </header>

      <div className="px-4 py-4">
        <p className="text-balance text-[16px] font-medium leading-[1.3] tracking-[-0.02em]">
          {variant.hookLine}
        </p>

        {/* Built to spec — stamped where nobody can miss it. */}
        <dl className="mt-3.5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-sm border border-border bg-rack-rail/60 px-3.5 py-2.5">
          <div className="min-w-0">
            <dt className="plate block truncate text-rack-engrave">Build at</dt>
            <dd className="mt-0.5">
              <EdgeCode>
                {size.width}×{size.height}
              </EdgeCode>
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {size.ratio} · {size.label}
              </span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="plate block truncate text-rack-engrave">Runtime</dt>
            <dd className="mt-0.5">
              {isStatic ? (
                <span className="text-[12px] text-foreground/85">still frame</span>
              ) : (
                <EdgeCode>{seconds}s</EdgeCode>
              )}
            </dd>
          </div>
          <div className="min-w-0 flex-1">
            <dt className="plate block truncate text-rack-engrave">Safe area</dt>
            <dd className="mt-0.5 min-w-0 truncate text-[11.5px] text-muted-foreground">
              {size.ratio === "9:16"
                ? "Keep text clear of the top and bottom 14%"
                : "Keep text inside a 6% margin all round"}
            </dd>
          </div>
        </dl>

        <Tabs defaultValue="copy" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="copy" className="min-w-0">
              <span className="min-w-0 truncate">Ad copy</span>
            </TabsTrigger>
            <TabsTrigger value="script" className="min-w-0">
              <span className="min-w-0 truncate">Script</span>
            </TabsTrigger>
            <TabsTrigger value="render" className="min-w-0">
              <span className="min-w-0 truncate">{isStatic ? "Frame" : "Render brief"}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="copy" className="mt-3">
            <div className="rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <Plate className="min-w-0 truncate">Primary text</Plate>
                <CopyButton text={variant.primaryText} label="Primary text" />
              </div>
              <p className="mt-1.5 max-w-[62ch] whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
                {variant.primaryText}
              </p>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="min-w-0 rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
                <Plate className="block">Headline</Plate>
                <p className="mt-1 truncate text-[13px] text-foreground/90">{variant.headline}</p>
              </div>
              <div className="min-w-0 rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
                <Plate className="block">CTA</Plate>
                <p className="mt-1 truncate text-[13px] text-foreground/90">{variant.ctaLabel}</p>
              </div>
            </div>

            {altCopy.length > 0 ? (
              <div className="mt-2 rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
                <Plate className="block">Other ways to say it</Plate>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Same angle, different wording. Text costs nothing to test, so these are yours to
                  drop straight in.
                </p>
                <ol className="mt-2 divide-y divide-border/60 rounded-sm border border-border">
                  {altCopy.map((option, index) => (
                    <li key={index} className="min-w-0 px-3 py-2.5">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <span className="tabular shrink-0 text-[11px] text-rack-seam">
                          {index + 1}
                        </span>
                        <CopyButton text={option} label={`Option ${index + 1}`} />
                      </div>
                      <p className="mt-1 max-w-[62ch] whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/85">
                        {option}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="script" className="mt-3">
            <ol className="divide-y divide-border/60 rounded-sm border border-border">
              {script.beats.map((beat) => (
                <li key={beat.at} className="flex min-w-0 gap-3 px-3.5 py-2.5">
                  <span className="tabular w-9 shrink-0 text-[11px] text-rack-seam">{beat.at}</span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-relaxed text-foreground/90">{beat.onScreen}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      VO: {beat.vo}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {script.retentionNote ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {script.retentionNote}
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="render" className="mt-3 space-y-2">
            <div className="rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <Plate className="min-w-0 truncate">Opening frame</Plate>
                <CopyButton text={variant.firstFramePrompt} label="Frame brief" />
              </div>
              <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-foreground/85">
                {variant.firstFramePrompt}
              </p>
            </div>
            <div className="rounded-sm border border-border bg-rack-rail/60 px-3.5 py-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <Plate className="min-w-0 truncate">Motion</Plate>
                <CopyButton text={variant.motionPrompt} label="Motion brief" />
              </div>
              <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-foreground/85">
                {variant.motionPrompt}
              </p>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {isStatic
                ? "This static reuses the video's opening frame, so it costs nothing extra to produce. Hooking up an image generator turns the brief into a file."
                : "These are the render briefs. Hooking up an image or video generator turns them into files without changing anything else in the run."}
            </p>
          </TabsContent>
        </Tabs>

        {/* Gates */}
        <div className="mt-4 border-t border-border pt-3.5">
          <Plate className="block">Checks</Plate>
          <ul className="mt-2 space-y-1.5">
            {results.map((gate) => (
              <li key={gate.name} className="flex min-w-0 gap-2.5">
                {gate.state === "pass" ? (
                  <ShieldCheck size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-lamp-live" />
                ) : (
                  <ShieldAlert
                    size={13}
                    strokeWidth={1.7}
                    className={cn(
                      "mt-0.5 shrink-0",
                      gate.state === "block" ? "text-lamp-alert" : "text-primary",
                    )}
                  />
                )}
                <div className="min-w-0">
                  <span className="text-[12.5px] text-foreground/90">{gate.name}</span>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">{gate.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
