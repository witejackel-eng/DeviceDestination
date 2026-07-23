"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { useCartStore } from "@/lib/cart-store";
import { useCompareStore } from "@/lib/compare-store";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { getPriceMaxAgeDays, siteConfig } from "@/config/site";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { durations, easings, springs } from "@/lib/motion/constants";

/* ── Navigation structure ─────────────────────────────────── */

const primaryNav = [
  { href: "/products", label: "Shop" },
  { href: "/products?q=camera", label: "Cameras" },
  { href: "/categories/biometric-devices", label: "Biometrics" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
] as const;

const shopCategories = [
  { label: "CCTV cameras", href: "/products?q=camera", color: "var(--coral-soft)", icon: "camera" },
  { label: "Dome cameras", href: "/categories/dome-cameras", color: "var(--powder-blue-soft)", icon: "dome" },
  { label: "Bullet cameras", href: "/categories/bullet-cameras", color: "var(--butter-soft)", icon: "bullet" },
  { label: "NVR systems", href: "/categories/nvr-systems", color: "var(--lilac-soft)", icon: "nvr" },
  { label: "Biometric devices", href: "/categories/biometric-devices", color: "var(--mint-soft)", icon: "biometric" },
  { label: "PoE and networking", href: "/categories/poe-switches", color: "var(--technical-grey)", icon: "poe" },
];

const shopLinks = [
  { label: "All products", href: "/products" },
  { label: "Popular models", href: "/products?sort=popular" },
  { label: "Compare products", href: "/compare" },
];

const stripLinks = [
  { label: "Build a CCTV system", href: "/system-builder" },
  { label: "Downloads", href: "/downloads" },
  { label: "Customer support", href: "/support" },
];

/* Mobile nav sections */
const mobileNavSections = [
  {
    heading: "Shop",
    links: [
      { href: "/products", label: "All products" },
      { href: "/products?q=camera", label: "CCTV cameras" },
      { href: "/categories/nvr-systems", label: "NVRs & storage" },
      { href: "/categories/biometric-devices", label: "Biometrics" },
      { href: "/categories/poe-switches", label: "Networking" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { href: "/compare", label: "Compare models" },
      { href: "/system-builder", label: "Build a CCTV kit" },
      { href: "/downloads", label: "Downloads" },
      { href: "/brands", label: "Brands" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/account", label: "Account" },
      { href: "/support", label: "Customer help" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

const mobileCategoryPanels = [
  { label: "Cameras", href: "/products?q=camera", bg: "var(--coral-soft)" },
  { label: "NVRs", href: "/categories/nvr-systems", bg: "var(--lilac-soft)" },
  { label: "Biometrics", href: "/categories/biometric-devices", bg: "var(--mint-soft)" },
  { label: "Networking", href: "/categories/poe-switches", bg: "var(--butter-soft)" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const shopRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const compareIds = useCompareStore((state) => state.ids);
  const compareCount = compareIds.length;

  const featured = useMemo(
    () => catalogue.find((product) => product.stockStatus === "in_stock") ?? catalogue[0],
    [],
  );
  const featuredEligible = featured
    ? getPurchaseEligibility(featured, { maxAgeDays: getPriceMaxAgeDays() }).eligible
    : false;

  /* ── Scroll handler for compact header ──────────────────── */
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Close shop menu on route change ────────────────────── */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setShopOpen(false);
  }

  /* ── Shop menu: Escape + outside click ──────────────────── */
  const closeShop = useCallback(() => setShopOpen(false), []);
  useEffect(() => {
    if (!shopOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeShop();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!shopRef.current?.contains(event.target as Node)) closeShop();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [shopOpen, closeShop]);

  /* ── Focus trap for mega menu (basic) ──────────────────── */
  useEffect(() => {
    if (!shopOpen) return;
    const shopPanel = shopRef.current;
    if (!shopPanel) return;
    const focusable = shopPanel.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    first.focus();
    shopPanel.addEventListener("keydown", handleTab);
    return () => shopPanel.removeEventListener("keydown", handleTab);
  }, [shopOpen]);

  /* Determine active nav */
  const isShopActive = shopOpen || pathname.startsWith("/products") || pathname.startsWith("/categories");

  return (
    <>
      {/* ── HEADER SHELL ───────────────────────────────────── */}
      <header className="sticky top-5 z-50 sm:top-6">
        <div className="header-shell">
          <motion.div
            data-header-capsule
            className={`header-capsule flex items-center justify-between gap-4 ${compact ? "header-capsule--compact" : ""}`}
            layout
          >
            <Brand responsive compactMark />

            {/* ── Desktop navigation ─────────────────────────── */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
              {/* Shop dropdown trigger */}
              <div className="relative" ref={shopRef}>
                <button
                  type="button"
                  onClick={() => setShopOpen((value) => !value)}
                  className="header-link"
                  data-active={isShopActive ? "true" : "false"}
                  aria-expanded={shopOpen}
                  aria-haspopup="true"
                >
                  Shop
                </button>

                {/* ── MEGA MENU ─────────────────────────────────── */}
                <AnimatePresence>
                  {shopOpen && (
                    <motion.div
                      role="dialog"
                      aria-label="Shop menu"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: durations.normal, ease: easings.enter }}
                      className="mega-menu"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3">
                        {/* Panel 1 — Categories (coral background) */}
                        <div
                          className="mega-menu-panel"
                          style={{ background: "var(--coral-soft)" }}
                        >
                          <h3 className="font-display text-[var(--ink)]">Browse hardware</h3>
                          <p className="text-[var(--ink-soft)]">
                            Find the exact camera, recorder or device you need.
                          </p>
                          <div className="grid gap-0.5">
                            {shopCategories.slice(0, 3).map((cat) => (
                              <Link
                                key={cat.href}
                                href={cat.href}
                                onClick={closeShop}
                                className="mega-menu-link group"
                              >
                                {cat.label}
                                <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Panel 2 — More categories (butter background) */}
                        <div
                          className="mega-menu-panel"
                          style={{ background: "var(--butter-soft)" }}
                        >
                          <h3 className="font-display text-[var(--ink)]">Recording & access</h3>
                          <p className="text-[var(--ink-soft)]">
                            NVR systems, biometric devices and networking.
                          </p>
                          <div className="grid gap-0.5">
                            {shopCategories.slice(3).map((cat) => (
                              <Link
                                key={cat.href}
                                href={cat.href}
                                onClick={closeShop}
                                className="mega-menu-link group"
                              >
                                {cat.label}
                                <ArrowRight size={13} />
                              </Link>
                            ))}
                            {shopLinks.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={closeShop}
                                className="mega-menu-link group"
                              >
                                {link.label}
                                <ArrowRight size={13} />
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Panel 3 — Featured product (powder blue) */}
                        <div
                          className="mega-menu-panel"
                          style={{ background: "var(--powder-blue-soft)" }}
                        >
                          <h3 className="font-display text-[var(--ink)]">Featured product</h3>
                          <p className="text-[var(--ink-soft)]">
                            A popular in-stock model ready to ship.
                          </p>
                          {featured && (
                            <Link
                              href={`/products/${featured.slug}`}
                              onClick={closeShop}
                              className="mt-2 block rounded-[18px] border border-[var(--line)] bg-white/60 p-3 transition-colors hover:border-[var(--tangerine-border-hover)] hover:bg-white"
                            >
                              <span className="relative block aspect-[1.35] overflow-hidden rounded-2xl bg-[var(--canvas)]">
                                <Image
                                  src={featured.images[0]}
                                  alt=""
                                  fill
                                  sizes="240px"
                                  className="object-contain p-4"
                                />
                              </span>
                              <span className="mt-2.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
                                {featured.model}
                              </span>
                              <span className="mt-1 block font-display text-base font-bold leading-tight">
                                {featured.title}
                              </span>
                              <span className="mt-1.5 block text-sm font-bold">
                                {featuredEligible
                                  ? formatPrice(featured.sellingPriceInclGstPaise)
                                  : "Request price"}
                              </span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* ── Quick links strip ─────────────────────── */}
                      <div className="mega-menu-strip">
                        {stripLinks.map((link) => (
                          <Link key={link.href} href={link.href} onClick={closeShop}>
                            {link.label}
                          </Link>
                        ))}
                        <span className="ml-auto text-[var(--muted)]">
                          {siteConfig.serviceArea} support
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {primaryNav
                .filter((item) => item.label !== "Shop")
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="header-link"
                    data-active={
                      pathname === item.href.split("?")[0] ? "true" : "false"
                    }
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>

            {/* ── Right-side actions ──────────────────────────── */}
            <div className="flex items-center gap-1">
              <ProductSearch className="inline-flex" />

              {/* Compare indicator */}
              {compareCount > 0 && (
                <Link
                  href={`/compare?ids=${compareIds.join(",")}`}
                  className="header-control hidden sm:inline-flex relative"
                  aria-label={`Compare ${compareCount} products`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--lilac)] px-1 text-[9px] font-extrabold text-[var(--ink)]">
                    {compareCount}
                  </span>
                </Link>
              )}

              <Link
                href="/account"
                className="header-control hidden sm:inline-flex"
                aria-label="Account"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </Link>
              <button
                type="button"
                onClick={openCart}
                className="header-control inline-flex"
                aria-label={`Open cart with ${count} items`}
              >
                <ShoppingBag size={18} />
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={reduceMotion ? false : { scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={springs.interface}
                    className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--tangerine)] px-1 text-[10px] font-extrabold text-[var(--ink)]"
                  >
                    {count}
                  </motion.span>
                )}
              </button>

              {/* ── CTA circle (shop arrow) ─────────────────────── */}
              <Link
                href="/products"
                className="header-cta-circle hidden lg:inline-flex"
                aria-label="Browse all products"
              >
                <ArrowRight size={18} />
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="header-control inline-flex lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ── MOBILE NAVIGATION ───────────────────────────────── */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <AnimatePresence>
          {mobileOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-sm"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: durations.fast }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[var(--canvas)]"
                  initial={reduceMotion ? false : { x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={springs.drawer}
                >
                  {/* Mobile header */}
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                    <Dialog.Title className="font-display text-xl font-bold">
                      Menu
                    </Dialog.Title>
                    <Dialog.Close
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)]"
                      aria-label="Close menu"
                    >
                      <X size={20} />
                    </Dialog.Close>
                  </div>

                  {/* Mobile search */}
                  <div className="px-5 pt-5">
                    <div className="hero-search-bar">
                      <Search size={18} className="text-[var(--muted)]" />
                      <ProductSearch className="min-w-0 flex-1" />
                    </div>
                  </div>

                  {/* Mobile nav sections */}
                  <nav className="flex-1 px-5 pt-6" aria-label="Mobile navigation">
                    {mobileNavSections.map((section) => (
                      <div key={section.heading} className="mb-8">
                        <p className="eyebrow mb-3">{section.heading}</p>
                        <div className="grid gap-0.5">
                          {section.links.map((item) => (
                            <Dialog.Close asChild key={`${item.href}-${item.label}`}>
                              <Link
                                href={item.href}
                                className="flex items-center justify-between border-b border-[var(--line)] py-3.5 font-display text-xl font-semibold"
                              >
                                {item.label}
                                <ArrowRight size={16} className="text-[var(--muted)]" />
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Featured category panels */}
                    <div className="mb-8">
                      <p className="eyebrow mb-3">Quick browse</p>
                      <div className="grid grid-cols-2 gap-3">
                        {mobileCategoryPanels.map((tile) => (
                          <Dialog.Close asChild key={tile.href}>
                            <Link
                              href={tile.href}
                              className="category-panel flex items-center justify-between p-4 font-display text-base font-bold"
                              style={{ background: tile.bg }}
                            >
                              {tile.label}
                              <ArrowRight size={14} />
                            </Link>
                          </Dialog.Close>
                        ))}
                      </div>
                    </div>
                  </nav>

                  {/* Mobile footer */}
                  <div className="border-t border-[var(--line)] px-5 py-5">
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                      <span>Prices include GST</span>
                      <span>·</span>
                      <span>{siteConfig.serviceArea} support</span>
                    </div>
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
