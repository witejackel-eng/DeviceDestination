"use client";

import { motion, useReducedMotion } from "motion/react";

interface HeroConnectionPathProps {
  scrollProgress: number; // 0–1 within the "connect" stage
  visible: boolean;
  /** Viewport-relative coordinates for the SVG path endpoints */
  primaryProductCenter: { x: number; y: number };
  tertiaryProductCenter: { x: number; y: number };
  secondaryProductCenter: { x: number; y: number };
}

export function HeroConnectionPath({
  scrollProgress,
  visible,
  primaryProductCenter,
  tertiaryProductCenter,
  secondaryProductCenter,
}: HeroConnectionPathProps) {
  const reduceMotion = useReducedMotion();

  // Pulse is triggered once when scroll progress exceeds threshold.
  // Derive directly from scroll progress — no state or ref needed.
  // The pulse animation only fires once (motion animate does not loop).
  const pulseTriggered = scrollProgress > 0.3;

  if (!visible) return null;

  // Calculate path drawing progress (0-1 within connect stage)
  const drawProgress = reduceMotion ? 1 : Math.min(1, scrollProgress * 1.5);

  // SVG viewBox dimensions (using a normalized coordinate system)
  const viewBoxWidth = 100;
  const viewBoxHeight = 80;

  // Convert percentage-based positions to viewBox coordinates
  const p1x = primaryProductCenter.x * viewBoxWidth;
  const p1y = primaryProductCenter.y * viewBoxHeight;
  const p2x = secondaryProductCenter.x * viewBoxWidth;
  const p2y = secondaryProductCenter.y * viewBoxHeight;
  const nvrX = tertiaryProductCenter.x * viewBoxWidth;
  const nvrY = tertiaryProductCenter.y * viewBoxHeight;

  // Create curved paths from cameras to NVR
  const domeToNvrPath = `M ${p1x} ${p1y} C ${p1x + 5} ${p1y + 10}, ${nvrX - 10} ${nvrY - 5}, ${nvrX} ${nvrY}`;
  const bulletToNvrPath = `M ${p2x} ${p2y} C ${p2x - 3} ${p2y + 8}, ${nvrX + 10} ${nvrY - 4}, ${nvrX} ${nvrY}`;

  // Path length estimation for dash reveal
  const estimatedPathLength = 80;

  // Pulse position along the path (0-1)
  const pulsePosition = pulseTriggered ? Math.min(1, scrollProgress * 0.8) : 0;

  return (
    <motion.svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[6]"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="none"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: visible ? 0.6 : 0 }}
      transition={{ duration: 0.5 }}
      aria-hidden="true"
    >
      {/* Dome camera → NVR connection */}
      <motion.path
        d={domeToNvrPath}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeDasharray={estimatedPathLength}
        strokeDashoffset={estimatedPathLength * (1 - drawProgress)}
        initial={reduceMotion ? false : { strokeDashoffset: estimatedPathLength }}
        animate={{ strokeDashoffset: estimatedPathLength * (1 - drawProgress) }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Bullet camera → NVR connection */}
      <motion.path
        d={bulletToNvrPath}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeDasharray={estimatedPathLength}
        strokeDashoffset={estimatedPathLength * (1 - drawProgress)}
        initial={reduceMotion ? false : { strokeDashoffset: estimatedPathLength }}
        animate={{ strokeDashoffset: estimatedPathLength * (1 - drawProgress) }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Orange data pulse — dome → NVR */}
      {pulseTriggered && (
        <motion.circle
          cx={p1x + (nvrX - p1x) * pulsePosition}
          cy={p1y + (nvrY - p1y) * pulsePosition}
          r="1.2"
          fill="var(--accent)"
          initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.2, 1],
            opacity: [0, 1, 0.5],
          }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      {/* Orange data pulse — bullet → NVR */}
      {pulseTriggered && (
        <motion.circle
          cx={p2x + (nvrX - p2x) * pulsePosition}
          cy={p2y + (nvrY - p2y) * pulsePosition}
          r="1.0"
          fill="var(--accent)"
          initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.0, 0.9],
            opacity: [0, 0.8, 0.4],
          }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </motion.svg>
  );
}
