"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useCompareStore } from "@/lib/compare-store";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { siteConfig } from "@/config/site";
import { springs } from "@/lib/motion/constants";

/* ── Desktop nav items (simple flat links, NO mega menu) ──── */
const desktopNav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/* ── Mobile nav: main links + utility area ─────────────────── */
const mobileNavLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const mobileUtilityLinks = [
  { href: "/account", label: "Account" },
  { href: "/compare", label: "Compare" },
  { href: "/support", label: "Support" },
  { href: "/downloads", label: "Downloads" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const compareIds = useCompareStore((state) => state.ids);
  const compareCount = compareIds.length;

  /* ── Close mobile menu on route change ──────────────────── */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  /* ── Lock scroll when mobile menu open ──────────────────── */
  useEffect(() => {
    if (mobileOpen) {
      document.body.setAttribute("data-scroll-lock", "true");
    } else {
      document.body.removeAttribute("data-scroll-lock");
    }
    return () => document.body.removeAttribute("data-scroll-lock");
  }, [mobileOpen]);

  /* ── Close on Escape ────────────────────────────────────── */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* ── HEADER SHELL ───────────────────────────────────── */}
      <header className="header-shell">
        <div className="header-inner">
          {/* Left: Brand logo */}
          <Brand responsive compactMark />

          {/* Center: Desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="header-nav-link"
                data-active={isActive(item.href) ? "true" : "false"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-0.5">
            {/* Search */}
            <ProductSearch className="header-action" />

            {/* Compare indicator */}
            {compareCount > 0 && (
              <Link
                href={`/compare?ids=${compareIds.join(",")}`}
                className="header-action hidden sm:inline-flex relative"
                aria-label={`Compare ${compareCount} products`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
                </svg>
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-extrabold text-[var(--accent-contrast)]">
                  {compareCount}
                </span>
              </Link>
            )}

            {/* Account */}
            <Link
              href="/account"
              className="header-action hidden sm:inline-flex"
              aria-label="Account"
            >
              <User size={18} />
            </Link>

            {/* Cart */}
            <button
              type="button"
              onClick={openCart}
              className="header-action inline-flex"
              aria-label={`Open cart with ${count} items`}
            >
              <ShoppingBag size={18} />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={reduceMotion ? false : { scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={springs.interface}
                  className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-extrabold text-[var(--accent-contrast)]"
                >
                  {count}
                </motion.span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="header-action inline-flex lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
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
                  transition={{ duration: 0.18 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[var(--surface)]"
                  initial={reduceMotion ? false : { x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={springs.drawer}
                >
                  {/* Mobile header */}
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <Dialog.Title className="font-display text-xl font-bold">
                      Menu
                    </Dialog.Title>
                    <Dialog.Close
                      className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-[var(--border)]"
                      aria-label="Close menu"
                    >
                      <X size={20} />
                    </Dialog.Close>
                  </div>

                  {/* Mobile nav: main links */}
                  <nav className="flex-1 px-5 pt-6" aria-label="Mobile navigation">
                    <div className="grid gap-1">
                      {mobileNavLinks.map((item) => (
                        <Dialog.Close asChild key={item.href}>
                          <Link
                            href={item.href}
                            className="flex items-center justify-between border-b border-[var(--border)] py-4 font-display text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                          >
                            {item.label}
                          </Link>
                        </Dialog.Close>
                      ))}
                    </div>

                    {/* Utility area */}
                    <div className="mt-8">
                      <p className="eyebrow mb-3">Utility</p>
                      <div className="grid gap-1">
                        {mobileUtilityLinks.map((item) => (
                          <Dialog.Close asChild key={item.href}>
                            <Link
                              href={item.href}
                              className="flex items-center justify-between border-b border-[var(--border)] py-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              {item.label}
                            </Link>
                          </Dialog.Close>
                        ))}
                      </div>
                    </div>
                  </nav>

                  {/* Mobile footer */}
                  <div className="border-t border-[var(--border)] px-5 py-5">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
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
