"use client";

import { useEffect } from "react";
import { animate, stagger } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const brandAnimation = animate("[data-anime-brand]", {
      scale: { from: 0.82 },
      rotate: { from: "-7deg" },
      duration: 720,
      delay: stagger(75),
      ease: "out(3)",
    });

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-gsap-reveal]").forEach((section) => {
        gsap.from(section, {
          y: 34,
          duration: 0.72,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 88%",
            once: true,
          },
        });
      });
    });

    return () => {
      brandAnimation.revert();
      context.revert();
    };
  }, []);

  return null;
}
