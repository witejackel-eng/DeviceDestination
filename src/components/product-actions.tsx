"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

export function ProductActions({ productId }: { productId: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
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
          <span className="min-w-9 text-center font-bold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(99, value + 1))}
            className="flex h-12 w-11 items-center justify-center"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => addItem(productId, quantity)}
          className="button-primary flex-1"
        >
          <ShoppingBag size={18} /> Add to cart
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          addItem(productId, quantity);
          router.push("/checkout");
        }}
        className="button-secondary w-full"
      >
        Buy now
      </button>
    </div>
  );
}
