"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useRef } from "react";
import type { HeroProduct, HeroAnnotation } from "@/lib/home/hero-products";
import { getHeroImage } from "@/lib/home/hero-products";
import {
  heroMediaRegistry,
  heroShadowConfigs,
  heroLabelAnchors,
  type HeroMediaRole,
} from "@/lib/home/hero-media";
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

  const currentIdx = stageKeys.indexOf(stage);
  const nextIdx = Math.min(currentIdx + 1, stageKeys.length - 1);

  const stageConfig = scrollStages[stage];
  const stageProgress = Math.max(0, Math.min(1,
    (progress - stageConfig.start) / (stageConfig.end - stageConfig.start)
  ));

  const current = transforms[stage];
  const next = transforms[stageKeys[nextIdx]];

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

  // Annotations visible during identify/connect stages only, hidden on mobile
  const annotationsVisible =
    (currentStage === "identify" || currentStage === "connect") && !isMobile;

  // Connection paths visible during connect/resolve stages, hidden on mobile
  const connectionsVisible =
    (currentStage === "connect" || currentStage === "resolve") && !isMobile;
  const connectStageProgress = connectionsVisible
    ? Math.max(0, Math.min(1,
      (scrollProgress - scrollStages.connect.start) /
      (scrollStages.connect.end - scrollStages.connect.start)
    ))
    : 0;

  // ── Product position config from hero-media registry ──
  const domeMedia = heroMediaRegistry.primary;
  const bulletMedia = heroMediaRegistry.secondary;
  const nvrMedia = heroMediaRegistry.tertiary;

  // On mobile: use only dome + NVR (bullet hidden per spec)
  const showBullet = !isMobile;

  // Responsive positioning: desktop uses hero-media positions, mobile uses simplified layout
  const getPosition = (role: HeroMediaRole) => {
    const media = heroMediaRegistry[role];
    if (isMobile) {
      return media.position.mobile;
    }
    // Use viewport width to decide tablet vs desktop
    // For simplicity, since we receive isMobile prop, desktop positions apply here
    return media.position.desktop;
  };

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

  // ── Shadow config per product ──
  const domeShadow = heroShadowConfigs.primary;
  const bulletShadow = heroShadowConfigs.secondary;
  const nvrShadow = heroShadowConfigs.tertiary;

  return (
    <motion.div
      ref={stageRef}
      className="relative overflow-hidden rounded-[18px] border border-[var(--border)]"
      style={{ aspectRatio: isMobile ? "4/3" : "1.2/1" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="CCTV dome camera, bullet camera and NVR system"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: entrance.stageBg.duration / 1000 }}
    >
      {/* ── Stage background ── */}
      {/* Base: #F1F2F4 with subtle radial light behind the dome */}
      <div
        className="absolute inset-0 z-[0]"
        style={{
          background: `radial-gradient(
            circle at 38% 34%,
            rgba(255,255,255,0.96) 0%,
            rgba(246,247,248,0.92) 38%,
            rgba(235,237,240,0.96) 100%
          )`,
        }}
      />

      {/* Lower grounding gradient — makes the NVR feel anchored */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `linear-gradient(
            to bottom,
            transparent 65%,
            rgba(17,18,20,0.025) 100%
          )`,
        }}
      />

      {/* Extremely subtle texture — no obvious dots */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(17,18,20,0.015) 0.4px, transparent 0.4px)",
          backgroundSize: "10px 10px",
          opacity: 1,
        }}
      />

      {/* ── PRIMARY: Dome camera ── */}
      {primary && (
        <motion.div
          className="absolute z-[4]"
          style={{
            left: `${getPosition("primary").x}%`,
            top: `${getPosition("primary").y}%`,
            width: `${domeMedia.visualScale * 100}%`,
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
          {/* Product-specific contact shadow */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: `${domeShadow.widthPercent}%`,
              height: `${domeShadow.heightPx}px`,
              bottom: `${domeShadow.bottomOffsetPx}px`,
              left: `${50 - domeShadow.widthPercent / 2 + domeShadow.leftOffsetPercent}%`,
              background: `radial-gradient(ellipse, rgba(17,18,20,${domeShadow.opacity}), transparent 70%)`,
              filter: `blur(${domeShadow.blurPx}px)`,
            }}
          />

          {/* Dome camera image — intrinsic aspect ratio, no forced square wrapper */}
          <Image
            src={getHeroImage(primary)}
            alt={`${primary.product.brand} ${primary.product.model}`}
            width={domeMedia.outputWidth}
            height={domeMedia.outputHeight}
            className="h-auto w-full object-contain"
            priority
          />

          {/* Lens highlight overlay — subtle glass reflection on dome lens */}
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

      {/* ── SECONDARY: Bullet camera — hidden on mobile ── */}
      {secondary && showBullet && (
        <motion.div
          className="absolute z-[3]"
          style={{
            left: `${getPosition("secondary").x}%`,
            top: `${getPosition("secondary").y}%`,
            width: `${bulletMedia.visualScale * 100}%`,
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
          {/* Product-specific contact shadow */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: `${bulletShadow.widthPercent}%`,
              height: `${bulletShadow.heightPx}px`,
              bottom: `${bulletShadow.bottomOffsetPx}px`,
              left: `${50 - bulletShadow.widthPercent / 2 + bulletShadow.leftOffsetPercent}%`,
              background: `radial-gradient(ellipse, rgba(17,18,20,${bulletShadow.opacity}), transparent 70%)`,
              filter: `blur(${bulletShadow.blurPx}px)`,
            }}
          />

          {/* Bullet camera image — intrinsic aspect ratio */}
          <Image
            src={getHeroImage(secondary)}
            alt={`${secondary.product.brand} ${secondary.product.model}`}
            width={bulletMedia.outputWidth}
            height={bulletMedia.outputHeight}
            className="h-auto w-full object-contain"
            priority
          />
        </motion.div>
      )}

      {/* ── TERTIARY: NVR ── */}
      {tertiary && (
        <motion.div
          className="absolute z-[2]"
          style={{
            left: `${getPosition("tertiary").x}%`,
            top: `${getPosition("tertiary").y}%`,
            width: `${nvrMedia.visualScale * 100}%`,
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
          {/* Product-specific contact shadow — wide and shallow for the NVR */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: `${nvrShadow.widthPercent}%`,
              height: `${nvrShadow.heightPx}px`,
              bottom: `${nvrShadow.bottomOffsetPx}px`,
              left: `${50 - nvrShadow.widthPercent / 2 + nvrShadow.leftOffsetPercent}%`,
              background: `radial-gradient(ellipse, rgba(17,18,20,${nvrShadow.opacity}), transparent 70%)`,
              filter: `blur(${nvrShadow.blurPx}px)`,
            }}
          />

          {/* NVR image — intrinsic aspect ratio, NO forced square wrapper */}
          <Image
            src={getHeroImage(tertiary)}
            alt={`${tertiary.product.brand} ${tertiary.product.model}`}
            width={nvrMedia.outputWidth}
            height={nvrMedia.outputHeight}
            className="h-auto w-full object-contain"
            priority
          />
        </motion.div>
      )}

      {/* ── Technical annotation labels ──
          Attached to the primary dome camera, not at the far-right edge. */}
      <HeroTechnicalLabel
        annotations={annotations}
        visible={annotationsVisible}
        stage={currentStage}
        primaryPosition={getPosition("primary")}
        primaryScale={domeMedia.visualScale}
        labelAnchors={heroLabelAnchors}
      />

      {/* ── SVG connection paths ── */}
      {connectionsVisible && (
        <HeroConnectionPath
          scrollProgress={connectStageProgress}
          visible={connectionsVisible}
          primaryProductCenter={{
            x: getPosition("primary").x / 100 + domeMedia.visualScale / 2,
            y: getPosition("primary").y / 100 + domeMedia.visualScale * (domeMedia.outputHeight / domeMedia.outputWidth) / 2,
          }}
          tertiaryProductCenter={{
            x: getPosition("tertiary").x / 100 + nvrMedia.visualScale / 2,
            y: getPosition("tertiary").y / 100 + (nvrMedia.outputHeight / nvrMedia.outputWidth * nvrMedia.visualScale) / 2,
          }}
          secondaryProductCenter={{
            x: getPosition("secondary").x / 100 + bulletMedia.visualScale / 2,
            y: getPosition("secondary").y / 100 + bulletMedia.visualScale * (bulletMedia.outputHeight / bulletMedia.outputWidth) / 2,
          }}
        />
      )}
    </motion.div>
  );
}
