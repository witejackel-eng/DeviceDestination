"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { useCartStore } from "@/lib/cart-store";
import { calculateCartTotals, formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, setQuantity, removeItem } = useCartStore();
  const resolved = items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const totals = calculateCartTotals(resolved);
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Your selection</p>
      <h1 className="display-section mt-4">Cart.</h1>
      {resolved.length === 0 ? (
        <div className="surface-card mt-10 grid min-h-[420px] place-content-center p-8 text-center">
          <h2 className="font-display text-3xl font-semibold">Nothing here yet.</h2>
          <Link href="/products" className="button-primary mt-6">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <ul className="grid gap-4">
            {resolved.map(({ product, quantity }) => (
              <li
                key={product.id}
                className="surface-card grid grid-cols-[110px_1fr] gap-5 p-4 sm:grid-cols-[150px_1fr]"
              >
                <div className="relative aspect-square rounded-2xl bg-[var(--canvas-alt)]">
                  <Image
                    src={product.images[0]}
                    alt=""
                    fill
                    sizes="150px"
                    className="object-contain p-3"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">{product.model}</p>
                  <Link
                    href={`/products/${product.slug}`}
                    className="mt-1 block font-display text-2xl font-semibold"
                  >
                    {product.title}
                  </Link>
                  <p className="mt-3 font-bold">{formatPrice(product.sellingPriceInclGstPaise)}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex rounded-xl border border-[var(--line)]">
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center"
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="grid min-w-8 place-content-center font-bold">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center"
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center text-[var(--danger)]"
                      onClick={() => removeItem(product.id)}
                      aria-label={`Remove ${product.model}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="surface-card h-fit p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-3xl font-semibold">Order summary</h2>
            <dl className="mt-6 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt>Products subtotal</dt>
                <dd className="font-bold">{formatPrice(totals.subtotalInclGstPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>₹0</dd>
              </div>
              <div className="flex justify-between">
                <dt>Installation</dt>
                <dd>Quoted separately</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-4 text-lg">
                <dt className="font-bold">Grand total</dt>
                <dd className="font-bold">{formatPrice(totals.grandTotalInclGstPaise)}</dd>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <dt>Includes GST</dt>
                <dd>{formatPrice(totals.includedGstPaise)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="button-primary mt-6 w-full">
              Checkout
            </Link>
            <Link href="/products" className="button-quiet mt-2 w-full">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
