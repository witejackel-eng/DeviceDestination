"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { durations, easings } from "@/lib/motion/constants";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(images[0]);
  const reduceMotion = useReducedMotion();
  const selectedIndex = images.indexOf(selected);
  const move = (direction: number) => {
    const next = (selectedIndex + direction + images.length) % images.length;
    setSelected(images[next]);
  };
  return (
    <div>
      <motion.div
        className="relative aspect-square touch-pan-y overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--canvas-alt)]"
        drag={!reduceMotion && images.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 48) move(info.offset.x < 0 ? 1 : -1);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            className="absolute inset-0"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: durations.normal, ease: easings.standard }}
          >
            <Image
              src={selected}
              alt={alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-[10%]"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
          {images.map((image, index) => (
            <button
              type="button"
              key={image}
              onClick={() => setSelected(image)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition-shadow ${selected === image ? "border-[var(--tangerine)] shadow-[0_0_0_2px_var(--tangerine-border)]" : "border-[var(--line)]"}`}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={selected === image}
            >
              <Image src={image} alt="" fill sizes="80px" className="object-contain p-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
