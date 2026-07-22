"use client";

import { useEffect } from "react";
import { animate } from "animejs";
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
    const pathAnimation = animate("[data-anime-hero-path]", {
      strokeDashoffset: { from: 650, to: 0 },
      duration: 1_200,
      delay: 120,
      ease: "inOut(3)",
    });

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const mobile = window.innerWidth < 768;
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .from("[data-hero-copy]", { y: mobile ? 12 : 20, duration: 0.58, stagger: 0.06 })
          .from(
            "[data-hero-product]",
            {
              y: (index) => (mobile ? 14 : index % 2 === 0 ? 34 : -24),
              rotate: (index) => (mobile ? 0 : index % 2 === 0 ? -2 : 2),
              scale: 0.97,
              opacity: 0,
              duration: 0.68,
              stagger: 0.05,
            },
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
      pathAnimation.revert();
      media.revert();
    };
  }, []);

  return null;
}
