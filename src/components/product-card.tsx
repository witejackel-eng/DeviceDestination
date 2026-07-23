"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Scale, Check } from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { useCompareStore } from "@/lib/compare-store";
import { comparisonGroup, formatPrice, getPurchaseEligibility, type Product } from "@/lib/products";
import { getSpecChips } from "@/lib/spec-chips";
import { getPriceMaxAgeDays } from "@/config/site";
import { catalogue } from "@/data/catalog";
import { springs } from "@/lib/motion/constants";

export function ProductCard({ product }: { product: Product }) {
  const reduceMotion = useReducedMotion();
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const chips = getSpecChips(product);

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

        {/* Specification chips — derived from trusted specs */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold leading-none ${
                  chip.accent
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Stock status */}
        <p
          className="product-card-stock mt-2"
          data-status={product.stockStatus === "in_stock" ? "in_stock" : undefined}
        >
          {product.stockStatus === "in_stock" ? "In stock" : product.stockStatus.replaceAll("_", " ")}
        </p>

        {/* Footer: price + actions */}
        <div className="product-card-footer mt-2">
          <div>
            {compareAt && product.compareAtLabel && (
              <p className="text-[11px] text-[var(--text-muted)]">
                <span className="price-old">
                  {formatPrice(compareAt)}
                </span>
                {eligibility.eligible ? " · Incl. GST" : ""}
              </p>
            )}
            <p className="product-card-price">
              {eligibility.eligible
                ? formatPrice(product.sellingPriceInclGstPaise)
                : "Request price"}
            </p>
            {eligibility.eligible && (
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Incl. GST</p>
            )}
            {!eligibility.eligible && (
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Availability confirmation required</p>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3">
          {eligibility.eligible ? (
            <>
              <AddToCart
                productId={product.id}
                label="Add to cart"
                className="button-primary flex-1 min-h-[44px]"
              />
              <Link
                href={`/products/${product.slug}`}
                className="button-tertiary min-h-[44px] text-sm"
              >
                View details
              </Link>
            </>
          ) : (
            <Link
              href={`/products/${product.slug}`}
              className="button-secondary flex-1 min-h-[44px]"
            >
              Request price
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}
