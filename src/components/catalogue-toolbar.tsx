"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { durations, springs } from "@/lib/motion/constants";

type Category = { slug: string; name: string };
type Brand = { slug: string; name: string };

interface CatalogueToolbarProps {
  q: string;
  category: string;
  brand: string;
  sort: string;
  resolution: string;
  poe: string;
  availability: string;
  price: string;
  authentication: string;
  cameraContext: boolean;
  biometricContext: boolean;
  poeContext: boolean;
  allCategories: Category[];
  allBrands: Brand[];
}

export function CatalogueToolbar({
  q,
  category,
  brand,
  sort,
  resolution,
  poe,
  availability,
  price,
  authentication,
  cameraContext,
  biometricContext,
  poeContext,
  allCategories,
  allBrands,
}: CatalogueToolbarProps) {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const buildHref = (updates: Record<string, string>) => {
    const current = new URLSearchParams();
    if (q) current.set("q", q);
    if (category) current.set("category", category);
    if (brand) current.set("brand", brand);
    if (sort && sort !== "relevance") current.set("sort", sort);
    if (resolution) current.set("resolution", resolution);
    if (poe) current.set("poe", poe);
    if (availability) current.set("availability", availability);
    if (price) current.set("price", price);
    if (authentication) current.set("authentication", authentication);
    for (const [k, v] of Object.entries(updates)) {
      if (v) current.set(k, v);
      else current.delete(k);
    }
    const qs = current.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  const hasActiveFilters = category || brand || price || availability || resolution || poe || authentication;
  const activeCount = [category, brand, price, availability, resolution, poe, authentication].filter(Boolean).length;

  return (
    <>
      <div className="catalogue-toolbar">
        {/* Search indicator */}
        <div className="filter-pill cursor-default !gap-2">
          <Search size={14} />
          {q ? (
            <span className="max-w-[120px] truncate">{q}</span>
          ) : (
            <span className="text-[var(--text-muted)]">Search model…</span>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => {
              window.location.href = buildHref({ sort: e.target.value });
            }}
            className="filter-pill appearance-none pr-7"
          >
            <option value="relevance">Model</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="newest">Recently verified</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
        </div>

        {/* Desktop: Category pills */}
        <div className="hidden lg:flex items-center gap-1.5">
          <FilterLink href="/products" active={!category} label="All" />
          <div className="w-px h-4 bg-[var(--border)]" />
          <FilterLink
            href={buildHref({ category: "dome-cameras" })}
            active={category === "dome-cameras"}
            label="Dome"
          />
          <FilterLink
            href={buildHref({ category: "bullet-cameras" })}
            active={category === "bullet-cameras" || category === "color-bullet-cameras"}
            label="Bullet"
          />
          <FilterLink
            href={buildHref({ category: "nvr-systems" })}
            active={category === "nvr-systems"}
            label="NVR"
          />
          <FilterLink
            href={buildHref({ category: "biometric-devices" })}
            active={category === "biometric-devices"}
            label="Biometric"
          />
          <FilterLink
            href={buildHref({ category: "poe-switches" })}
            active={category === "poe-switches"}
            label="Networking"
          />
        </div>

        {/* Brand pill (desktop) */}
        {brand && (
          <FilterLink href={buildHref({ brand: "" })} active={false} label={allBrands.find((b) => b.slug === brand)?.name ?? brand} />
        )}

        {/* All filters button */}
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className={`filter-pill ${hasActiveFilters ? "filter-pill--active" : ""}`}
        >
          <SlidersHorizontal size={14} />
          All filters
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-[var(--accent-contrast)]">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── FILTER DRAWER ─────────────────────────────────────── */}
      <Dialog.Root open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <AnimatePresence>
          {filterDrawerOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-sm"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: durations.fast }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-y-0 right-0 z-[90] flex w-[min(94vw,480px)] flex-col bg-[var(--surface)] shadow-2xl"
                  initial={reduceMotion ? false : { x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={springs.drawer}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] p-5 sm:p-6">
                    <Dialog.Title className="font-display text-2xl font-bold">
                      Filters
                    </Dialog.Title>
                    <Dialog.Close
                      className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-btn)] border border-[var(--border)]"
                      aria-label="Close filters"
                    >
                      <X size={18} />
                    </Dialog.Close>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    <FilterDrawerForm
                      q={q}
                      category={category}
                      brand={brand}
                      sort={sort}
                      resolution={resolution}
                      poe={poe}
                      availability={availability}
                      price={price}
                      authentication={authentication}
                      cameraContext={cameraContext}
                      biometricContext={biometricContext}
                      poeContext={poeContext}
                      allCategories={allCategories}
                      allBrands={allBrands}
                    />
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}

/* ── Filter pill link ──────────────────────────────────────── */

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`filter-pill ${active ? "filter-pill--active" : ""}`}
    >
      {label}
    </a>
  );
}

