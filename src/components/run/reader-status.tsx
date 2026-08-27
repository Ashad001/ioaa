/**
 * READER STATUS — what the ad reader can do right now, stated up front.
 *
 * WHY THIS EXISTS. Collection used to depend on a connected read API, and when it
 * was missing every search came back unread. The worst version of that was
 * silent: the user watched a progress lamp, then got what looked like an empty
 * market. So this banner existed to name the missing connection early.
 *
 * WHAT CHANGED. AdMirror now reads the public Ad Library ITSELF, using a real
 * browser on its own server that clears Meta's bot check the same way a person's
 * browser does. There is nothing to connect and nothing to buy, so there is no
 * longer a broken state to warn about — which means this component renders
 * NOTHING in the normal case, deliberately.
 *
 * It still has one true thing to say, and only when asked: with the optional
 * read API connected, Meta's own published reach band comes through as well,
 * which sharpens the ranking. That is an upgrade, not a fix, so it is never shown
 * as a warning and never blocks anything.
 *
 * It is a SERVER component and takes the state as a prop. No key ever comes near
 * the browser; only the boolean does.
 */
import { Radio } from "lucide-react";

export function ReaderStatus({
  connected,
  context = "start",
  /**
   * Off by default. The automatic reader works with nothing connected, so
   * mentioning the optional upgrade on every screen would read as a problem.
   */
  showUpgrade = false,
}: {
  connected: boolean;
  context?: "start" | "run";
  showUpgrade?: boolean;
}) {
  // The reader always works now. Silence is the correct output.
  if (connected || !showUpgrade) return null;

  return (
    <div className="flex min-w-0 items-start gap-3 border-l-2 border-border bg-card/40 px-3.5 py-3">
      <Radio size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="min-w-0 text-[13px] font-medium leading-relaxed text-foreground">
          Reading the Ad Library directly
        </p>
        <p className="mt-1 max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {context === "start"
            ? "AdMirror opens the public Ad Library itself and reads your rivals' live ads — copy, artwork and video included. Nothing to connect."
            : "These ads were read straight from the public Ad Library. Meta publishes no spend or click figure for commercial ads, so none appears here — only what the page itself shows."}
        </p>
      </div>
    </div>
  );
}
