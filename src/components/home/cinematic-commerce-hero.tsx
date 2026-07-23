"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion, useSpring, AnimatePresence } from "motion/react";
import { ArrowRight, Scale, ChevronDown } from "lucide-react";
import { ProductSearch } from "@/components/product-search";
import { CinematicProductStage } from "@/components/home/cinematic-product-stage";
import type { HeroProduct, HeroAnnotation } from "@/lib/home/hero-products";
import { entrance, scrollStages, heroSprings } from "@/lib/home/hero-motion";

interface CinematicCommerceHeroProps {
  heroProducts: HeroProduct[];
  annotations: HeroAnnotation[];
}

// Determine viewport breakpoint for responsive behavior
function useViewportBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w < 768) {
        setBreakpoint("mobile");
      } else if (w < 1024) {
        setBreakpoint(h >= 900 ? "tablet" : "mobile");
      } else {
        setBreakpoint("desktop");
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return breakpoint;
}

export function CinematicCommerceHero({ heroProducts, annotations }: CinematicCommerceHeroProps) {
  const reduceMotion = useReducedMotion();
  const breakpoint = useViewportBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isDesktop = breakpoint === "desktop";

  // Entrance animation state — set via onAnimationComplete callback, not useEffect
  const [entranceComplete, setEntranceComplete] = useState(reduceMotion ? true : false);

  // Callback triggered when entrance animations complete
  const handleEntranceComplete = useCallback(() => {
    setEntranceComplete(true);
  }, []);

  // Scroll tracking for desktop/tablet
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Transform scroll progress (0-1) for use in the product stage
  const scrollProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // Animated scroll value for spring-based smoothing
  const smoothProgress = useSpring(scrollProgress, heroSprings.scroll);

  // Heading transitions — switch from initial to stage 3 heading during connect stage
  const headingOpacity1 = useTransform(scrollYProgress, [0, scrollStages.connect.start], [1, 0]);
  const headingOpacity2 = useTransform(scrollYProgress, [scrollStages.connect.start, scrollStages.connect.end], [0, 1]);

  // Scroll indicator fade out
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  // Search/CTAs opacity — always visible (never below 0.72)
  const searchCtaOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.85, 0.72]);

  // Current scroll progress value for stage calculations
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (isMobile) return;
    const unsubscribe = smoothProgress.on("change", (v: number) => setCurrentProgress(v));
    return () => unsubscribe();
  }, [smoothProgress, isMobile]);

  // Determine the current stage
  const getStage = useCallback((progress: number): "introduction" | "identify" | "connect" | "resolve" => {
    if (progress < scrollStages.identify.start) return "introduction";
    if (progress < scrollStages.connect.start) return "identify";
    if (progress < scrollStages.connect.end) return "connect";
    return "resolve";
  }, []);

  const currentStage = getStage(currentProgress);

  // ──────────────────────── MOBILE HERO ────────────────────────
  if (isMobile) {
    return (
      <section style={{ background: "var(--background)" }}>
        <div className="container-standard pt-10 pb-6">
          {/* Eyebrow */}
          <motion.p
            className="eyebrow"
            initial={reduceMotion ? false : { opacity: 0, y: entrance.eyebrow.translateY }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: entrance.eyebrow.duration / 1000, delay: entrance.eyebrow.delay / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            CCTV · NVR · BIOMETRICS · NETWORKING
          </motion.p>

          {/* Heading */}
          <motion.h1
            className="display-hero mt-5"
            initial={reduceMotion ? false : { opacity: 0, y: entrance.heading.translateY }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: entrance.heading.duration / 1000, delay: entrance.heading.delay / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            Security hardware, specified clearly.
          </motion.h1>

          {/* Supporting paragraph */}
          <motion.p
            className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-secondary)]"
            initial={reduceMotion ? false : { opacity: 0, y: entrance.copy.translateY }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: entrance.copy.duration / 1000, delay: entrance.copy.delay / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            Find exact cameras, recorders, biometric devices and networking hardware with GST-inclusive pricing, model-specific documents and secure checkout.
          </motion.p>

          {/* Search */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProductSearch variant="inline" className="mt-7" />
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            className="mt-5 flex flex-wrap gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link href="/products" className="button-primary">
              Shop all products <ArrowRight size={16} />
            </Link>
            <Link href="/compare" className="button-secondary">
              Compare models <Scale size={16} />
            </Link>
          </motion.div>

          {/* Product composition */}
          <motion.div
            className="mt-8"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <CinematicProductStage
              heroProducts={heroProducts}
              annotations={annotations}
              scrollProgress={0}
              entranceComplete={true}
              isMobile={true}
            />
          </motion.div>

          {/* Confidence line */}
          <motion.p
            className="mt-5 text-sm text-[var(--text-muted)]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            Exact-model documentation · GST-inclusive pricing · OEM warranty support
          </motion.p>
        </div>
      </section>
    );
  }

  // ──────────────────────── DESKTOP/TABLET HERO ────────────────────────

  const wrapperHeight = isDesktop
    ? "185svh"
    : "120svh";

  // Entrance animation duration for the copy (last entrance element)
  const copyEntranceDuration = entrance.copy.duration / 1000;
  const copyEntranceDelay = entrance.copy.delay / 1000;

  return (
    <section style={{ background: "var(--background)" }}>
      <div
        ref={heroRef}
        style={{ height: wrapperHeight }}
        className="relative"
      >
        {/* Sticky viewport stage */}
        <motion.div
          className="sticky top-[var(--header-height)] flex items-start lg:items-center gap-12 pt-8 pb-4 lg:pt-0 lg:pb-0 container-standard"
          style={{ minHeight: "calc(100svh - var(--header-height))" }}
        >
          {/* Left: Copy + Search + CTAs */}
          <div className="lg:max-w-[52%] flex-shrink-0">
            {/* Eyebrow */}
            <motion.p
              className="eyebrow"
              initial={reduceMotion ? false : { opacity: 0, y: entrance.eyebrow.translateY }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: entrance.eyebrow.duration / 1000, delay: entrance.eyebrow.delay / 1000, ease: [0.22, 1, 0.36, 1] }}
            >
              CCTV · NVR · BIOMETRICS · NETWORKING
            </motion.p>

            {/* Heading — transitions between initial and Stage 3 */}
            <div className="mt-5 relative">
              {/* Stage 1 heading */}
              <motion.h1
                className="display-hero"
                style={{ opacity: headingOpacity1 }}
              >
                Security hardware, specified clearly.
              </motion.h1>

              {/* Stage 3 heading */}
              <motion.h1
                className="display-hero absolute inset-0"
                style={{ opacity: headingOpacity2 }}
              >
                Camera. Recorder. Network. Matched exactly.
              </motion.h1>
            </div>

            {/* Supporting paragraph — transitions between initial and Stage 3 */}
            <div className="mt-7 relative">
              {/* Initial paragraph */}
              <motion.p
                className="max-w-xl text-lg leading-8 text-[var(--text-secondary)]"
                style={{ opacity: headingOpacity1 }}
              >
                Find exact cameras, recorders, biometric devices and networking hardware with GST-inclusive pricing, model-specific documents and secure checkout.
              </motion.p>

              {/* Stage 3 paragraph */}
              <motion.p
                className="max-w-xl text-lg leading-8 text-[var(--text-secondary)] absolute inset-0"
                style={{ opacity: headingOpacity2 }}
              >
                Compare compatibility, resolution, night vision, PoE support, storage and model-specific documentation before ordering.
              </motion.p>
            </div>

            {/* Search + CTAs — always visible */}
            <motion.div
              style={{ opacity: searchCtaOpacity }}
            >
              <ProductSearch variant="inline" className="mt-8" />

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/products" className="button-primary">
                  Shop all products <ArrowRight size={16} />
                </Link>
                <Link href="/compare" className="button-secondary">
                  Compare models <Scale size={16} />
                </Link>
              </div>

              {/* Confidence / resolve line — fires entranceComplete callback on animation end */}
              <motion.p
                className="mt-5 text-sm text-[var(--text-muted)]"
                initial={reduceMotion ? false : { opacity: 0, y: entrance.copy.translateY }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: copyEntranceDuration, delay: copyEntranceDelay, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={handleEntranceComplete}
              >
                {currentStage === "resolve"
                  ? "Choose a category or search an exact model."
                  : "Exact-model documentation · GST-inclusive pricing · OEM warranty support"}
              </motion.p>
            </motion.div>
          </div>

          {/* Right: Product stage */}
          <motion.div
            className="relative mt-8 lg:mt-0 lg:w-[48%] flex-shrink-0"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: entrance.primaryProduct.duration / 1000, delay: entrance.primaryProduct.delay / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            <CinematicProductStage
              heroProducts={heroProducts}
              annotations={annotations}
              scrollProgress={currentProgress}
              entranceComplete={entranceComplete}
              isMobile={false}
            />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <AnimatePresence>
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[var(--text-muted)] z-20"
            style={{ opacity: scrollIndicatorOpacity }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs font-semibold tracking-wide uppercase">Scroll to see how it connects</p>
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown size={16} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
