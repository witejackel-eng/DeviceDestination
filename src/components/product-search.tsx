"use client";

import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageCircle, Phone, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { catalogue, searchProducts } from "@/data/catalog";
import { getPriceMaxAgeDays, siteConfig } from "@/config/site";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { durations, easings } from "@/lib/motion/constants";

const suggestedCategories = [
  ["Dome cameras", "/categories/dome-cameras"],
  ["Bullet cameras", "/categories/bullet-cameras"],
  ["NVR systems", "/categories/nvr-systems"],
  ["Biometric devices", "/categories/biometric-devices"],
  ["PoE switches", "/categories/poe-switches"],
] as const;

function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-[var(--tangerine-soft)] px-0.5 text-inherit">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

/**
 * Header search. The trigger is icon-only by design — the storefront has a single
 * search entry point and no inline search fields.
 */
export function ProductSearch({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const reduceMotion = useReducedMotion();
  const results = useMemo(() => (query.trim() ? searchProducts(query).slice(0, 7) : []), [query]);

  const popularModels = useMemo(
    () => catalogue.filter((product) => product.stockStatus === "in_stock").slice(0, 4),
    [],
  );

  useEffect(() => {
    const openWithSlash = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", openWithSlash);
    return () => window.removeEventListener("keydown", openWithSlash);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <motion.button
          type="button"
          className={`header-control ${className}`}
          aria-label="Search products by exact model"
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        >
          <Search size={19} />
        </motion.button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[90] bg-[rgb(23_21_19/0.5)] backdrop-blur-sm"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-3 top-4 z-[100] mx-auto grid max-h-[calc(100svh-32px)] max-w-5xl gap-3 sm:top-[8vh] lg:grid-cols-[1.55fr_1fr]"
                initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: durations.normal, ease: easings.enter }}
                onKeyDown={(event) => {
                  if (!results.length || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  const next = (activeIndex + direction + results.length) % results.length;
                  setActiveIndex(next);
                  resultRefs.current[next]?.focus();
                }}
              >
                <div className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
                  <Dialog.Title className="sr-only">Search the exact-model catalogue</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Search accepts spaces, dashes, brand names and model-number variations.
                  </Dialog.Description>
                  <div className="flex items-center gap-3 border-b border-[var(--line)] p-4 sm:p-5">
                    <Search size={21} className="shrink-0 text-[var(--tangerine-text)]" />
                    <label htmlFor="product-search" className="sr-only">
                      Search exact models
                    </label>
                    <input
                      id="product-search"
                      autoFocus
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                      }}
                      placeholder="Try CP UNC DA41L3C D Q"
                      className="h-12 min-w-0 flex-1 bg-transparent text-lg outline-none"
                    />
                    <Dialog.Close
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line)]"
                      aria-label="Close search"
                    >
                      <X size={18} />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                    <p className="sr-only" aria-live="polite">
                      {query.trim() ? `${results.length} search results` : "Search ready"}
                    </p>
                    {!query.trim() ? (
                      <div className="p-4">
                        <p className="eyebrow">Suggested categories</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestedCategories.map(([label, href]) => (
                            <Dialog.Close asChild key={href}>
                              <Link
                                href={href}
                                className="flex min-h-11 items-center rounded-xl border border-[var(--line)] px-4 text-sm font-bold hover:border-[var(--tangerine-border-hover)]"
                              >
                                {label}
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                        <p className="mt-6 text-sm text-[var(--muted)]">
                          Search by model number, product name, brand, specification or category.
                          Dashes and spaces are optional.
                        </p>
                      </div>
                    ) : results.length ? (
                      <ul className="grid gap-2">
                        {results.map((product, index) => {
                          const eligible = getPurchaseEligibility(product, {
                            maxAgeDays: getPriceMaxAgeDays(),
                          }).eligible;
                          return (
                            <li key={product.id}>
                              <Dialog.Close asChild>
                                <Link
                                  ref={(element) => {
                                    resultRefs.current[index] = element;
                                  }}
                                  href={`/products/${product.slug}`}
                                  className={`grid min-h-24 grid-cols-[68px_1fr] items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-[var(--tangerine-soft)] focus:bg-[var(--tangerine-soft)] sm:grid-cols-[68px_1fr_auto] ${activeIndex === index ? "bg-[var(--tangerine-soft)]" : ""}`}
                                >
                                  <span className="relative aspect-square overflow-hidden rounded-xl bg-white">
                                    <Image
                                      src={product.images[0]}
                                      alt=""
                                      fill
                                      sizes="68px"
                                      className="object-contain p-2"
                                    />
                                  </span>
                                  <span className="min-w-0">
                                    <strong className="block text-xs uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
                                      <Highlight text={product.model} query={query} />
                                    </strong>
                                    <span className="mt-1 block truncate font-display text-lg font-semibold">
                                      <Highlight text={product.title} query={query} />
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--muted)] sm:hidden">
                                      {product.category} ·{" "}
                                      {eligible ? "Available" : "Check availability"}
                                    </span>
                                  </span>
                                  <span className="hidden text-right sm:block">
                                    <strong className="block text-sm">
                                      {eligible
                                        ? formatPrice(product.sellingPriceInclGstPaise)
                                        : "Request price"}
                                    </strong>
                                    <span className="mt-1 block text-xs text-[var(--muted)]">
                                      {product.category} ·{" "}
                                      {eligible ? "Available" : "Check availability"}
                                    </span>
                                  </span>
                                </Link>
                              </Dialog.Close>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="font-display text-2xl font-semibold">No exact match found.</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Check the model spelling or search the full catalogue by category and
                          specs.
                        </p>
                        <Dialog.Close asChild>
                          <Link
                            href={`/products?q=${encodeURIComponent(query)}`}
                            className="button-primary mt-5"
                          >
                            Search catalogue
                          </Link>
                        </Dialog.Close>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-[20px] border border-[var(--line)] bg-[var(--canvas-alt)] p-5 shadow-2xl lg:flex">
                  <p className="eyebrow">Popular exact models</p>
                  <div className="mt-3 grid gap-1">
                    {popularModels.map((product) => (
                      <Dialog.Close asChild key={product.id}>
                        <Link
                          href={`/products/${product.slug}`}
                          className="rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[var(--tangerine-soft)]"
                        >
                          <span className="block text-[11px] uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
                            {product.brand}
                          </span>
                          {product.model}
                        </Link>
                      </Dialog.Close>
                    ))}
                  </div>

                  <p className="eyebrow mt-7">Need product help?</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Tell us the model or the coverage you need and we will point you to the right
                    hardware.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <a
                      href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                      className="button-secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={17} /> WhatsApp
                    </a>
                    <a href={`tel:${siteConfig.contact.phoneE164}`} className="button-secondary">
                      <Phone size={17} /> {siteConfig.contact.phoneDisplay}
                    </a>
                  </div>
                </aside>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
