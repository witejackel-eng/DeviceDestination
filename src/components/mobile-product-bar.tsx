"use client";

import { motion, useReducedMotion } from "motion/react";
import { AddToCart } from "@/components/add-to-cart";
import { catalogue } from "@/data/catalog";
import { formatPrice } from "@/lib/products";
import { springs } from "@/lib/motion/constants";

export function MobileProductBar({ productId }: { productId: string }) {
  const product = catalogue.find((item) => item.id === productId);
  const reduceMotion = useReducedMotion();
  if (!product) return null;
  return (
    <motion.aside
      initial={reduceMotion ? false : { y: 70 }}
      animate={{ y: 0 }}
      transition={springs.drawer}
      className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-[var(--line)] bg-[rgb(255_253_248/0.96)] p-3 backdrop-blur-xl md:hidden"
      aria-label="Mobile purchase actions"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
          {product.model}
        </p>
        <p className="font-display text-xl font-bold">
          {formatPrice(product.sellingPriceInclGstPaise)}
        </p>
      </div>
      <AddToCart productId={product.id} className="button-primary shrink-0" />
    </motion.aside>
  );
}
