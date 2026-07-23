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

function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-[var(--accent-soft)] px-0.5 text-inherit">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

/**
 * Shared search experience for both hero inline search and header overlay.
 * "/" keyboard shortcut, Escape closes, focus trap via Radix Dialog.
 * Search by: exact model, product name, category, brand, specifications.
 * Hyphen-insensitive, space-insensitive for model matching.
 * Prioritises exact model matches. Shows max 6 live suggestions.
 */
export function ProductSearch({ className = "", variant = "modal", initialQuery = "" }: { className?: string; variant?: "modal" | "inline"; initialQuery?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const results = useMemo(() => (query.trim() ? searchProducts(query).slice(0, 6) : []), [query]);

  /* "/" shortcut to open search */
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

  /* Inline variant: just the search input with live dropdown, no modal */
  if (variant === "inline") {
    return (
      <div className={`relative ${className}`}>
        <div className="hero-search-bar">
          <Search size={20} className="shrink-0 text-[var(--text-muted)]" />
          <label htmlFor="hero-search-inline" className="sr-only">
            Search exact models, products or categories
          </label>
          <input
            id="hero-search-inline"
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search exact model, product or category"
            className="min-w-0 flex-1 bg-transparent outline-none text-base font-medium"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && results.length) {
                event.preventDefault();
                const next = Math.min(activeIndex + 1, results.length - 1);
                setActiveIndex(next);
                resultRefs.current[next]?.focus();
              }
              if (event.key === "ArrowUp" && results.length) {
                event.preventDefault();
                const prev = Math.max(activeIndex - 1, 0);
                setActiveIndex(prev);
                resultRefs.current[prev]?.focus();
              }
              if (event.key === "Enter" && results[activeIndex]) {
                window.location.href = `/products/${results[activeIndex].slug}`;
              }
              if (event.key === "Escape") {
                setQuery("");
                setActiveIndex(0);
                inputRef.current?.focus();
              }
            }}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="hero-search-results"
            aria-autocomplete="list"
            aria-activedescendant={results[activeIndex] ? `search-result-${activeIndex}` : undefined}
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => { setQuery(""); setActiveIndex(0); inputRef.current?.focus(); }}
              className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-stage)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden lg:inline-flex font-mono text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius-stage)] px-2 py-1">/</kbd>
        </div>
        {/* Live results dropdown */}
        {query.trim() && results.length > 0 && (
          <div
            id="hero-search-results"
            role="listbox"
            className="absolute top-full mt-2 z-50 left-0 right-0 max-h-[320px] overflow-y-auto rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface)] shadow-xl"
          >
            <p className="sr-only" aria-live="polite">{results.length} search results</p>
            <ul className="p-2">
              {results.map((product, index) => {
                const eligible = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible;
                return (
                  <li key={product.id} id={`search-result-${index}`} role="option" aria-selected={index === activeIndex}>
                    <Link
                      ref={(element) => { resultRefs.current[index] = element; }}
                      href={`/products/${product.slug}`}
                      className={`grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-[var(--radius-card)] p-2 transition-colors hover:bg-[var(--accent-soft)] focus:bg-[var(--accent-soft)] ${activeIndex === index ? "bg-[var(--accent-soft)]" : ""}`}
                    >
                      <span className="relative aspect-square overflow-hidden rounded-[var(--radius-stage)] bg-[var(--surface-subtle)]">
                        <Image src={product.images[0]} alt="" fill sizes="56px" className="object-contain p-2" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block font-mono text-xs font-medium text-[var(--text-secondary)]">
                          <Highlight text={product.model} query={query} />
                        </strong>
                        <span className="mt-1 block truncate font-display text-sm font-semibold">
                          <Highlight text={product.title} query={query} />
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {product.category}
                        </span>
                      </span>
                      <span className="text-right">
                        <strong className="block text-sm">
                          {eligible ? formatPrice(product.sellingPriceInclGstPaise) : "Request price"}
                        </strong>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="absolute top-full mt-2 z-50 left-0 right-0 rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface)] shadow-xl p-4 text-center">
            <p className="font-display text-lg font-semibold">No exact match found.</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Check the model spelling or browse the catalogue.</p>
            <Link href={`/products?q=${encodeURIComponent(query)}`} className="button-primary mt-3 inline-flex">
              Search catalogue
            </Link>
          </div>
        )}
      </div>
    );
  }

  /* Modal variant: original overlay search (for header icon trigger) */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`header-action ${className}`}
          aria-label="Search products by exact model"
        >
          <Search size={19} />
        </button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-sm"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-4 top-4 z-[100] mx-auto grid max-h-[calc(100svh-32px)] max-w-2xl gap-3 sm:inset-x-8 sm:top-[8vh]"
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
                <div className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
                  <Dialog.Title className="sr-only">Search the exact-model catalogue</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Search accepts spaces, dashes, brand names and model-number variations.
                  </Dialog.Description>
                  <div className="flex items-center gap-3 border-b border-[var(--border)] p-4 sm:p-5">
                    <Search size={21} className="shrink-0 text-[var(--accent)]" />
                    <label htmlFor="product-search" className="sr-only">Search exact models</label>
                    <input
                      id="product-search"
                      autoFocus
                      value={query}
                      onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                      placeholder="Search exact model, product or category"
                      className="h-12 min-w-0 flex-1 bg-transparent text-lg outline-none"
                    />
                    <Dialog.Close
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-btn)] border border-[var(--border)]"
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
                        <p className="text-sm text-[var(--text-muted)]">
                          Search by model number, product name, brand, specification or category.
                          Dashes and spaces are optional. Press <kbd className="font-mono text-[var(--text-secondary)]">/</kbd> anytime to open.
                        </p>
                      </div>
                    ) : results.length ? (
                      <ul className="grid gap-2">
                        {results.map((product, index) => {
                          const eligible = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible;
                          return (
                            <li key={product.id}>
                              <Dialog.Close asChild>
                                <Link
                                  ref={(element) => { resultRefs.current[index] = element; }}
                                  href={`/products/${product.slug}`}
                                  className={`grid min-h-24 grid-cols-[68px_1fr] items-center gap-3 rounded-[var(--radius-card)] p-2 transition-colors hover:bg-[var(--accent-soft)] focus:bg-[var(--accent-soft)] sm:grid-cols-[68px_1fr_auto] ${activeIndex === index ? "bg-[var(--accent-soft)]" : ""}`}
                                >
                                  <span className="relative aspect-square overflow-hidden rounded-[var(--radius-stage)] bg-[var(--surface-subtle)]">
                                    <Image src={product.images[0]} alt="" fill sizes="68px" className="object-contain p-2" />
                                  </span>
                                  <span className="min-w-0">
                                    <strong className="block font-mono text-xs font-medium text-[var(--text-secondary)]">
                                      <Highlight text={product.model} query={query} />
                                    </strong>
                                    <span className="mt-1 block truncate font-display text-lg font-semibold">
                                      <Highlight text={product.title} query={query} />
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--text-muted)] sm:hidden">
                                      {product.category} · {eligible ? "Available" : "Check availability"}
                                    </span>
                                  </span>
                                  <span className="hidden text-right sm:block">
                                    <strong className="block text-sm">
                                      {eligible ? formatPrice(product.sellingPriceInclGstPaise) : "Request price"}
                                    </strong>
                                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                                      {product.category} · {eligible ? "Available" : "Check availability"}
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
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                          Check the model spelling or search the full catalogue by category and specs.
                        </p>
                        <Dialog.Close asChild>
                          <Link href={`/products?q=${encodeURIComponent(query)}`} className="button-primary mt-5">
                            Search catalogue
                          </Link>
                        </Dialog.Close>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
