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
 */
import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

const DARK = "#1D3045";

const LINKS = [
  { label: "VECTRUS ENERGY", active: true },
  { label: "VECTRUS UPSTREAM", active: false },
  { label: "VECTRUS MARKETS", active: false },
  { label: "VECTRUS SYSTEMS", active: false },
  { label: "VECTRUS+", active: false },
];

export function SceneNav({ isLight }: { isLight: boolean }) {
  const [entered, setEntered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const color = isLight ? "#ffffff" : DARK;

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
        {/* Mobile: hamburger. Desktop: the five properties. */}
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
          {LINKS.map((link, index) => (
            <a
              key={link.label}
              href="#"
              className="relative shrink-0 text-xs font-medium uppercase tracking-[0.15em] transition-opacity hover:opacity-70"
              style={entrance(index)}
            >
              {link.label}
              {link.active ? (
                <span
                  aria-hidden
                  className="absolute -bottom-3 left-0 w-full"
                  style={{ height: 2, background: color, transition: "background 500ms" }}
                />
              ) : null}
            </a>
          ))}
        </div>

        <div className="hidden min-w-0 items-center gap-8 sm:flex" style={entrance(5)}>
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.2em]">
            NEWS
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 20,
                height: 20,
                background: color,
                color: isLight ? DARK : "#ffffff",
                transition: "background 500ms, color 500ms",
              }}
            >
              <Info size={10} strokeWidth={2} />
            </span>
          </span>
          <span className="hidden shrink-0 text-xs font-medium uppercase tracking-[0.2em] lg:inline">
            MENU
          </span>
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
          <div className="flex justify-end px-6 pt-8 sm:px-8 sm:pt-12">
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
            {LINKS.map((link, index) => (
              <a
                key={link.label}
                href="#"
                onClick={() => setMenuOpen(false)}
                className={`min-w-0 py-3 text-2xl font-light uppercase tracking-wide transition-colors sm:text-3xl ${
                  link.active ? "text-white" : "text-white/60 hover:text-white"
                }`}
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${index * 60}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${index * 60}ms`,
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-8 px-8 pb-10 sm:px-12">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">NEWS</span>
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">CONTACT</span>
          </div>
        </div>
      </div>
    </>
  );
}
