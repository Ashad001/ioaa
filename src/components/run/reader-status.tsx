/**
 * READER STATUS — the honest banner, shown BEFORE a run rather than after it.
 *
 * WHY THIS EXISTS. Until now the app only admitted the ad reader wasn't
 * connected once a collection had already run and come back with nothing. That
 * is the worst possible moment to say it: the user has watched a progress lamp
 * for forty seconds, believed the app was working, and then received what reads
 * like a failure. The information existed the whole time.
 *
 * So the state is read on the server and stated at the top of the two screens
 * where someone is about to start or watch a collection. It is deliberately not
 * a modal and not a blocker — everything else in the app still works, the
 * hand-added path still works, and a run still records its stages honestly.
 *
 * It is a SERVER component and takes the state as a prop. The key itself never
 * comes near the browser; only the boolean does.
 */
import { PlugZap } from "lucide-react";

export function ReaderStatus({
  connected,
  context = "start",
}: {
  connected: boolean;
  /** Where the banner sits, which changes only the second sentence. */
  context?: "start" | "run";
}) {
  if (connected) return null;

  return (
    <div className="flex min-w-0 items-start gap-3 border-l-2 border-lamp-alert/70 bg-lamp-alert/[0.07] px-3.5 py-3">
      <PlugZap size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-lamp-alert" />
      <div className="min-w-0">
        <p className="min-w-0 text-[13px] font-medium leading-relaxed text-foreground">
          The ad reader isn&rsquo;t connected yet
        </p>
        <p className="mt-1 max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {context === "start"
            ? "Until it is, searches come back unread — so AdMirror will say so plainly instead of telling you nobody advertises in your market. Everything else works: you can still set a run up, add the rivals you know, and enter ads you have seen yourself."
            : "That is why nothing was read. It is a missing connection, not an empty market — no result on this screen means your rivals have stopped advertising. You can still add ads you have seen yourself, and they rank exactly the same way."}
        </p>
      </div>
    </div>
  );
}
