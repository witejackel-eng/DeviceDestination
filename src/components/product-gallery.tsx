"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(images[0]);
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--canvas-alt)]">
        <Image
          src={selected}
          alt={alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain p-7 sm:p-12"
        />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
          {images.map((image, index) => (
            <button
              type="button"
              key={image}
              onClick={() => setSelected(image)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border ${selected === image ? "border-[var(--tangerine)]" : "border-[var(--line)]"}`}
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
