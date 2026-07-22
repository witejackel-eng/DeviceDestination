"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AddToCart } from "@/components/add-to-cart";
import { CompareToggle } from "@/components/compare-toggle";
import {
  calculateDiscountPercent,
  formatPrice,
  getPurchaseEligibility,
  type Product,
} from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { springs } from "@/lib/motion/constants";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const discount =
    product.sellingPriceInclGstPaise === null
      ? null
      : calculateDiscountPercent(product.sellingPriceInclGstPaise, compareAt);
  return (
    <motion.article
      layout
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={springs.interface}
      className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-white transition-colors hover:border-[var(--tangerine-border-hover)] hover:shadow-[0_18px_44px_var(--tangerine-shadow)]"
    >
      <Link
        href={`/products/${product.slug}`}
        className={`relative block overflow-hidden bg-[var(--canvas-alt)] ${compact ? "aspect-[1.35]" : "aspect-[1.12]"}`}
      >
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.model} product`}
          fill
          sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 24vw"
          className={`object-contain transition-transform duration-500 group-hover:scale-[1.04] ${compact ? "p-6" : "p-8"}`}
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">
          {product.stockStatus === "in_stock" ? "Available" : "Check lead time"}
        </span>
      </Link>
      <div className={`flex flex-1 flex-col ${compact ? "p-4" : "p-5"}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          {product.brand}
        </p>
        <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
          {product.model}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className={`mt-2 font-display font-semibold leading-[1.1] tracking-[-0.035em] hover:underline ${compact ? "text-lg" : "text-xl"}`}
        >
          {product.title}
        </Link>
        <ul className="mt-3 grid gap-1 text-sm leading-6 text-[var(--muted)]">
          {product.highlights.slice(0, compact ? 1 : 2).map((highlight) => (
            <li key={highlight}>• {highlight}</li>
          ))}
        </ul>
        <div className={`mt-auto ${compact ? "pt-4" : "pt-6"}`}>
          {compareAt && product.compareAtLabel && (
            <p className="text-xs text-[var(--muted)]">
              <span className="price-old">
                {product.compareAtLabel} {formatPrice(compareAt)}
              </span>
              {discount ? ` · ${discount}% off` : ""}
            </p>
          )}
          <p className={`font-display font-bold ${compact ? "text-2xl" : "text-3xl"}`}>
            {eligibility.eligible
              ? formatPrice(product.sellingPriceInclGstPaise)
              : "Request latest price"}
          </p>
          <p className="text-[11px] text-[var(--muted)]">
            {eligibility.eligible
              ? "Inclusive of all taxes"
              : "Current price and availability confirmed before order"}
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <AddToCart productId={product.id} className="button-primary w-full" />
            <Link
              href={`/products/${product.slug}`}
              className="button-quiet px-3"
              aria-label={`View ${product.model} details`}
            >
              Details
            </Link>
          </div>
          <div className="mt-2">
            <CompareToggle productId={product.id} compact />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
