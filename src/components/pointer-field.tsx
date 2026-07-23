"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";

type PointerFieldProps = {
  tone?: "light" | "dark";
  className?: string;
};

const COLUMNS = 7;
const ROWS = 5;

export function PointerField({ tone = "light", className }: PointerFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;

    const tick = () => {
      frameRef.current = null;
      if (!activeRef.current) return;
      const { x, y } = pointerRef.current;
      root.style.setProperty("--pf-x", `${(x * 100).toFixed(2)}%`);
      root.style.setProperty("--pf-y", `${(y * 100).toFixed(2)}%`);
      root.style.setProperty("--pf-tilt-x", `${((x - 0.5) * 6).toFixed(2)}deg`);
      root.style.setProperty("--pf-tilt-y", `${((y - 0.5) * -6).toFixed(2)}deg`);
    };

    const schedule = () => {
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.current = {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
      schedule();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        activeRef.current = entry.isIntersecting;
        if (activeRef.current) {
          window.addEventListener("pointermove", handlePointerMove, { passive: true });
        } else {
          window.removeEventListener("pointermove", handlePointerMove);
          if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
        }
      },
      { threshold: 0 },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const lineColor = tone === "dark" ? "var(--line-on-dark)" : "var(--border)";
  const nodeColor = tone === "dark" ? "var(--dark-muted)" : "var(--accent-border)";
  const verticalLines = Array.from({ length: COLUMNS + 1 }, (_, index) => (index / COLUMNS) * 100);
  const horizontalLines = Array.from({ length: ROWS + 1 }, (_, index) => (index / ROWS) * 100);

  return (
    <div ref={rootRef} aria-hidden="true" data-tone={tone} className={`pointer-field ${className ?? ""}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-field-grid">
        {verticalLines.map((x) => (
          <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={100} stroke={lineColor} strokeWidth="0.2" strokeDasharray="1.5 2.5" />
        ))}
        {horizontalLines.map((y) => (
          <line key={`h-${y}`} x1={0} y1={y} x2={100} y2={y} stroke={lineColor} strokeWidth="0.2" strokeDasharray="1.5 2.5" />
        ))}
        {verticalLines.slice(1, -1).map((x, xi) =>
          horizontalLines.slice(1, -1).map((y, yi) =>
            (xi + yi) % 2 === 0 ? <circle key={`n-${x}-${y}`} cx={x} cy={y} r="0.6" fill={nodeColor} /> : null,
          ),
        )}
      </svg>
      <div className="pointer-field-glow" />
    </div>
  );
}
