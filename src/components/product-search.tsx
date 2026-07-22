"use client";

import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { searchProducts } from "@/data/catalog";

export function ProductSearch({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const results = useMemo(() => (query.trim() ? searchProducts(query).slice(0, 7) : []), [query]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={
            mobile
              ? "flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--canvas-alt)] md:hidden"
              : "hidden h-11 min-w-0 max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-left text-sm text-[var(--muted)] md:flex"
          }
          aria-label="Search products by exact model"
        >
          <Search size={17} />
          {!mobile && <span className="truncate">Search exact model or product</span>}
          {!mobile && (
            <kbd className="ml-auto rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px]">
              /
            </kbd>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-x-3 top-5 z-[100] mx-auto max-h-[calc(100svh-40px)] max-w-2xl overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--canvas)] shadow-2xl sm:top-[10vh]"
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
            <Search size={21} className="text-[var(--tangerine-dark)]" />
            <label htmlFor="product-search-overlay" className="sr-only">
              Search exact models
            </label>
            <input
              id="product-search-overlay"
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
          <div className="max-h-[65vh] overflow-y-auto p-3 sm:p-4" aria-live="polite">
            {!query.trim() ? (
              <div className="p-7 text-center text-sm text-[var(--muted)]">
                Search by model number, product name, brand or category. Dashes and spaces are
                optional.
              </div>
            ) : results.length ? (
              <ul className="grid gap-2">
                {results.map((product, index) => (
                  <li key={product.id}>
                    <Dialog.Close asChild>
                      <Link
                        ref={(element) => {
                          resultRefs.current[index] = element;
                        }}
                        href={`/products/${product.slug}`}
                        className={`grid min-h-20 grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-[var(--tangerine-soft)] focus:bg-[var(--tangerine-soft)] ${activeIndex === index ? "bg-[var(--tangerine-soft)]" : ""}`}
                      >
                        <span className="relative aspect-square overflow-hidden rounded-xl bg-white">
                          <Image
                            src={product.images[0]}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-contain p-2"
                          />
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-xs uppercase tracking-[0.08em] text-[var(--tangerine-dark)]">
                            {product.model}
                          </strong>
                          <span className="mt-1 block truncate font-display text-lg font-semibold">
                            {product.title}
                          </span>
                        </span>
                        <span className="hidden text-xs text-[var(--muted)] sm:block">
                          {product.brand}
                        </span>
                      </Link>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <p className="font-display text-2xl font-semibold">No exact match found.</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Check the model spelling or browse the full catalogue.
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
