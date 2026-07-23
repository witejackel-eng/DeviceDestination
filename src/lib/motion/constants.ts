import type { Transition } from "motion/react";

export const durations = {
  fast: 0.18,
  normal: 0.32,
  slow: 0.65,
  cinematic: 1.1,
} as const;

export const easings = {
  standard: [0.22, 1, 0.36, 1] as [number, number, number, number],
  enter: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const;

export const springs = {
  interface: { type: "spring", stiffness: 340, damping: 30, mass: 0.85 },
  drawer: { type: "spring", stiffness: 280, damping: 32, mass: 0.9 },
  /** High-damping spring for floating panel entrances — no overshoot */
  panel: { type: "spring", stiffness: 320, damping: 34, mass: 0.85 },
} satisfies Record<string, Transition>;

// ── Modal animation timing ──
// These define entrance/exit sequences for menu and cart overlays.

export const modalTiming = {
  backdrop: {
    enter: { duration: 0.2, ease: easings.standard },
    exit: { duration: 0.16, ease: easings.standard },
  },
  panel: {
    enter: {
      duration: 0.38,
      ease: easings.standard,
    },
    exit: {
      duration: 0.22,
      ease: easings.standard,
    },
  },
  /** Stagger delay between individual nav links or cart items */
  stagger: 0.04, // 40ms
  /** Max number of items to individually animate (remaining animate as a group) */
  maxStaggerItems: 6,
  /** Close control delay after panel starts entering */
  closeDelay: 0.14, // 140ms
  /** Support panel / footer delay */
  secondaryDelay: 0.12, // 120ms
};

// Ownership rule: Motion handles React state/layout, GSAP owns scroll/hero timelines,
// and Anime.js owns the DD mark and SVG line micro-choreography.
