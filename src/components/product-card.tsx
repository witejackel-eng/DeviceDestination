import Image from "next/image";
import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { CompareToggle } from "@/components/compare-toggle";
import {
  calculateDiscountPercent,
  formatPrice,
  getPurchaseEligibility,
  type Product,
} from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";

export function ProductCard({ product }: { product: Product }) {
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const discount =
    product.sellingPriceInclGstPaise === null
      ? null
      : calculateDiscountPercent(product.sellingPriceInclGstPaise, compareAt);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[1.12] overflow-hidden bg-[var(--canvas-alt)]"
      >
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.model} product`}
          fill
          sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 24vw"
          className="object-contain p-8 transition-transform duration-500 group-hover:scale-[1.035]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">
          {product.stockStatus === "in_stock" ? "Available" : "Check lead time"}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          {product.brand} · {product.model}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-2 font-display text-xl font-semibold leading-[1.1] tracking-[-0.035em] hover:underline"
        >
          {product.title}
        </Link>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
          {product.highlights[0]}
        </p>
        <div className="mt-auto pt-6">
          {compareAt && product.compareAtLabel && (
            <p className="text-xs text-[var(--muted)]">
              <span className="price-old">
                {product.compareAtLabel} {formatPrice(compareAt)}
              </span>
              {discount ? ` · ${discount}% off` : ""}
            </p>
          )}
          <p className="font-display text-2xl font-bold">
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
              className="button-secondary px-4"
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
    </article>
  );
}
