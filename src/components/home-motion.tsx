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
      scale: { from: 0.72 },
      rotate: { from: "-11deg" },
      duration: 680,
      ease: "out(4)",
    });
    const pathAnimation = animate("[data-anime-hero-path]", {
      strokeDashoffset: { from: 650, to: 0 },
      duration: 1_450,
      delay: 180,
      ease: "inOut(3)",
    });

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline.from("[data-hero-copy]", { y: 26, duration: 0.72, stagger: 0.09 }).from(
          "[data-hero-product]",
          {
            y: (index) => (index % 2 === 0 ? 58 : -42),
            rotate: (index) => (index % 2 === 0 ? -3.5 : 3),
            scale: 0.94,
            opacity: 0,
            duration: 0.9,
            stagger: 0.07,
          },
          "-=0.46",
        );

        ScrollTrigger.batch("[data-gsap-reveal]", {
          start: "top 88%",
          once: true,
          onEnter: (elements) =>
            gsap.from(elements, {
              y: 32,
              duration: 0.68,
              stagger: 0.08,
              ease: "power3.out",
              clearProps: "transform",
            }),
        });

        gsap.utils.toArray<HTMLElement>("[data-hero-product]").forEach((product, index) => {
          gsap.to(product, {
            yPercent: index % 2 === 0 ? -7 : 6,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-commerce-hero]",
              start: "top top",
              end: "bottom top",
              scrub: 0.7,
            },
          });
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
