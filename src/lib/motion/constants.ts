import type { Transition } from "motion/react";

export const durations = {
  fast: 0.18,
  normal: 0.32,
  slow: 0.65,
  cinematic: 1.1,
} as const;

export const easings = {
  standard: [0.22, 1, 0.36, 1],
  enter: [0.16, 1, 0.3, 1],
} as const;

export const springs = {
  interface: { type: "spring", stiffness: 340, damping: 30, mass: 0.85 },
  drawer: { type: "spring", stiffness: 280, damping: 32, mass: 0.9 },
} satisfies Record<string, Transition>;

// Ownership rule: Motion handles React state/layout, GSAP owns scroll/hero timelines,
// and Anime.js owns the DD mark and SVG line micro-choreography.