/* ── Filter drawer form ────────────────────────────────────── */

function FilterDrawerForm({
  q, category, brand, sort, resolution, poe, availability, price, authentication,
  cameraContext, biometricContext, poeContext, allCategories, allBrands,
}: CatalogueToolbarProps) {
  return (
    <form action="/products" className="grid gap-5">
      {/* Search */}
      <FilterField label="Search exact model">
        <div className="flex items-center rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input name="q" defaultValue={q} placeholder="e.g. CP-UNC-DA21L3C-Q" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
        </div>
      </FilterField>

      {/* Category */}
      <FilterField label="Category">
        <Select name="category" defaultValue={category} options={[
          { value: "", label: "All categories" },
          ...allCategories.map((c) => ({ value: c.slug, label: c.name })),
        ]} />
      </FilterField>

      {/* Brand */}
      <FilterField label="Brand">
        <Select name="brand" defaultValue={brand} options={[
          { value: "", label: "All brands" },
          ...allBrands.map((b) => ({ value: b.slug, label: b.name })),
        ]} />
      </FilterField>

      {/* Resolution */}
      {cameraContext && (
        <FilterField label="Resolution">
          <Select name="resolution" defaultValue={resolution} options={[
            { value: "", label: "All resolutions" },
            { value: "2mp", label: "2 MP" },
            { value: "4mp", label: "4 MP" },
            { value: "6mp", label: "6 MP" },
          ]} />
        </FilterField>
      )}

      {/* PoE */}
      {poeContext && (
        <FilterField label="Power over Ethernet">
          <Select name="poe" defaultValue={poe} options={[
            { value: "", label: "Any power method" },
            { value: "yes", label: "PoE supported" },
            { value: "no", label: "Without PoE" },
          ]} />
        </FilterField>
      )}

      {/* Authentication */}
      {biometricContext && (
        <FilterField label="Authentication">
          <Select name="authentication" defaultValue={authentication} options={[
            { value: "", label: "All methods" },
            { value: "face", label: "Face recognition" },
            { value: "fingerprint", label: "Fingerprint" },
          ]} />
        </FilterField>
      )}

      {/* Availability */}
      <FilterField label="Availability">
        <Select name="availability" defaultValue={availability} options={[
          { value: "", label: "All availability" },
          { value: "buy-now", label: "Available to buy" },
          { value: "quote", label: "Request price / lead time" },
        ]} />
      </FilterField>

      {/* Price */}
      <FilterField label="Price">
        <Select name="price" defaultValue={price} options={[
          { value: "", label: "Any price" },
          { value: "under-5000", label: "Under ₹5,000" },
          { value: "5000-15000", label: "₹5,000–₹15,000" },
          { value: "over-15000", label: "Over ₹15,000" },
        ]} />
      </FilterField>

      {/* Sort */}
      <FilterField label="Sort">
        <Select name="sort" defaultValue={sort} options={[
          { value: "relevance", label: "Model" },
          { value: "price-low", label: "Price: low to high" },
          { value: "price-high", label: "Price: high to low" },
          { value: "newest", label: "Recently verified" },
        ]} />
      </FilterField>

      <div className="grid gap-2 pt-2">
        <button className="button-primary w-full" type="submit">Apply filters</button>
        <Link href="/products" className="button-tertiary w-full text-center">Clear all</Link>
      </div>
    </form>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="eyebrow">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Select({ name, defaultValue, options }: { name: string; defaultValue: string; options: { value: string; label: string }[] }) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue}
      className="h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
