"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { catalogue } from "@/data/catalog";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { getPurchaseEligibility } from "@/lib/products";
import { springs } from "@/lib/motion/constants";

export function ProductActions({ productId }: { productId: string }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
  const product = catalogue.find((item) => item.id === productId);
  const eligibility = product
    ? getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() })
    : { eligible: false as const, reason: "missing_price" as const };
  if (!eligibility.eligible)
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--tangerine-soft)] p-5">
        <p className="font-display text-xl font-semibold">Price confirmation required</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          This model cannot enter checkout until its current price and availability are confirmed.
        </p>
        <Link
          href={`/quote?product=${encodeURIComponent(product?.model ?? productId)}`}
          className="button-primary mt-4 w-full"
        >
          Request latest price
        </Link>
      </div>
    );
  return (
    <div className="grid gap-3">
      <div className="flex gap-3">
        <div className="flex items-center rounded-xl border border-[var(--line)]">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="flex h-12 w-11 items-center justify-center"
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <motion.span
            key={quantity}
            initial={reduceMotion ? false : { scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={springs.interface}
            className="min-w-9 text-center font-bold"
          >
            {quantity}
          </motion.span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(99, value + 1))}
            className="flex h-12 w-11 items-center justify-center"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
        <motion.button
          type="button"
          onClick={() => addItem(productId, quantity)}
          className="button-primary flex-1"
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          <ShoppingBag size={18} /> Add to cart
        </motion.button>
      </div>
      <motion.button
        type="button"
        onClick={() => {
          addItem(productId, quantity);
          router.push("/checkout");
        }}
        className="button-secondary w-full"
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        Buy now
      </motion.button>
    </div>
  );
}
