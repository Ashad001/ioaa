/**
 * "IOAA.AI" — the site's front door.
 *
 * A standalone cinematic one-page scene, deliberately outside the app shell: no
 * rack header, no nav rail, no tokens from the workspace palette. It is its own
 * site, and the only thing it shares with the rest of the project is the runtime.
 * The workspace itself lives at /start.
 *
 * Signing in happens IN the scene's last beat rather than on a page of its own,
 * so the session is read here and handed down: a visitor who is already signed in
 * is offered the workspace instead of a form they do not need. The Google button
 * only appears when the platform actually has that provider wired.
 *
 * The typeface is loaded with a plain <link> that React hoists into <head>, and it
 * is applied to this subtree only — the workspace keeps its own type. The scene's
 * page-level rules (smooth scrolling, white ground) live in globals.css, scoped to
 * [data-scene-root] so they never leak into the workspace.
 */
import type { Metadata } from "next";

import { ScrollScene } from "@/components/scene/scroll-scene";
import { getUser, googleSignInEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "IOAA.AI — see the ads your market is running" },
  description:
    "Competitive ad intelligence read from what advertisers actually publish. Map the rivals around your website, keep the live ad beside every finding, and turn a chosen angle into original creative.",
};

export default async function HomePage() {
  const user = await getUser();

  return (
    <>
      <link
        href="https://db.onlinewebfonts.com/c/95cecf452d3208890088a5b4c19c7ecf?family=Helvetica+Neue+ME"
        rel="stylesheet"
      />
      <div
        data-scene-root
        style={{
          fontFamily:
            "'Helvetica Neue ME', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <ScrollScene signedIn={Boolean(user)} googleEnabled={googleSignInEnabled} />
      </div>
    </>
  );
}
