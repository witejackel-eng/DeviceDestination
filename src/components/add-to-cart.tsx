"use client";

import { ShoppingBag } from "lucide-react";
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
}: {
  productId: string;
  label?: string;
  className?: string;
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
        Request latest price
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
      aria-label={`${label}: ${productId}`}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      animate={added && !reduceMotion ? { scale: [1, 1.025, 1] } : undefined}
      transition={springs.interface}
    >
      <ShoppingBag size={17} aria-hidden="true" /> {added ? "Added" : label}
      <span className="sr-only" aria-live="polite">
        {added ? `${product?.model} added to cart` : ""}
      </span>
    </motion.button>
  );
}
