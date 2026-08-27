"use client";

/**
 * THE ONE DOOR TO COLLECTION.
 *
 * Nothing is read out of the Ad Library for a board until this is pressed, and
 * pressing it writes one advertiser lookup per company on the list. That is why
 * it lives here and not on the collection screen: the list the user approved IS
 * the collection plan.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { approveProfile, reopenProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";

export function ApproveBar({
  runId,
  keptCount,
  approved,
}: {
  runId: string;
  keptCount: number;
  approved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const approve = () => {
    startTransition(async () => {
      const result = await approveProfile(runId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Approved — collecting their live ads now.");
      router.push(`/runs/${runId}`);
    });
  };

  const reopen = () => {
    startTransition(async () => {
      const result = await reopenProfile(runId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reopened — nothing new gets collected until you approve again.");
      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-3 sm:px-6">
      <p className="min-w-0 max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
        {approved
          ? `Approved with ${keptCount} compan${keptCount === 1 ? "y" : "ies"}. Reopen it to change the list — collection pauses until you approve again.`
          : `Nothing is collected until you approve. ${keptCount} compan${keptCount === 1 ? "y" : "ies"} will be read.`}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {approved ? (
          <>
            <Button size="sm" variant="outline" onClick={reopen} disabled={pending}>
              <LockOpen size={14} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Reopen</span>
            </Button>
            <Button size="sm" onClick={() => router.push(`/runs/${runId}`)}>
              <span className="min-w-0 truncate">Go to collection</span>
              <ArrowRight size={14} strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={approve} disabled={pending || keptCount === 0}>
            <ShieldCheck size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">Approve and start collecting</span>
          </Button>
        )}
      </div>
    </div>
  );
}
