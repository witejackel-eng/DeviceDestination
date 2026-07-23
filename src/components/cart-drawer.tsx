"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Minus, Plus, X, ShoppingBag, ArrowRight, MessageCircle } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { calculateCartTotals, formatPrice } from "@/lib/products";
import { getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { useCartStore } from "@/lib/cart-store";
import { useModalLayer, lockScroll, unlockScroll } from "@/lib/modal-layer";
import { durations, modalTiming, easings } from "@/lib/motion/constants";

export function CartDrawer() {
  const reduceMotion = useReducedMotion();
  const { items, isOpen, close, setQuantity, removeItem } = useCartStore();
  const modalActive = useModalLayer((s) => s.active);

  // Resolve eligible cart items
  const resolved = items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product && getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible
      ? [{ product, quantity: line.quantity }]
      : [];
  });
  const totals = calculateCartTotals(resolved);
  const itemCount = resolved.length;

  // ── Mutual exclusion: close menu if cart opens ──
  // Cart store's addItem already sets isOpen=true, but if menu is open
  // we need to coordinate via the modal layer
  useEffect(() => {
    if (isOpen && modalActive === "menu") {
      useModalLayer.getState().requestClose("menu");
    }
  }, [isOpen, modalActive]);

  // ── Scroll lock ──
  useEffect(() => {
    if (isOpen) {
      lockScroll();
    } else {
      // Only unlock if menu isn't also open
      if (modalActive !== "menu") {
        unlockScroll();
      }
    }
    return () => {
      if (modalActive !== "menu") unlockScroll();
    };
  }, [isOpen, modalActive]);

  // ── Easing ──
  const ease = easings.standard;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* ── Backdrop overlay ── */}
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[200]"
                style={{
                  background: "rgba(17, 18, 20, 0.42)",
                  backdropFilter: "blur(6px)",
                }}
                initial={reduceMotion ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={modalTiming.backdrop.enter}
                onClick={close}
              />
            </Dialog.Overlay>

            {/* ── CART PANEL — floating, inset from viewport edges ── */}
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="floating-cart-panel"
                  initial={reduceMotion ? undefined : { opacity: 0, x: 28, y: 6, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: 18, scale: 0.99 }}
                transition={modalTiming.panel.enter}
              >
                {/* ── HEADER ── */}
                <motion.div
                  className="flex items-center justify-between px-6 pt-6 pb-4"
                  initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: durations.normal, delay: 0.06, ease }}
                >
                  <div>
                    <Dialog.Title className="font-display text-2xl font-bold">
                      Your cart
                    </Dialog.Title>
                    {itemCount > 0 && (
                      <Dialog.Description className="mt-1 text-sm text-[var(--text-muted)]">
                        {itemCount} exact-model item{itemCount > 1 ? "s" : ""}. Prices include GST.
                      </Dialog.Description>
                    )}
                    {itemCount === 0 && (
                      <Dialog.Description className="mt-1 text-sm text-[var(--text-muted)]">
                        Prices include GST. Installation is quoted separately.
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close
                    className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-btn)] border border-[var(--border)] transition-colors duration-160 hover:bg-[var(--surface-subtle)]"
                    aria-label="Close cart"
                  >
                    <X size={18} />
                  </Dialog.Close>
                </motion.div>

                {/* ── ITEM BODY (scrollable) ── */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6" aria-live="polite">
                  {itemCount === 0 ? (
                    /* ── Empty state ── */
                    <motion.div
                      className="flex flex-col items-center justify-center min-h-[300px] text-center"
                      initial={reduceMotion ? undefined : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: durations.normal }}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-container)] bg-[var(--surface-subtle)] mb-4">
                        <ShoppingBag size={24} className="text-[var(--text-muted)]" />
                      </div>
                      <p className="font-display text-xl font-bold">
                        Your cart is ready for a model.
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-muted)] max-w-[280px]">
                        Browse exact-model cameras, recorders, biometrics and networking hardware.
                      </p>
                      <Dialog.Close asChild>
                        <Link href="/products" className="button-primary mt-5">
                          Browse products <ArrowRight size={16} />
                        </Link>
                      </Dialog.Close>
                      <a
                        href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP || "918368561919"}`}
                        className="button-secondary mt-3"
                      >
                        <MessageCircle size={16} />
                        Get product help
                      </a>
                    </motion.div>
                  ) : (
                    /* ── Cart items ── */
                    <ul className="grid gap-3 pb-2">
                      <AnimatePresence initial={false}>
                        {resolved.map(({ product, quantity }, i) => (
                          <motion.li
                            key={product.id}
                            layout
                            initial={reduceMotion ? undefined : {
                              opacity: 0,
                              x: i < modalTiming.maxStaggerItems ? 10 : 0,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{
                              duration: durations.normal,
                              delay: reduceMotion ? 0 : (i < modalTiming.maxStaggerItems ? i * modalTiming.stagger : 0),
                              ease,
                            }}
                            className="flex gap-3 rounded-[var(--radius-card)] border border-[var(--border)] p-3 bg-[var(--surface)] transition-colors duration-160 hover:border-[var(--border-strong)]"
                          >
                            {/* Product image */}
                            <div className="relative aspect-square w-[96px] shrink-0 overflow-hidden rounded-[14px] bg-[var(--surface-subtle)]">
                              <Image
                                src={product.images[0]}
                                alt=""
                                fill
                                sizes="96px"
                                className="object-contain p-2"
                              />
                            </div>

                            {/* Product details */}
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-[11px] font-medium text-[var(--text-secondary)]">
                                {product.model}
                              </p>
                              <Link
                                href={`/products/${product.slug}`}
                                onClick={close}
                                className="mt-0.5 block text-[15px] font-semibold leading-snug line-clamp-2 hover:text-[var(--accent)] transition-colors duration-160"
                              >
                                {product.title}
                              </Link>
                              <p className="mt-1 text-[17px] font-bold">
                                {formatPrice(product.sellingPriceInclGstPaise)}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                Incl. GST
                              </p>

                              {/* Quantity + Remove */}
                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                <div className="flex items-center rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)]">
                                  <button
                                    type="button"
                                    onClick={() => setQuantity(product.id, quantity - 1)}
                                    disabled={quantity <= 1}
                                    className="flex h-[42px] w-[42px] items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors duration-160 disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={`Decrease ${product.model} quantity`}
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span
                                    className="min-w-[32px] text-center text-sm font-bold tabular-nums"
                                    aria-label={`Quantity ${quantity}`}
                                  >
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setQuantity(product.id, quantity + 1)}
                                    className="flex h-[42px] w-[42px] items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors duration-160"
                                    aria-label={`Increase ${product.model} quantity`}
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeItem(product.id)}
                                  className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--error)] transition-colors duration-160"
                                  aria-label={`Remove ${product.model}`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                {/* ── CHECKOUT FOOTER ── */}
                {itemCount > 0 && (
                  <motion.div
                    className="border-t border-[var(--border)] px-6 py-5 bg-[var(--surface)]"
                    style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.02)" }}
                    initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: durations.normal, delay: 0.1, ease }}
                  >
                    {/* Subtotal */}
                    <div className="flex items-end justify-between mb-1">
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-muted)]">Subtotal</p>
                        <motion.p
                          key={totals.subtotalInclGstPaise}
                          initial={reduceMotion ? undefined : { scale: 0.97 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.18 }}
                          className="font-display text-2xl font-bold mt-0.5"
                        >
                          {formatPrice(totals.subtotalInclGstPaise)}
                        </motion.p>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Includes GST {formatPrice(totals.includedGstPaise)}
                      </p>
                    </div>

                    {/* Supporting lines */}
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      Delivery calculated during checkout · Installation quoted separately
                    </p>

                    {/* Checkout CTA */}
                    <Dialog.Close asChild>
                      <Link
                        href="/checkout"
                        className="button-primary w-full group"
                      >
                        Continue to checkout
                        <ArrowRight size={16} className="transition-transform duration-160 group-hover:translate-x-[3px]" />
                      </Link>
                    </Dialog.Close>

                    {/* Continue shopping */}
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        onClick={close}
                        className="w-full mt-2 text-center text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-160"
                      >
                        Continue shopping
                      </button>
                    </Dialog.Close>

                    {/* Reassurance line */}
                    <p className="mt-3 text-xs text-center text-[var(--text-muted)]">
                      Secure Razorpay checkout · GST invoice
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
