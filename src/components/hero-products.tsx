"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { Product } from "@/lib/products";

const tiles = [
  "var(--peach)",
  "var(--sage)",
  "var(--sky)",
  "var(--sand)",
  "var(--tangerine-soft)",
  "#f1e4da",
  "#e8ede0",
  "#e6eef2",
];

export function HeroProducts({ products }: { products: Product[] }) {
  return (
    <div
      className="relative grid h-[540px] grid-cols-4 grid-rows-4 gap-3 lg:h-[690px]"
      aria-label="Selected product range"
    >
      {products.map((product, index) => {
        const positions = [
          "col-span-2 row-span-2",
          "col-span-2 row-span-1",
          "col-span-1 row-span-2",
          "col-span-1 row-span-1",
          "col-span-2 row-span-1",
          "col-span-1 row-span-1",
          "col-span-1 row-span-1",
          "col-span-2 row-span-1",
        ];
        return (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.5 }}
            className={`relative overflow-hidden rounded-[20px] border border-[var(--line)] ${positions[index]}`}
            style={{ background: tiles[index] }}
          >
            <Image
              src={product.images[0]}
              alt={`${product.brand} ${product.model}`}
              fill
              priority={index < 3}
              sizes="(max-width: 1024px) 40vw, 24vw"
              className="object-contain p-3 sm:p-5"
            />
            {index < 4 && (
              <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] sm:bottom-3 sm:left-3 sm:text-[10px]">
                {product.highlights[0]}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
