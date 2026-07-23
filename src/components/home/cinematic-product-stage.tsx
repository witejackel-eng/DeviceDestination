"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useRef } from "react";
import type { HeroProduct, HeroAnnotation } from "@/lib/home/hero-products";
import { entrance, pointerLimits, productTransforms, scrollStages } from "@/lib/home/hero-motion";
import { HeroTechnicalLabel } from "@/components/home/hero-technical-label";
import { HeroConnectionPath } from "@/components/home/hero-connection-path";

interface CinematicProductStageProps {
  heroProducts: HeroProduct[];
  annotations: HeroAnnotation[];
  scrollProgress: number; // 0-1 overall
  entranceComplete: boolean;
  isMobile: boolean;
}

type ScrollStage = "introduction" | "identify" | "connect" | "resolve";

function getScrollStage(progress: number): ScrollStage {
  if (progress < scrollStages.identify.start) return "introduction";
  if (progress < scrollStages.connect.start) return "identify";
  if (progress < scrollStages.resolve.start) return "connect";
  return "resolve";
}

function interpolateTransform(
  stage: ScrollStage,
  role: "primary" | "secondary" | "tertiary",
  progress: number
) {
  const transforms = productTransforms[role];
  const stageKeys: ScrollStage[] = ["introduction", "identify", "connect", "resolve"];

  // Find current stage index and next stage
  const currentIdx = stageKeys.indexOf(stage);
  const nextIdx = Math.min(currentIdx + 1, stageKeys.length - 1);

  // Calculate progress within current stage
  const stageConfig = scrollStages[stage];
  const stageProgress = Math.max(0, Math.min(1,
    (progress - stageConfig.start) / (stageConfig.end - stageConfig.start)
  ));

  const current = transforms[stage];
  const next = transforms[stageKeys[nextIdx]];

  // Simple lerp between current and next stage transforms
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const t = stageProgress;

  const getRotation = (obj: Record<string, number>) => ("rotation" in obj ? obj.rotation : 0) as number;
  const getOpacity = (obj: Record<string, number>) => ("opacity" in obj ? obj.opacity : 1) as number;

  return {
    x: lerp(current.x, next.x, t),
    y: lerp(current.y, next.y, t),
    scale: lerp(current.scale, next.scale, t),
    rotation: lerp(getRotation(current as Record<string, number>), getRotation(next as Record<string, number>), t),
    opacity: lerp(
      getOpacity(current as Record<string, number>),
      getOpacity(next as Record<string, number>),
      t
    ),
  };
}

