"use client";

/**
 * The scene's navigation. Two things make it feel considered:
 *
 *  - It INVERTS with the film. The early frames are pale cloud, so the type is
 *    navy; past 55% of the scroll the footage has gone dark and everything turns
 *    white on a half-second colour transition.
 *  - It enters once, 200ms after mount, each link rising from -12px in sequence.
 *
 * Below the large breakpoint the links collapse into a hamburger that opens a
 * full-screen panel; the desk-width row is never allowed to wrap.
 *
 * The section names carry no destination of their own — this is a one-page front
 * door — so they scroll the scene to the beat they name rather than pretending to
 * be routes. "Sign in" goes to the card in the last beat; there is no separate
 * sign-in page.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, X } from "lucide-react";

const DARK = "#1D3045";

export function SceneNav({
  isLight,
  signedIn = false,
  onSignIn,
  onBeat,
}: {
  isLight: boolean;
  signedIn?: boolean;
  onSignIn: () => void;
  onBeat?: (fraction: number) => void;
}) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const color = isLight ? "#ffffff" : DARK;

  const SECTIONS = [
    { label: "What it reads", fraction: 0 },
    { label: "How it works", fraction: 0.46 },
    { label: signedIn ? "Your workspace" : "Sign in", fraction: 0.82 },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const go = (fraction: number) => {
    if (fraction >= 0.8) {
      // The last beat holds the sign-in card. Someone already signed in has no
      // use for it, so that entry becomes the workspace instead.
      if (signedIn) {
        router.push("/start");
        return;
      }
      onSignIn();
      return;
    }
    if (onBeat) {
      onBeat(fraction);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const entrance = (index: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "translateY(0)" : "translateY(-12px)",
    transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 80 + 100}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 80 + 100}ms`,
  });

  return (
    <>
      <nav
        aria-label="Main"
        className="pointer-events-auto absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 pt-8 pb-6 sm:px-8 sm:pt-12 md:px-12"
        style={{ color, transition: "color 500ms" }}
      >
        {/* Mobile: hamburger. Desktop: the wordmark and the sections. */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          className="flex shrink-0 flex-col lg:hidden"
          style={{ gap: 5, ...entrance(0) }}
        >
          <span style={{ width: 24, height: 2, background: color, transition: "background 500ms" }} />
          <span style={{ width: 24, height: 2, background: color, transition: "background 500ms" }} />
          <span style={{ width: 16, height: 2, background: color, transition: "background 500ms" }} />
        </button>

        <div className="hidden min-w-0 items-center gap-8 lg:flex xl:gap-10">
          <span
            className="shrink-0 text-xs font-semibold uppercase tracking-[0.22em]"
            style={entrance(0)}
          >
            IOAA.AI
          </span>
          {SECTIONS.slice(0, 2).map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.fraction)}
              className="min-w-0 shrink-0 truncate text-xs font-medium uppercase tracking-[0.15em] transition-opacity hover:opacity-70"
              style={entrance(index + 1)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 items-center gap-6 sm:gap-8" style={entrance(4)}>
          {signedIn ? (
            <Link
              href="/start"
              className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-70"
            >
              <span className="truncate">Your workspace</span>
              <ArrowUpRight size={13} strokeWidth={1.8} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-70"
            >
              <span className="truncate">Sign in</span>
              <ArrowDown size={13} strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="shrink-0 text-xs font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-70 lg:hidden"
          >
            MENU
          </button>
        </div>
      </nav>

      {/* Full-screen panel, mobile and tablet. */}
      <div
        className={`pointer-events-auto fixed inset-0 z-[100] ${menuOpen ? "visible opacity-100" : "invisible opacity-0"}`}
        style={{
          background: DARK,
          transition: "opacity 500ms cubic-bezier(0.4,0,0.2,1), visibility 500ms",
        }}
        aria-hidden={!menuOpen}
      >
        <div
          className="flex h-full flex-col"
          style={{
            transform: menuOpen ? "translateY(0)" : "translateY(-2rem)",
            transition: "transform 500ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="flex items-center justify-between px-6 pt-8 sm:px-8 sm:pt-12">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white">
              IOAA.AI
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:border-white"
              style={{ width: 40, height: 40 }}
            >
              <X size={18} strokeWidth={1.6} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center px-8 sm:px-12">
            {SECTIONS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  go(item.fraction);
                }}
                className="min-w-0 truncate py-3 text-left text-2xl font-light uppercase tracking-wide text-white sm:text-3xl"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${index * 60}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${index * 60}ms`,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="px-8 pb-10 sm:px-12">
            <p className="max-w-[46ch] text-[12px] leading-relaxed text-white/50">
              Rival ads read from where they are published. No spend, click or sales
              estimates.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
