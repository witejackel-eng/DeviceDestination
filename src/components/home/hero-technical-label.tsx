"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HeroAnnotation } from "@/lib/home/hero-products";
import type { LabelAnchor, ResponsivePosition } from "@/lib/home/hero-media";

interface HeroTechnicalLabelProps {
  annotations: HeroAnnotation[];
  visible: boolean;
  stage: "identify" | "connect" | "resolve" | "introduction";
  /** Position of the primary product (% from left, % from top) */
  primaryPosition: ResponsivePosition;
  /** Visual scale of the primary product (0-1 of stage width) */
  primaryScale: number;
  /** Per-label anchor configuration */
  labelAnchors: Record<string, LabelAnchor>;
}

export function HeroTechnicalLabel({
  annotations,
  visible,
  stage,
  primaryPosition,
  primaryScale,
  labelAnchors,
}: HeroTechnicalLabelProps) {
  const reduceMotion = useReducedMotion();

  if (annotations.length === 0) return null;

  const isInResolve = stage === "resolve";

  // ── Calculate label positions relative to the primary dome ──
  // The dome occupies: left=primaryPosition.x%, top=primaryPosition.y%,
  // width=primaryScale*100%
  // Labels are placed around the dome boundary with hairline connectors

  const domeLeft = primaryPosition.x; // % from left edge
  const domeTop = primaryPosition.y;  // % from top edge
  const domeWidth = primaryScale * 100; // % of stage width

  // Helper to compute label position based on anchor side
  function getLabelPosition(label: string): { left: number; top: number } {
    const anchor = labelAnchors[label] ?? { side: "top-right", offsetX: 0, offsetY: 0, connectorLength: 0 };

    switch (anchor.side) {
      case "top-left":
        return {
          left: domeLeft + anchor.offsetX,
          top: domeTop + anchor.offsetY - 4, // slightly above the dome
        };
      case "top-right":
        return {
          left: domeLeft + domeWidth + anchor.offsetX + anchor.connectorLength,
          top: domeTop + anchor.offsetY,
        };
      case "bottom-right":
        return {
          left: domeLeft + domeWidth + anchor.offsetX + anchor.connectorLength,
          top: domeTop + domeWidth * 0.75 + anchor.offsetY,
        };
      case "bottom-left":
        return {
          left: domeLeft - anchor.connectorLength + anchor.offsetX - 28,
          top: domeTop + domeWidth * 0.75 + anchor.offsetY,
        };
      case "bottom":
        return {
          left: domeLeft + domeWidth / 2 + anchor.offsetX - 14,
          top: domeTop + domeWidth + anchor.offsetY + anchor.connectorLength,
        };
      default:
        return {
          left: domeLeft + domeWidth + 12,
          top: domeTop + 8,
        };
    }
  }

  // ── Connector line endpoint (where it touches the dome boundary) ──
  function getConnectorStart(label: string): { left: number; top: number } {
    const anchor = labelAnchors[label] ?? { side: "top-right", offsetX: 0, offsetY: 0, connectorLength: 0 };

    switch (anchor.side) {
      case "top-left":
        return {
          left: domeLeft + anchor.offsetX,
          top: domeTop + anchor.offsetY,
        };
      case "top-right":
        return {
          left: domeLeft + domeWidth + anchor.offsetX,
          top: domeTop + anchor.offsetY + 4,
        };
      case "bottom-right":
        return {
          left: domeLeft + domeWidth + anchor.offsetX,
          top: domeTop + domeWidth * 0.75 + anchor.offsetY,
        };
      case "bottom-left":
        return {
          left: domeLeft + anchor.offsetX,
          top: domeTop + domeWidth * 0.75 + anchor.offsetY,
        };
      case "bottom":
        return {
          left: domeLeft + domeWidth / 2 + anchor.offsetX,
          top: domeTop + domeWidth + anchor.offsetY,
        };
      default:
        return { left: domeLeft + domeWidth, top: domeTop + 8 };
    }
  }

  function getConnectorEnd(label: string): { left: number; top: number } {
    const pos = getLabelPosition(label);
    return { left: pos.left + 2, top: pos.top + 7 }; // Point to the label's left edge
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-[7]">
      {annotations.map((annotation, i) => {
        const labelPos = getLabelPosition(annotation.label);
        const connStart = getConnectorStart(annotation.label);
        const connEnd = getConnectorEnd(annotation.label);

        // Connector line length (diagonal distance)
        const dx = connEnd.left - connStart.left;
        const dy = connEnd.top - connStart.top;
        const lineLength = Math.sqrt(dx * dx + dy * dy);

        // Connector line angle
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <motion.div
            key={annotation.label}
            className="absolute"
            style={{
              left: `${labelPos.left}%`,
              top: `${labelPos.top}%`,
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{
              opacity: visible ? 1 : 0,
              scale: visible ? 1 : 0.8,
            }}
            transition={{
              duration: 0.35,
              delay: i * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Hairline connector from dome boundary to label */}
            {visible && lineLength > 3 && (
              <motion.div
                className="absolute"
                style={{
                  width: `${lineLength}px`,
                  height: "1px",
                  left: `${connStart.left - labelPos.left}%`,
                  top: `${(connStart.top - labelPos.top) * 1}%`,
                  background: "var(--text-muted)",
                  opacity: 0.35,
                  transformOrigin: "0 0",
                  transform: `rotate(${angle}deg)`,
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: visible ? 1 : 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 + 0.05 }}
              />
            )}

            {/* Orange endpoint dot */}
            {visible && (
              <motion.div
                className="absolute h-[4px] w-[4px] rounded-full bg-[var(--accent)]"
                style={{
                  left: `${connStart.left - labelPos.left}%`,
                  top: `${(connStart.top - labelPos.top) * 1}%`,
                  opacity: isInResolve ? 0.5 : 1,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: i * 0.06 }}
              />
            )}

            {/* Label pill */}
            <motion.div
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)]/90 px-2.5 py-1 backdrop-blur-[2px]"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 + 0.1 }}
            >
              <span
                className="font-mono text-[11px] font-semibold leading-none text-[var(--text-secondary)]"
                style={{ fontSize: isInResolve ? "10px" : "11px" }}
              >
                {annotation.label}
              </span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
