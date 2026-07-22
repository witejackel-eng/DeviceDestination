"use client";

import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts } from "@/data/catalog";
import { getPriceMaxAgeDays } from "@/config/site";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { durations, easings } from "@/lib/motion/constants";

type SearchMode = "header" | "mobile" | "hero";

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

export function ProductSearch({ mode = "header" }: { mode?: SearchMode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const reduceMotion = useReducedMotion();
  const results = useMemo(() => (query.trim() ? searchProducts(query).slice(0, 7) : []), [query]);

  useEffect(() => {
    if (mode !== "header") return;
    const openWithSlash = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", openWithSlash);
    return () => window.removeEventListener("keydown", openWithSlash);
  }, [mode]);

  const triggerClass =
    mode === "mobile"
      ? "flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--tangerine-subtle)] md:hidden"
      : mode === "hero"
        ? "flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[var(--tangerine-border)] bg-white px-5 text-left shadow-[0_18px_44px_var(--tangerine-shadow)] transition-colors hover:border-[var(--tangerine-border-hover)]"
        : "hidden h-11 min-w-0 max-w-[230px] flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-left text-sm text-[var(--muted)] lg:flex";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <motion.button
          type="button"
          className={triggerClass}
          aria-label="Search products by exact model"
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        >
          <Search
            size={mode === "hero" ? 21 : 17}
            className="shrink-0 text-[var(--tangerine-text)]"
          />
          {mode !== "mobile" && (
            <span className={`truncate ${mode === "hero" ? "text-base text-[var(--ink)]" : ""}`}>
              {mode === "hero" ? "Search by model, product or category" : "Search model or product"}
            </span>
          )}
          {mode === "header" && (
            <kbd className="ml-auto rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px]">
              /
            </kbd>
          )}
        </motion.button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-3 top-5 z-[100] mx-auto max-h-[calc(100svh-40px)] max-w-2xl overflow-hidden rounded-[24px] border border-[var(--tangerine-border)] bg-[var(--canvas)] shadow-2xl sm:top-[10vh]"
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
                <Dialog.Title className="sr-only">Search the exact-model catalogue</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Search accepts spaces, dashes, brand names and model-number variations.
                </Dialog.Description>
                <div className="flex items-center gap-3 border-b border-[var(--line)] p-4 sm:p-5">
                  <Search size={21} className="text-[var(--tangerine-text)]" />
                  <label htmlFor={`product-search-${mode}`} className="sr-only">
                    Search exact models
                  </label>
                  <input
                    id={`product-search-${mode}`}
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
                    className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)]"
                    aria-label="Close search"
                  >
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <div className="max-h-[65vh] overflow-y-auto p-3 sm:p-4">
                  <p className="sr-only" aria-live="polite">
                    {query.trim() ? `${results.length} search results` : "Search ready"}
                  </p>
                  {!query.trim() ? (
                    <div className="p-7 text-center text-sm text-[var(--muted)]">
                      Search by model number, product name, brand, specification or category. Dashes
                      and spaces are optional.
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
                        Check the model spelling or search the full catalogue by category and specs.
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
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
