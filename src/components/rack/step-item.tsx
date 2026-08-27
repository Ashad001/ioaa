import Link from "next/link";

import { Lamp, type LampState } from "@/components/rack/plate";
import { cn } from "@/lib/utils";

const STATE_TO_LAMP: Record<string, LampState> = {
  pending: "cold",
  running: "hold",
  blocked_on_user: "hold",
  done: "done",
  failed: "alert",
};

const STATE_LABEL: Record<string, string> = {
  pending: "waiting",
  running: "running",
  blocked_on_user: "your turn",
  done: "done",
  failed: "failed",
};

export function StepItem({
  n,
  title,
  detail,
  state,
  actor,
  href,
  active = false,
}: {
  n: number;
  title: string;
  detail: string;
  state: string;
  actor: "auto" | "you";
  href?: string;
  active?: boolean;
}) {
  const lamp = STATE_TO_LAMP[state] ?? "cold";
  const body = (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2.5 border-l-[1px] px-4 py-2 transition-colors duration-200 ease-out",
        active
          ? "border-l-primary bg-sidebar-accent/70"
          : "border-l-transparent hover:bg-sidebar-accent/40",
      )}
    >
      <span className="mt-[7px] flex shrink-0 items-center">
        <Lamp state={lamp} pulsing={state === "running"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-[13px]",
              state === "pending" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {title}
          </span>
          <span className="tabular shrink-0 text-[10px] text-rack-seam">{String(n).padStart(2, "0")}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {state === "blocked_on_user" || (actor === "you" && state === "pending")
            ? "Your turn"
            : STATE_LABEL[state] === "done"
              ? detail
              : STATE_LABEL[state] ?? detail}
        </span>
      </span>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
