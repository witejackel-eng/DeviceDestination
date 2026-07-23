"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { durations, easings } from "@/lib/motion/constants";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(images[0]);
  const reduceMotion = useReducedMotion();
  const selectedIndex = images.indexOf(selected);
  const isSingle = images.length === 1;
  const move = (direction: number) => {
    const next = (selectedIndex + direction + images.length) % images.length;
    setSelected(images[next]);
  };
  return (
    <div>
      <motion.div
        className={`relative touch-pan-y overflow-hidden ${isSingle ? "aspect-[4/3]" : "aspect-square"}`}
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
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: durations.normal, ease: easings.standard }}
          >
            <Image
              src={selected}
              alt={alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-10 sm:p-16"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
          {images.map((image, index) => (
            <button
              type="button"
              key={image}
              onClick={() => setSelected(image)}
              className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[var(--radius-stage)] border-2 transition-all duration-150 ${selected === image ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-border)] scale-[1.04]" : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm"}`}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={selected === image}
            >
              <Image src={image} alt="" fill sizes="72px" className="object-contain p-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
