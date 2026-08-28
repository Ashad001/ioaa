"use client";

/**
 * SCROLL-TIED VIDEO SECTION.
 *
 * One 500vh track, one sticky full-viewport scene. The film underneath is never
 * played — scroll drives the playhead (see `useVideoScrub`), and three text beats
 * fade through in strict sequence: each is fully gone before the next begins, so
 * two headlines are never legible at once.
 *
 * Copy sits directly on the footage with no scrim or gradient: the early frames
 * are pale cloud, which carries navy type, and the later frames are dark, which
 * carry white. The nav inverts at the same crossover.
 */
import { ArrowDown, ArrowRight, ChevronUp } from "lucide-react";

import { SceneNav } from "@/components/scene/scene-nav";
import { Stagger } from "@/components/scene/stagger";
import { useVideoScrub } from "@/lib/scroll-scene/use-video-scrub";

const DARK = "#1D3045";
const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4";

export function ScrollScene() {
  const { containerRef, videoRef, canvasRef, scrollProgress: p, canvasLive } =
    useVideoScrub(VIDEO_SRC);

  // Sequential fades. Each beat holds, then clears in 0.08 of the track before
  // the next one starts to arrive.
  const s1Opacity = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08);
  const s2Opacity =
    p < 0.32
      ? 0
      : p < 0.4
        ? (p - 0.32) / 0.08
        : p < 0.55
          ? 1
          : Math.max(0, 1 - (p - 0.55) / 0.08);
  const s3Opacity = p < 0.67 ? 0 : p < 0.75 ? (p - 0.67) / 0.08 : 1;

  const section = (opacity: number) => ({
    opacity,
    transition: "opacity 0.1s ease-out",
  });

  return (
    <div ref={containerRef} className="relative h-[500vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: canvasLive ? 1 : 0 }}
        />

        <div className="pointer-events-none absolute inset-0">
          <SceneNav isLight={p > 0.55} />

          {/* ── 1. Hero ─────────────────────────────────────────────────── */}
          <section
            className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8 md:px-20 lg:px-32"
            style={section(s1Opacity)}
          >
            <Stagger show={s1Opacity > 0.3} delay={0}>
              <h1
                className="font-light uppercase"
                style={{
                  fontSize: "clamp(2rem, 5vw, 5rem)",
                  lineHeight: 1.2,
                  color: DARK,
                }}
              >
                Advancing resources for a cleaner future
              </h1>
            </Stagger>
            <Stagger show={s1Opacity > 0.3} delay={150} className="mt-6">
              <p
                className="text-sm uppercase tracking-[0.3em]"
                style={{ color: "#1D304590" }}
              >
                Sustainable power with purpose
              </p>
            </Stagger>

            <Stagger
              show={s1Opacity > 0.3}
              delay={300}
              className="pointer-events-auto absolute bottom-12 right-6 sm:right-8 md:right-12"
            >
              <button
                type="button"
                aria-label="Continue"
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                style={{
                  width: 48,
                  height: 48,
                  border: "1px solid #1D304580",
                  color: DARK,
                }}
              >
                <ArrowRight size={18} strokeWidth={1.5} />
              </button>
            </Stagger>
          </section>

          {/* ── 2. Statement ────────────────────────────────────────────── */}
          <section
            className="absolute inset-0 flex items-center justify-center px-6 sm:px-8"
            style={section(s2Opacity)}
          >
            <div className="w-full max-w-[900px]">
              <Stagger show={s2Opacity > 0.3} delay={0}>
                <h2
                  className="text-center font-extralight uppercase tracking-wide"
                  style={{
                    fontSize: "clamp(1.5rem, 4.5vw, 4.5rem)",
                    lineHeight: 1.3,
                    color: DARK,
                  }}
                >
                  We build lasting partnerships with vision{" "}
                  <span style={{ color: "#1D3045CC" }}>and precision</span>{" "}
                  <span style={{ color: "#1D304580" }}>across every frontier</span>
                </h2>
              </Stagger>
            </div>

            <div className="absolute bottom-16 right-6 flex flex-col items-center gap-4 sm:right-8 md:right-12">
              <Stagger show={s2Opacity > 0.3} delay={200} className="pointer-events-auto">
                <button
                  type="button"
                  aria-label="Next"
                  className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{
                    width: 48,
                    height: 48,
                    border: "1px solid #1D304566",
                    color: DARK,
                  }}
                >
                  <ArrowDown size={18} strokeWidth={1.5} />
                </button>
              </Stagger>

              <Stagger show={s2Opacity > 0.3} delay={350} className="mt-4">
                <div className="flex items-center gap-2">
                  <span
                    className="block rounded-full"
                    style={{ width: 8, height: 8, background: DARK }}
                  />
                  <span
                    className="block rounded-full"
                    style={{ width: 6, height: 6, background: "#1D304566" }}
                  />
                  <span
                    className="block rounded-full"
                    style={{ width: 6, height: 6, background: "#1D304566" }}
                  />
                </div>
              </Stagger>

              <Stagger show={s2Opacity > 0.3} delay={500} className="pointer-events-auto mt-2">
                <button
                  type="button"
                  aria-label="Back to top"
                  onClick={() => window.scrollTo({ top: 0 })}
                  className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid #1D30454D",
                    color: "#1D3045CC",
                  }}
                >
                  <ChevronUp size={16} strokeWidth={1.5} />
                </button>
              </Stagger>
            </div>
          </section>

          {/* ── 3. Sign-off, white type on the dark footage ─────────────── */}
          <section
            className="absolute inset-0 flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32"
            style={section(s3Opacity)}
          >
            <div className="max-w-2xl text-left">
              <Stagger show={s3Opacity > 0.3} delay={0}>
                <p className="mb-4 text-lg tracking-wide text-white/60">Halder | Nordvik</p>
              </Stagger>
              <Stagger show={s3Opacity > 0.3} delay={150}>
                <h2
                  className="mb-8 font-light uppercase tracking-wide text-white"
                  style={{ fontSize: "clamp(2rem, 4vw, 4rem)", lineHeight: 1.2 }}
                >
                  Fueling ambition,
                  <br />
                  shaping tomorrow.
                </h2>
              </Stagger>
              <Stagger show={s3Opacity > 0.3} delay={300}>
                <div className="pointer-events-auto flex items-center gap-4">
                  <span className="text-sm uppercase tracking-[0.3em] text-white/80">
                    Contact Nordvik
                  </span>
                  <button
                    type="button"
                    aria-label="Contact Nordvik"
                    className="flex items-center justify-center rounded-full bg-white text-gray-800 transition-transform duration-300 hover:scale-110"
                    style={{ width: 40, height: 40 }}
                  >
                    <ArrowRight size={16} strokeWidth={1.6} />
                  </button>
                </div>
              </Stagger>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
