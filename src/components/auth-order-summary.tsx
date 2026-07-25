"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { calculateCartTotals, formatPrice, getPurchaseEligibility } from "@/lib/products";

/**
 * Order context shown beside the sign-in card when the customer arrived from
 * checkout. Reads the same persisted cart the checkout uses, which is also the
 * proof that signing in does not discard it.
 */
export function AuthOrderSummary() {
  // Same persisted store the cart drawer and checkout read, which is what makes
  // this a truthful preview of what survives the Google redirect.
  const items = useCartStore((state) => state.items);

  const resolved = items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product && getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible
      ? [{ product, quantity: line.quantity }]
      : [];
  });

  if (resolved.length === 0)
    return (
      <div className="surface-card p-6">
        <p className="eyebrow">Your cart</p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Your cart is empty right now. Signing in keeps anything you add afterwards, along with
          your order history and GST invoices.
        </p>
      </div>
    );

  const totals = calculateCartTotals(resolved);
  const count = resolved.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="surface-card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Your cart</p>
        <p className="text-xs font-bold text-[var(--muted)]">
          {count} {count === 1 ? "item" : "items"}
        </p>
      </div>
      <ul className="mt-5 grid gap-4">
        {resolved.map(({ product, quantity }) => (
          <li key={product.id} className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--canvas-alt)]">
              <Image
                src={product.images[0]}
                alt=""
                fill
                sizes="56px"
                className="object-contain p-[8%]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-[var(--tangerine-text)]">
                {product.model}
              </span>
              <span className="block truncate text-sm font-semibold">{product.title}</span>
              <span className="block text-xs text-[var(--muted)]">Qty {quantity}</span>
            </span>
            <strong className="shrink-0 text-sm">
              {formatPrice((product.sellingPriceInclGstPaise ?? 0) * quantity)}
            </strong>
          </li>
        ))}
      </ul>
      <dl className="mt-5 grid gap-2 border-t border-[var(--line)] pt-5 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="font-bold">{formatPrice(totals.subtotalInclGstPaise)}</dd>
        </div>
        <div className="flex justify-between text-[var(--muted)]">
          <dt>Includes GST</dt>
          <dd>{formatPrice(totals.includedGstPaise)}</dd>
        </div>
        <div className="flex justify-between text-[var(--muted)]">
          <dt>Delivery</dt>
          <dd>Calculated at checkout</dd>
        </div>
      </dl>
      <p className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--canvas-alt)] p-3 text-xs leading-5 text-[var(--muted)]">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--tangerine-text)]" />
        Prices and stock are rechecked on the server before any payment is taken.
      </p>
    </div>
  );
}
