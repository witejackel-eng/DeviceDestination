"use client";

import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

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
