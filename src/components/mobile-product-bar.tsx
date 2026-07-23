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
      className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-[var(--border)] bg-[rgb(255_255_255/0.96)] p-3 backdrop-blur-xl md:hidden"
      aria-label="Mobile purchase actions"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-medium text-[var(--text-secondary)] truncate">
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
