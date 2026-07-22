"use client";

import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { calculateCartTotals, formatPrice } from "@/lib/products";
import { getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { durations, springs } from "@/lib/motion/constants";

export function CartDrawer() {
  const reduceMotion = useReducedMotion();
  const { items, isOpen, close, setQuantity, removeItem } = useCartStore();
  const resolved = items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product && getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible
      ? [{ product, quantity: line.quantity }]
      : [];
  });
  const totals = calculateCartTotals(resolved);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-black/30"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-0 right-0 z-[90] flex w-[min(94vw,480px)] flex-col bg-[var(--canvas)] shadow-2xl"
                initial={reduceMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={springs.drawer}
              >
                <div className="flex items-center justify-between border-b border-[var(--line)] p-5 sm:p-7">
                  <div>
                    <Dialog.Title className="font-display text-3xl font-semibold">
                      Your cart
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-[var(--muted)]">
                      Prices include GST. Installation is quoted separately.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)]"
                    aria-label="Close cart"
                  >
                    <X size={20} />
                  </Dialog.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7" aria-live="polite">
                  {resolved.length === 0 ? (
                    <div className="grid min-h-[55vh] place-content-center text-center">
                      <p className="font-display text-3xl font-semibold">Your cart is quiet.</p>
                      <p className="mt-2 text-[var(--muted)]">
                        Choose hardware by exact model when you are ready.
                      </p>
                      <Dialog.Close asChild>
                        <Link href="/products" className="button-primary mt-6">
                          Browse products
                        </Link>
                      </Dialog.Close>
                    </div>
                  ) : (
                    <ul className="grid gap-5">
                      <AnimatePresence initial={false}>
                        {resolved.map(({ product, quantity }) => (
                          <motion.li
                            key={product.id}
                            layout
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0, paddingBottom: 0 }}
                            className="grid grid-cols-[92px_1fr] gap-4 border-b border-[var(--line)] pb-5"
                          >
                            <div className="relative aspect-square overflow-hidden rounded-2xl bg-[var(--canvas-alt)]">
                              <Image
                                src={product.images[0]}
                                alt=""
                                fill
                                sizes="92px"
                                className="object-contain p-2"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--muted)]">
                                {product.model}
                              </p>
                              <Link
                                href={`/products/${product.slug}`}
                                onClick={close}
                                className="mt-1 block font-semibold leading-tight hover:underline"
                              >
                                {product.title}
                              </Link>
                              <p className="mt-2 font-bold">
                                {formatPrice(product.sellingPriceInclGstPaise)}
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="flex items-center rounded-xl border border-[var(--line)]">
                                  <button
                                    type="button"
                                    onClick={() => setQuantity(product.id, quantity - 1)}
                                    className="flex h-10 w-10 items-center justify-center"
                                    aria-label={`Decrease ${product.model} quantity`}
                                  >
                                    <Minus size={15} />
                                  </button>
                                  <span
                                    className="min-w-8 text-center text-sm font-bold"
                                    aria-label={`Quantity ${quantity}`}
                                  >
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setQuantity(product.id, quantity + 1)}
                                    className="flex h-10 w-10 items-center justify-center"
                                    aria-label={`Increase ${product.model} quantity`}
                                  >
                                    <Plus size={15} />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(product.id)}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--danger)]"
                                  aria-label={`Remove ${product.model}`}
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                {resolved.length > 0 && (
                  <div className="border-t border-[var(--line)] bg-white p-5 sm:p-7">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-[var(--muted)]">GST-inclusive subtotal</p>
                        <motion.p
                          key={totals.subtotalInclGstPaise}
                          initial={reduceMotion ? false : { scale: 0.97 }}
                          animate={{ scale: 1 }}
                          className="font-display text-3xl font-bold"
                        >
                          {formatPrice(totals.subtotalInclGstPaise)}
                        </motion.p>
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        Includes GST {formatPrice(totals.includedGstPaise)}
                      </p>
                    </div>
                    <Dialog.Close asChild>
                      <Link href="/checkout" className="button-primary mt-5 w-full">
                        Continue to checkout
                      </Link>
                    </Dialog.Close>
                    <Dialog.Close asChild>
                      <Link href="/products" className="button-quiet mt-2 w-full">
                        Continue shopping
                      </Link>
                    </Dialog.Close>
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
