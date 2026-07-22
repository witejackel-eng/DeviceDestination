"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AddToCart } from "@/components/add-to-cart";
import {
  calculateDiscountPercent,
  formatPrice,
  getPurchaseEligibility,
  type Product,
} from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { springs } from "@/lib/motion/constants";

/** Map category slugs to CSS class suffixes for colour backgrounds. */
function categoryImageClass(categorySlug: string): string {
  if (categorySlug.includes("dome")) return "product-card-image--cat-dome-cameras";
  if (categorySlug.includes("bullet")) return "product-card-image--cat-bullet-cameras";
  if (categorySlug.includes("color")) return categorySlug.includes("bullet")
    ? "product-card-image--cat-color-bullet-cameras"
    : "product-card-image--cat-color-dome-cameras";
  if (categorySlug.includes("nvr")) return "product-card-image--cat-nvr-systems";
  if (categorySlug.includes("biometric")) return "product-card-image--cat-biometric-devices";
  if (categorySlug.includes("poe") || categorySlug.includes("switch"))
    return "product-card-image--cat-poe-switches";
  return "";
}

export function ProductCard({ product }: { product: Product }) {
  const reduceMotion = useReducedMotion();
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const discount =
    product.sellingPriceInclGstPaise === null
      ? null
      : calculateDiscountPercent(product.sellingPriceInclGstPaise, compareAt);

  const imgClass = categoryImageClass(product.categorySlug);

  return (
    <motion.article
      layout
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={springs.interface}
      className="product-card group"
    >
      <Link
        href={`/products/${product.slug}`}
        className={`product-card-image block ${imgClass}`}
      >
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.model} product`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1440px) 22vw, 18vw"
          className="object-contain p-[12%]"
        />
        <span className="product-card-model">{product.model}</span>
      </Link>

      <div className="product-card-info">
        <p className="product-card-brand">{product.brand} · {product.category}</p>
        <Link href={`/products/${product.slug}`} className="product-card-title">
          {product.title}
        </Link>

        <div className="product-card-footer">
          <div>
            {compareAt && product.compareAtLabel && (
              <p className="text-[11px] text-[var(--muted)]">
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
