"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Scale, Check } from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { useCompareStore } from "@/lib/compare-store";
import { comparisonGroup } from "@/lib/products";
import { catalogue } from "@/data/catalog";
import {
  calculateDiscountPercent,
  formatPrice,
  getPurchaseEligibility,
  type Product,
} from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { springs } from "@/lib/motion/constants";

export function ProductCard({ product }: { product: Product }) {
  const reduceMotion = useReducedMotion();
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const discount =
    product.sellingPriceInclGstPaise === null
      ? null
      : calculateDiscountPercent(product.sellingPriceInclGstPaise, compareAt);

  /* Compare state */
  const compareIds = useCompareStore((state) => state.ids);
  const toggleCompare = useCompareStore((state) => state.toggle);
  const isInCompare = compareIds.includes(product.id);
  const atCompareLimit = compareIds.length >= 4 && !isInCompare;
  const firstCompareProduct = catalogue.find((p) => p.id === compareIds[0]);
  const isIncompatible = !isInCompare && firstCompareProduct && comparisonGroup(firstCompareProduct) !== comparisonGroup(product);

  return (
    <motion.article
      layout
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={springs.interface}
      className="product-card group"
    >
      <Link
        href={`/products/${product.slug}`}
        className="product-card-image block"
      >
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.model} product`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1440px) 22vw, 18vw"
          className="object-contain p-[12%]"
        />
      </Link>

      {/* Compare button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!atCompareLimit && !isIncompatible) toggleCompare(product.id);
        }}
        disabled={atCompareLimit || isIncompatible}
        className="product-card-compare lg:opacity-0 lg:group-hover:opacity-100"
        data-selected={isInCompare ? "true" : undefined}
        aria-pressed={isInCompare}
        aria-label={isInCompare ? `Remove ${product.model} from comparison` : `Add ${product.model} to comparison`}
        title={
          atCompareLimit
            ? "Compare limit reached (4 products)"
            : isIncompatible
              ? "Different product type"
              : undefined
        }
      >
        {isInCompare ? <Check size={14} /> : <Scale size={14} />}
      </button>

      <div className="product-card-info">
        {/* Brand/category label */}
        <p className="product-card-brand">{product.brand} · {product.category}</p>

        {/* Title (max 2 lines) */}
        <Link href={`/products/${product.slug}`} className="product-card-title">
          {product.title}
        </Link>

        {/* Exact model (Geist Mono) */}
        <p className="product-card-model">{product.model}</p>

        {/* Availability */}
        <p
          className="product-card-stock"
          data-status={product.stockStatus === "in_stock" ? "in_stock" : undefined}
        >
          {product.stockStatus === "in_stock" ? "In stock" : product.stockStatus.replaceAll("_", " ")}
        </p>

        {/* Footer: price + add to cart */}
        <div className="product-card-footer">
          <div>
            {compareAt && product.compareAtLabel && (
              <p className="text-[11px] text-[var(--text-muted)]">
                <span className="price-old">
                  {formatPrice(compareAt)}
                </span>
                {discount ? ` · ${discount}% off` : ""}
              </p>
            )}
            <p className="product-card-price">
              {eligibility.eligible
                ? formatPrice(product.sellingPriceInclGstPaise)
                : "Request price"}
            </p>
          </div>
          <AddToCart
            productId={product.id}
            label=""
            className="product-card-action"
          />
        </div>
      </div>
    </motion.article>
  );
}
