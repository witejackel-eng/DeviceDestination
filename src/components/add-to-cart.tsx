"use client";

import { ShoppingBag, Plus } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { catalogue } from "@/data/catalog";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { getPurchaseEligibility } from "@/lib/products";
import { springs } from "@/lib/motion/constants";

export function AddToCart({
  productId,
  label = "Add to cart",
  className = "button-primary",
  iconOnly = false,
}: {
  productId: string;
  label?: string;
  className?: string;
  /** When true, shows only an icon without text label. */
  iconOnly?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const reduceMotion = useReducedMotion();
  const addItem = useCartStore((state) => state.addItem);
  const product = catalogue.find((item) => item.id === productId);
  const eligibility = product
    ? getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() })
    : { eligible: false as const, reason: "missing_price" as const };
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1_400);
    return () => window.clearTimeout(timer);
  }, [added]);

  if (!eligibility.eligible)
    return (
      <Link
        href={`/quote?product=${encodeURIComponent(product?.model ?? productId)}`}
        className={className}
      >
        {iconOnly ? <span className="sr-only">Request price</span> : "Request latest price"}
      </Link>
    );
  return (
    <motion.button
      type="button"
      onClick={() => {
        addItem(productId);
        setAdded(true);
      }}
      className={className}
      aria-label={`Add to cart: ${productId}`}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      animate={added && !reduceMotion ? { scale: [1, 1.06, 1] } : undefined}
      transition={springs.interface}
    >
      {iconOnly ? (
        <>
          {added ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <Plus size={14} strokeWidth={2.5} />
          )}
          <span className="sr-only" aria-live="polite">
            {added ? `${product?.model} added to cart` : "Add to cart"}
          </span>
        </>
      ) : (
        <>
          <ShoppingBag size={16} aria-hidden="true" /> {added ? "Added" : label}
          <span className="sr-only" aria-live="polite">
            {added ? `${product?.model} added to cart` : ""}
          </span>
        </>
      )}
    </motion.button>
  );
}
