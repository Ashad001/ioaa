"use client";

/**
 * The handoff controls.
 *
 * The server builds the file and hands back a string; this saves it. No route,
 * no fetch — the same rule the whole app runs on.
 */
import { useTransition } from "react";
import { FileText, Sheet } from "lucide-react";
import { toast } from "sonner";

import { exportBrief, exportSheet } from "@/app/actions/deliver";
import { Button } from "@/components/ui/button";

function save(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();

  const run = (kind: "brief" | "sheet") =>
    startTransition(async () => {
      const result = kind === "brief" ? await exportBrief(runId) : await exportSheet(runId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      save(result.filename, result.content, kind === "brief" ? "text/plain" : "text/csv");
      toast.success(`${result.filename} saved.`);
    });

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run("brief")}>
        <FileText size={14} strokeWidth={1.6} />
        <span className="min-w-0 truncate">Download the brief</span>
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("sheet")}>
        <Sheet size={14} strokeWidth={1.6} />
        <span className="min-w-0 truncate">Download the sheet</span>
      </Button>
    </div>
  );
}