export function CinematicProductStage({
  heroProducts,
  annotations,
  scrollProgress,
  entranceComplete,
  isMobile,
}: CinematicProductStageProps) {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  // Pointer interaction (desktop only)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isMobile) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Normalized offset from center (-0.5 to 0.5)
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(nx * pointerLimits.primary);
    mouseY.set(ny * pointerLimits.primary);
  }, [isMobile, mouseX, mouseY]);

  const handlePointerLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const primary = heroProducts.find(hp => hp.role === "primary");
  const secondary = heroProducts.find(hp => hp.role === "secondary");
  const tertiary = heroProducts.find(hp => hp.role === "tertiary");

  const currentStage = getScrollStage(scrollProgress);

  // Calculate product transforms
  const primaryTransform = interpolateTransform(currentStage, "primary", scrollProgress);
  const secondaryTransform = interpolateTransform(currentStage, "secondary", scrollProgress);
  const tertiaryTransform = interpolateTransform(currentStage, "tertiary", scrollProgress);

  // Annotations visible during identify stage
  const annotationsVisible = currentStage === "identify" || currentStage === "connect";

  // Connection paths visible during connect stage
  const connectionsVisible = currentStage === "connect" || currentStage === "resolve";
  const connectStageProgress = connectionsVisible
    ? Math.max(0, Math.min(1,
      (scrollProgress - scrollStages.connect.start) /
      (scrollStages.connect.end - scrollStages.connect.start)
    ))
    : 0;

  // Entrance animation initial states
  const primaryEntrance = entranceComplete || reduceMotion
    ? false
    : {
        opacity: 0,
        x: entrance.primaryProduct.translateX,
        y: entrance.primaryProduct.translateY,
        scale: entrance.primaryProduct.scale,
        rotate: entrance.primaryProduct.rotation,
      };

  const secondaryEntrance = entranceComplete || reduceMotion
    ? false
    : {
        opacity: 0,
        x: entrance.secondaryProduct.translateX,
        scale: entrance.secondaryProduct.scale,
        rotate: entrance.secondaryProduct.rotation,
      };

  const tertiaryEntrance = entranceComplete || reduceMotion
    ? false
    : {
        opacity: 0,
        x: entrance.tertiaryProduct.translateX,
        scale: entrance.tertiaryProduct.scale,
      };

  // Product positions (percentage-based for absolute positioning)
  const productPositions = {
    primary: { left: "5%", top: "8%", width: "55%", height: "55%" },
    secondary: { right: "3%", top: "5%", width: "38%", height: "38%" },
    tertiary: { bottom: "2%", left: "10%", width: "50%", height: "30%" },
  };

  return (
    <motion.div
      ref={stageRef}
      className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface-subtle)]"
      style={{ aspectRatio: isMobile ? "4/3" : "1.2/1" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="CCTV dome camera, bullet camera and NVR system"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: entrance.stageBg.duration / 1000 }}
    >
      {/* Subtle central radial lighting */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: "radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.18), transparent 65%)",
        }}
      />

      {/* Faint dot grid texture at 3-4% opacity */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--text-muted) 0.5px, transparent 0.5px)",
          backgroundSize: "12px 12px",
          opacity: 0.04,
        }}
      />

      {/* Primary dome camera — largest */}
      {primary && (
        <motion.div
          className="absolute z-[4]"
          style={{
            left: productPositions.primary.left,
            top: productPositions.primary.top,
            width: productPositions.primary.width,
            height: productPositions.primary.height,
          }}
          initial={primaryEntrance}
          animate={{
            opacity: entranceComplete ? primaryTransform.opacity : 1,
            x: entranceComplete ? primaryTransform.x : 0,
            y: entranceComplete ? primaryTransform.y : 0,
            scale: entranceComplete ? primaryTransform.scale : 1,
            rotate: entranceComplete ? primaryTransform.rotation : 0,
          }}
          transition={{
            duration: entranceComplete
              ? 0.6
              : entrance.primaryProduct.duration / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Contact shadow beneath primary */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[12px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(17,18,20,0.08), transparent 70%)",
            }}
          />
          <Image
            src={primary.product.images[0]}
            alt={`${primary.product.brand} ${primary.product.model}`}
            fill
            sizes="400px"
            className="object-contain p-[10%]"
            priority
          />

          {/* Lens highlight overlay for primary dome camera */}
          {entranceComplete && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-[5]"
              style={{
                background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
                borderRadius: "50%",
                clipPath: "circle(18% at 42% 40%)",
              }}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: entranceComplete ? 0.5 : 0 }}
              transition={{ duration: 1.2 }}
            />
          )}
        </motion.div>
      )}

      {/* Secondary bullet camera */}
      {secondary && (
        <motion.div
          className="absolute z-[3]"
          style={{
            right: productPositions.secondary.right,
            top: productPositions.secondary.top,
            width: productPositions.secondary.width,
            height: productPositions.secondary.height,
          }}
          initial={secondaryEntrance}
          animate={{
            opacity: entranceComplete ? secondaryTransform.opacity : 1,
            x: entranceComplete ? secondaryTransform.x : 0,
            scale: entranceComplete ? secondaryTransform.scale : 1,
            rotate: entranceComplete ? (secondaryTransform.rotation ?? 0) : 0,
          }}
          transition={{
            duration: entranceComplete
              ? 0.6
              : entrance.secondaryProduct.duration / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Contact shadow beneath secondary */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[8px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(17,18,20,0.06), transparent 70%)",
            }}
          />
          <Image
            src={secondary.product.images[0]}
            alt={`${secondary.product.brand} ${secondary.product.model}`}
            fill
            sizes="250px"
            className="object-contain p-[8%]"
            priority
          />
        </motion.div>
      )}

      {/* Tertiary NVR */}
      {tertiary && (
        <motion.div
          className="absolute z-[2]"
          style={{
            bottom: productPositions.tertiary.bottom,
            left: productPositions.tertiary.left,
            width: productPositions.tertiary.width,
            height: productPositions.tertiary.height,
          }}
          initial={tertiaryEntrance}
          animate={{
            opacity: entranceComplete ? tertiaryTransform.opacity : 1,
            x: entranceComplete ? tertiaryTransform.x : 0,
            y: entranceComplete ? tertiaryTransform.y : 0,
            scale: entranceComplete ? tertiaryTransform.scale : 1,
          }}
          transition={{
            duration: entranceComplete
              ? 0.6
              : entrance.tertiaryProduct.duration / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Contact shadow beneath tertiary */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[10px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(17,18,20,0.07), transparent 70%)",
            }}
          />
          <Image
            src={tertiary.product.images[0]}
            alt={`${tertiary.product.brand} ${tertiary.product.model}`}
            fill
            sizes="350px"
            className="object-contain p-[5%_8%]"
            priority
          />
        </motion.div>
      )}

      {/* Technical annotation labels */}
      <HeroTechnicalLabel
        annotations={annotations}
        visible={annotationsVisible}
        stage={currentStage}
      />

      {/* SVG connection paths */}
      {connectionsVisible && (
        <HeroConnectionPath
          scrollProgress={connectStageProgress}
          visible={connectionsVisible}
          primaryProductCenter={{ x: 0.25, y: 0.35 }}
          tertiaryProductCenter={{ x: 0.35, y: 0.82 }}
          secondaryProductCenter={{ x: 0.78, y: 0.22 }}
        />
      )}
    </motion.div>
  );
}
