"use client";

import { motion, useReducedMotion } from "motion/react";
import { durations, easings } from "@/lib/motion/constants";

export default function RouteTemplate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durations.fast, ease: easings.standard }}
    >
      {children}
    </motion.div>
  );
}
