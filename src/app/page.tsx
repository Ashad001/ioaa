/**
 * "Scroll Tied Video Section" — the site's front door.
 *
 * A standalone cinematic one-page scene, deliberately outside the app shell: no
 * rack header, no nav rail, no tokens from the workspace palette. It is its own
 * site, and the only thing it shares with the rest of the project is the runtime.
 * The workspace itself lives at /start.
 *
 * The typeface is loaded with a plain <link> that React hoists into <head>, and it
 * is applied to this subtree only — the workspace keeps its own type.
 */
import type { Metadata } from "next";

import { ScrollScene } from "@/components/scene/scroll-scene";
import "./scene.css";

export const metadata: Metadata = {
  title: { absolute: "Scroll Tied Video Section" },
  description: "Advancing resources for a cleaner future.",
};

export default function HomePage() {
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
        <ScrollScene />
      </div>
    </>
  );
}
