"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HeroAnnotation } from "@/lib/home/hero-products";

interface HeroTechnicalLabelProps {
  annotations: HeroAnnotation[];
  visible: boolean;
  stage: "identify" | "connect" | "resolve" | "introduction";
}

export function HeroTechnicalLabel({ annotations, visible, stage }: HeroTechnicalLabelProps) {
  const reduceMotion = useReducedMotion();

  if (annotations.length === 0) return null;

  const isInResolve = stage === "resolve";

  return (
    <motion.div
      className="absolute top-3 right-3 flex flex-col gap-1.5 z-10"
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : -6,
      }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {annotations.map((annotation, i) => (
        <motion.div
          key={annotation.label}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)]/90 px-2.5 py-1 backdrop-blur-[2px]"
          initial={reduceMotion ? false : { opacity: 0, x: 8 }}
          animate={{
            opacity: visible ? 1 : 0,
            x: visible ? 0 : 8,
          }}
          transition={{
            duration: 0.35,
            delay: i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Orange dot indicator */}
          <span
            className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--accent)]"
            style={{ opacity: isInResolve ? 0.5 : 1 }}
          />
          <span
            className="font-mono text-[11px] font-semibold leading-none text-[var(--text-secondary)]"
            style={{ fontSize: isInResolve ? "10px" : "11px" }}
          >
            {annotation.label}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
