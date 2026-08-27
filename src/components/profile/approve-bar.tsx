"use client";

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
      toast.success("List approved. Collecting live ads now.");
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
      toast.success("List reopened. Collection stays paused until you approve it again.");
      router.refresh();
    });
  };

  const companyLabel = `${keptCount} compan${keptCount === 1 ? "y" : "ies"}`;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-3 sm:px-6">
      <div className="min-w-0 max-w-[65ch]">
        <p className="text-[12.5px] leading-relaxed text-foreground">
          {approved ? `Collection list approved: ${companyLabel}.` : `Ready to collect from ${companyLabel}.`}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {approved
            ? "Reopen the list to make changes. New collection remains paused until the list is approved again."
            : "Nothing is read until you approve this list."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {approved ? (
          <>
            <Button size="sm" variant="outline" onClick={reopen} disabled={pending}>
              <LockOpen size={14} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Edit list</span>
            </Button>
            <Button size="sm" onClick={() => router.push(`/runs/${runId}`)}>
              <span className="min-w-0 truncate">Open collection</span>
              <ArrowRight size={14} strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={approve} disabled={pending || keptCount === 0}>
            <ShieldCheck size={14} strokeWidth={1.8} />
            <span className="min-w-0 truncate">Approve list</span>
          </Button>
        )}
      </div>
    </div>
  );
}
