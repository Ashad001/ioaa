"use client";

/**
 * SCROLL-TIED VIDEO SECTION — the front door for IOAA.AI.
 *
 * One 500vh track, one sticky full-viewport scene. The film underneath is never
 * played — scroll drives the playhead (see `useVideoScrub`), and three text beats
 * fade through in strict sequence: each is fully gone before the next begins, so
 * two headlines are never legible at once.
 *
 * The copy is the PRODUCT's, not placeholder: beat 1 says what it does, beat 2 how
 * it works, beat 3 is the sign-in itself. Nothing here promises a metric the app
 * cannot show — Meta publishes reach ranges, not spend or sales.
 *
 * Copy sits directly on the footage with no scrim or gradient: the early frames
 * are pale cloud, which carries navy type, and the later frames are dark, which
 * carry white. The nav inverts at the same crossover.
 */
import Link from "next/link";
import { ArrowDown, ArrowRight, ChevronUp } from "lucide-react";

import { SceneNav } from "@/components/scene/scene-nav";
import { SceneSignIn } from "@/components/scene/scene-sign-in";
import { Stagger } from "@/components/scene/stagger";
import { useVideoScrub } from "@/lib/scroll-scene/use-video-scrub";

const DARK = "#1D3045";
const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4";

const STEPS = [
  "Give it your website",
  "Approve the rival list",
  "Read the live ads",
  "Turn one angle into your own",
];

export function ScrollScene({
  googleEnabled,
  signedIn = false,
}: {
  googleEnabled: boolean;
  signedIn?: boolean;
}) {
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

  const toBeat = (fraction: number) => {
    const node = containerRef.current;
    if (!node) return;
    window.scrollTo({
      top: node.offsetTop + (node.offsetHeight - window.innerHeight) * fraction,
      behavior: "smooth",
    });
  };

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
          <SceneNav
            isLight={p > 0.55}
            signedIn={signedIn}
            onSignIn={() => toBeat(0.82)}
            onBeat={toBeat}
          />

          {/* ── 1. What it does ─────────────────────────────────────────── */}
          <section
            className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8 md:px-20 lg:px-32"
            style={section(s1Opacity)}
          >
            <Stagger show={s1Opacity > 0.3} delay={0}>
              <h1
                className="max-w-[20ch] font-light uppercase"
                style={{
                  fontSize: "clamp(2rem, 5vw, 5rem)",
                  lineHeight: 1.2,
                  color: DARK,
                }}
              >
                See the ads your market is running right now
              </h1>
            </Stagger>
            <Stagger show={s1Opacity > 0.3} delay={150} className="mt-6">
              <p
                className="text-sm uppercase tracking-[0.3em]"
                style={{ color: "#1D304590" }}
              >
                Rival creative, read from where it is published
              </p>
            </Stagger>
            <Stagger show={s1Opacity > 0.3} delay={280} className="mt-8">
              <p
                className="max-w-[56ch] text-[15px] leading-relaxed"
                style={{ color: "#1D3045B3" }}
              >
                Start with your website. IOAA.AI maps the advertisers around you,
                keeps the proof attached to every finding, and helps you turn a
                chosen angle into original creative of your own.
              </p>
            </Stagger>

            <Stagger
              show={s1Opacity > 0.3}
              delay={420}
              className="pointer-events-auto absolute bottom-12 right-6 sm:right-8 md:right-12"
            >
              <button
                type="button"
                aria-label="How it works"
                onClick={() => toBeat(0.46)}
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

          {/* ── 2. How it works ─────────────────────────────────────────── */}
          <section
            className="absolute inset-0 flex items-center justify-center px-6 sm:px-8"
            style={section(s2Opacity)}
          >
            <div className="w-full max-w-[900px]">
              <Stagger show={s2Opacity > 0.3} delay={0}>
                <h2
                  className="text-center font-extralight uppercase tracking-wide"
                  style={{
                    fontSize: "clamp(1.5rem, 4vw, 3.75rem)",
                    lineHeight: 1.3,
                    color: DARK,
                  }}
                >
                  Nothing is read{" "}
                  <span style={{ color: "#1D3045CC" }}>until you approve</span>{" "}
                  <span style={{ color: "#1D304580" }}>the rival list</span>
                </h2>
              </Stagger>

              <Stagger show={s2Opacity > 0.3} delay={180} className="mt-12">
                <ol className="grid gap-px sm:grid-cols-4" style={{ background: "#1D304526" }}>
                  {STEPS.map((step, index) => (
                    <li
                      key={step}
                      className="min-w-0 px-4 py-5"
                      style={{ background: "rgba(255,255,255,0.55)" }}
                    >
                      <span
                        className="block text-[10px] uppercase tracking-[0.24em]"
                        style={{ color: "#1D304580" }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="mt-2.5 block text-[14px] leading-snug"
                        style={{ color: DARK }}
                      >
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </Stagger>

              <Stagger show={s2Opacity > 0.3} delay={340} className="mt-6">
                <p
                  className="mx-auto max-w-[62ch] text-center text-[12.5px] leading-relaxed"
                  style={{ color: "#1D304599" }}
                >
                  Meta only publishes selected reach ranges. IOAA.AI does not
                  estimate spend, clicks, sales, or a performance score.
                </p>
              </Stagger>
            </div>

            <div className="absolute bottom-16 right-6 flex flex-col items-center gap-4 sm:right-8 md:right-12">
              <Stagger show={s2Opacity > 0.3} delay={200} className="pointer-events-auto">
                <button
                  type="button"
                  aria-label="Go to sign in"
                  onClick={() => toBeat(0.82)}
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
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
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

          {/* ── 3. Sign in, right here on the front door ────────────────── */}
          <section
            className="absolute inset-0 grid items-center gap-10 px-6 py-24 sm:px-8 md:px-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-20 lg:px-32"
            style={section(s3Opacity)}
          >
            <div className="min-w-0 max-w-2xl">
              <Stagger show={s3Opacity > 0.3} delay={0}>
                <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-white/60">
                  IOAA.AI
                </p>
              </Stagger>
              <Stagger show={s3Opacity > 0.3} delay={150}>
                <h2
                  className="font-light uppercase tracking-wide text-white"
                  style={{ fontSize: "clamp(1.75rem, 3.4vw, 3.25rem)", lineHeight: 1.2 }}
                >
                  Start with your
                  <br />
                  first analysis.
                </h2>
              </Stagger>
              <Stagger show={s3Opacity > 0.3} delay={280}>
                <p className="mt-6 max-w-[46ch] text-[14.5px] leading-relaxed text-white/70">
                  Sign in and give it one website. You approve the rival list before
                  a single ad is read.
                </p>
              </Stagger>
            </div>

            <Stagger show={s3Opacity > 0.3} delay={380} className="min-w-0 justify-self-start lg:justify-self-end">
              {signedIn ? (
                <Link
                  href="/start"
                  className={`group flex min-w-0 items-center gap-4 ${
                    s3Opacity > 0.6 ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                >
                  <span className="min-w-0 truncate text-sm uppercase tracking-[0.28em] text-white/80 transition-colors group-hover:text-white">
                    Open your workspace
                  </span>
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#1D3045] transition-transform duration-300 group-hover:scale-110"
                  >
                    <ArrowRight size={16} strokeWidth={1.6} />
                  </span>
                </Link>
              ) : (
                <SceneSignIn active={s3Opacity > 0.6} googleEnabled={googleEnabled} />
              )}
            </Stagger>
          </section>
        </div>
      </div>
    </div>
  );
}
