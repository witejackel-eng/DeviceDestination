"use client";

import { useEffect } from "react";
import { animate, stagger } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function HomeMotion() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const markAnimation = animate("[data-anime-hero-mark]", {
      scale: { from: 0.84 },
      rotate: { from: "-7deg" },
      duration: 520,
      ease: "out(4)",
    });
    const logoAnimations: ReturnType<typeof animate>[] = [];
    if (!sessionStorage.getItem("dd-logo-seen")) {
      const scope = "[data-anime-brand-mark]";
      logoAnimations.push(
        animate(`${scope} [data-dd-part="d-left"]`, {
          opacity: { from: 0, to: 1 },
          scale: { from: 0.8, to: 1 },
          translateX: { from: -6, to: 0 },
          duration: 480,
          ease: "out(3)",
        }),
        animate(`${scope} [data-dd-part="d-right"]`, {
          opacity: { from: 0, to: 1 },
          scale: { from: 0.8, to: 1 },
          translateX: { from: 6, to: 0 },
          delay: 70,
          duration: 480,
          ease: "out(3)",
        }),
        animate(`${scope} [data-dd-part="lens"]`, {
          opacity: { from: 0, to: 1 },
          scale: { from: 0.8, to: 1 },
          delay: 140,
          duration: 480,
          ease: "out(3)",
        }),
        animate(`${scope} [data-dd-part="node"]`, {
          opacity: { from: 0, to: 1 },
          scale: { from: 0.8, to: 1 },
          delay: stagger(40, { start: 160 }),
          duration: 480,
          ease: "out(3)",
        }),
      );
      sessionStorage.setItem("dd-logo-seen", "1");
    }

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const mobile = window.innerWidth < 768;
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .from("[data-hero-copy]", { y: mobile ? 12 : 20, duration: 0.58, stagger: 0.06 })
          .from(
            "[data-hero-visual]",
            { y: mobile ? 14 : 26, scale: 0.98, opacity: 0, duration: 0.68 },
            "-=0.34",
          );

        gsap.from("[data-home-category]", {
          y: mobile ? 10 : 18,
          opacity: 0,
          duration: 0.48,
          stagger: mobile ? 0.02 : 0.045,
          ease: "power2.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: "[data-gsap-categories]",
            start: "top 86%",
            once: true,
          },
        });

        gsap.from("[data-gsap-products] > .container-standard", {
          y: mobile ? 10 : 24,
          opacity: 0,
          duration: 0.58,
          ease: "power2.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: "[data-gsap-products]",
            start: "top 86%",
            once: true,
          },
        });

        gsap.from("[data-gsap-compare] > .container-standard", {
          y: mobile ? 10 : 22,
          opacity: 0,
          duration: 0.58,
          ease: "power2.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: "[data-gsap-compare]",
            start: "top 86%",
            once: true,
          },
        });
      });
      return () => context.revert();
    });

    return () => {
      markAnimation.revert();
      logoAnimations.forEach((animation) => animation.revert());
      media.revert();
    };
  }, []);

  return null;
}
