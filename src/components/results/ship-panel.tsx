"use client";

/**
 * Marking a generated variant as actually shipped.
 *
 * This is the join in the whole loop. Without it a real result is an orphan
 * number: you know an ad did well, and nothing tells you which hook mechanism or
 * which borrowed angle produced it — which is exactly the knowledge the pattern
 * library is made of.
 *
 * It is a manual press, and that is not a shortcut. IOAA.AI holds no access to
 * anyone's ad account: it cannot publish, cannot pause, and cannot see what went
 * live. A button that claimed to launch would be the one dishonest control in the
 * product.
 */
import { useState, useTransition } from "react";
import { CheckCircle2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { markShipped } from "@/app/actions/outcome";
import { EdgeCode, Panel, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShippableVariant = {
  id: string;
  hookLabel: string;
  formatAxis: string;
  assetKind: string;
  testRole: string;
  /** Already on the results list — the button becomes a link. */
  shippedId: string | null;
};

export function ShipPanel({
  runId,
  variants,
}: {
  runId: string;
  variants: ShippableVariant[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const ship = (variantId: string) => {
    setBusy(variantId);
    startTransition(async () => {
      const result = await markShipped({ runId, variantId });
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("On your results list. Add the numbers when you have them.");
      router.refresh();
    });
  };

  const shippedCount = variants.filter((variant) => variant.shippedId).length;

  return (
    <Panel
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Rocket size={13} strokeWidth={1.7} className="shrink-0" />
          <span className="min-w-0 truncate">Which of these you actually ran</span>
        </span>
      }
      aside={
        <EdgeCode className="shrink-0">
          {shippedCount} of {variants.length} shipped
        </EdgeCode>
      }
    >
      <div className="min-w-0 px-4 py-4">
        <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
          You launch in your own ads manager — IOAA.AI has no access to your account and
          never will. Mark what you ran here, then come back with the numbers and it will
          tell you which part of the ad did the work.
        </p>

        <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-sm border border-border">
          {variants.map((variant) => (
            <li key={variant.id} className="flex min-w-0 items-center gap-3 bg-card/40 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">
                  {variant.hookLabel || "Unlabelled hook"}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {variant.assetKind === "static" ? "Static" : "Video"}
                  {variant.formatAxis === "contrast" ? " · customer-filmed" : " · studio"}
                  {variant.testRole ? ` · ${variant.testRole}` : ""}
                </p>
              </div>
              {variant.shippedId ? (
                <span
                  className={cn(
                    "plate inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-lamp-live/45 bg-lamp-live/12 px-1.5 py-1 leading-none text-lamp-live",
                  )}
                >
                  <CheckCircle2 size={11} strokeWidth={1.9} className="shrink-0" />
                  <span className="min-w-0 truncate">Shipped</span>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  disabled={pending && busy === variant.id}
                  onClick={() => ship(variant.id)}
                >
                  <span className="min-w-0 truncate">
                    {pending && busy === variant.id ? "Saving…" : "I ran this"}
                  </span>
                </Button>
              )}
            </li>
          ))}
        </ul>

        {shippedCount > 0 ? (
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            <Button size="sm" render={<Link href="/results" />}>
              <span className="min-w-0 truncate">Add the numbers</span>
            </Button>
            <Plate className="min-w-0 text-muted-foreground">
              Views, clicks and spend from your own dashboard
            </Plate>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
