"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { catalogue } from "@/data/catalog";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { getPurchaseEligibility } from "@/lib/products";

export function AddToCart({
  productId,
  label = "Add to cart",
  className = "button-primary",
}: {
  productId: string;
  label?: string;
  className?: string;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const product = catalogue.find((item) => item.id === productId);
  const eligibility = product
    ? getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() })
    : { eligible: false as const, reason: "missing_price" as const };
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
    <button
      type="button"
      onClick={() => addItem(productId)}
      className={className}
      aria-label={`${label}: ${productId}`}
    >
      <ShoppingBag size={17} aria-hidden="true" /> {label}
    </button>
  );
}
