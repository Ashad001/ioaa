"use client";

/**
 * The one entrance move used everywhere on the scroll scene: rise 24px and fade
 * in, on a long expo-out curve, offset by a per-child delay. A child becomes
 * visible when its section is more than 30% opaque, so the copy never animates in
 * while the section it belongs to is still fading out.
 */
import type { CSSProperties, ReactNode } from "react";

export function Stagger({
  show,
  delay = 0,
  className,
  style,
  children,
}: {
  show: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
