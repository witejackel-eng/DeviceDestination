import type { Transition } from "motion/react";

/**
 * Motion tokens, kept in step with the custom properties in `globals.css`.
 * Values are measured from the reference implementation — see
 * `docs/feedforge-reference-audit.md` §4.
 *
 * Seconds here, milliseconds in CSS: Motion takes seconds, CSS transitions take
 * a time unit. The two must be changed together.
 *
 * This module holds tokens only. The reusable motion primitives that consume
 * them arrive in the motion-consolidation phase, which is also when GSAP and
 * Anime.js are retired in favour of Motion.
 */

export const durations = {
  /** Hover, focus, press. CSS: --dur-micro */
  micro: 0.18,
  /** Menus, popovers, small state changes. CSS: --dur-enter */
  enter: 0.45,
  /** Cards and content blocks entering. CSS: --dur-content */
  content: 0.55,
  /** Hero and major compositions. CSS: --dur-hero */
  hero: 0.75,

  /** @deprecated Use `micro`. Retained so existing call sites keep compiling. */
  fast: 0.18,
  /** @deprecated Use `enter`. */
  normal: 0.32,
  /** @deprecated Use `content`. */
  slow: 0.65,
  /** @deprecated Use `hero`. */
  cinematic: 1.1,
} as const;

/** Interval between staggered children. CSS: --stagger */
export const staggerSeconds = 0.07;

export const easings = {
  /** easeOutQuint — the primary transform curve. CSS: --ease-out-quint */
  outQuint: [0.23, 1, 0.32, 1],
  /** easeOutExpo — entrances. CSS: --ease-out-expo */
  outExpo: [0.16, 1, 0.3, 1],
  /** Sharp in-out for sliding panels and menus. CSS: --ease-panel */
  panel: [0.32, 0.72, 0, 1],
  /** Accelerating in-out, for width/position morphs. CSS: --ease-sharp */
  sharp: [0.4, 0.4, 0, 1],
  /**
   * General-purpose ease-out already in use across the project. Kept at its
   * existing value so this phase changes no visible timing. CSS: --ease-standard
   */
  standard: [0.22, 1, 0.36, 1],

  /** @deprecated Use `outExpo`. Retained so existing call sites keep compiling. */
  enter: [0.16, 1, 0.3, 1],
} as const;

export const springs = {
  interface: { type: "spring", stiffness: 340, damping: 30, mass: 0.85 },
  drawer: { type: "spring", stiffness: 280, damping: 32, mass: 0.9 },
} satisfies Record<string, Transition>;
