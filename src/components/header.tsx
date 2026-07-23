"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, ShoppingBag, User, X, ArrowRight, ChevronRight, MessageCircle, Phone, Mail } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useCompareStore } from "@/lib/compare-store";
import { useModalLayer, lockScroll, unlockScroll } from "@/lib/modal-layer";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { siteConfig } from "@/config/site";
import { springs, modalTiming, easings, durations } from "@/lib/motion/constants";

/* ── Desktop nav items ──────────────────────────────────── */
const desktopNav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/* ── Mobile/tablet menu: primary links ──────────────────── */
const primaryNavLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/* ── Category shortcuts ─────────────────────────────────── */
const categoryShortcuts = [
  { href: "/products?q=camera", label: "CCTV Cameras" },
  { href: "/categories/nvr-systems", label: "NVR & Recording" },
  { href: "/categories/biometric-devices", label: "Biometric Devices" },
  { href: "/categories/poe-switches", label: "PoE & Networking" },
];

/* ── Utility links ──────────────────────────────────────── */
const utilityLinks = [
  { href: "/account", label: "Account" },
  { href: "/compare", label: "Compare" },
  { href: "/support", label: "Support" },
  { href: "/downloads", label: "Downloads" },
];

/* ── Trust items ────────────────────────────────────────── */
const trustItems = [
  "GST-inclusive pricing",
  "Exact-model documents",
  "OEM warranty support",
  "Secure checkout",
];

export function Header() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const cartClose = useCartStore((state) => state.close);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const compareIds = useCompareStore((state) => state.ids);
  const compareCount = compareIds.length;

  // ── Modal layer coordination ──
  const modalActive = useModalLayer((s) => s.active);
  const requestOpen = useModalLayer((s) => s.requestOpen);
  const requestClose = useModalLayer((s) => s.requestClose);
  const menuOpen = modalActive === "menu";

  // Track the hamburger trigger for focus restoration
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  /* ── Open menu — close cart first if open ─────────────── */
  const handleOpenMenu = useCallback(() => {
    if (modalActive === "cart") cartClose();
    requestOpen("menu");
  }, [modalActive, cartClose, requestOpen]);

  /* ── Close menu ───────────────────────────────────────── */
  const handleCloseMenu = useCallback(() => {
    requestClose("menu");
    // Restore focus to trigger
    setTimeout(() => menuTriggerRef.current?.focus(), 50);
  }, [requestClose]);

  /* ── Open cart — close menu first if open ─────────────── */
  const handleOpenCart = useCallback(() => {
    if (modalActive === "menu") requestClose("menu");
    openCart();
  }, [modalActive, requestClose, openCart]);

  /* ── Close menu on route change ───────────────────────── */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    requestClose("menu");
  }

  /* ── Scroll lock + scrollbar-width preservation ───────── */
  useEffect(() => {
    if (menuOpen) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // ── Easing for entrance/exit ──
  const ease = easings.standard;

  return (
    <>
      {/* ── HEADER SHELL ─────────────────────────────────── */}
      <header className="header-shell">
        <div className="header-inner">
          <Brand responsive compactMark />

          {/* Desktop navigation */}
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
            <ProductSearch className="header-action" />

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

            <Link
              href="/account"
              className="header-action hidden sm:inline-flex"
              aria-label="Account"
            >
              <User size={18} />
            </Link>

            {/* Cart — closes menu if open */}
            <button
              type="button"
              onClick={handleOpenCart}
              className="header-action inline-flex"
              aria-label={`Open cart with ${count} items`}
            >
              <ShoppingBag size={18} />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={reduceMotion ? undefined : { scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={springs.interface}
                  className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-extrabold text-[var(--accent-contrast)]"
                >
                  {count}
                </motion.span>
              )}
            </button>

            {/* Hamburger trigger */}
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={handleOpenMenu}
              className="header-action inline-flex lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          FLOATING NAVIGATION MENU
          Desktop/tablet: two-panel floating modal
          Mobile: single inset floating panel
          ═══════════════════════════════════════════════════ */}
      <Dialog.Root open={menuOpen} onOpenChange={(open) => !open && handleCloseMenu()}>
        <AnimatePresence>
          {menuOpen && (
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
                  onClick={handleCloseMenu}
                />
              </Dialog.Overlay>

              {/* ── External close control (tablet/desktop) ── */}
              <motion.div
                className="modal-close-pill"
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, delay: modalTiming.closeDelay, ease }}
              >
                <Dialog.Close
                  className="group flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-white font-semibold text-sm tracking-wide transition-all duration-160"
                  aria-label="Close menu"
                  style={{ boxShadow: "0 8px 32px rgba(255,106,0,0.28)" }}
                >
                  <X
                    size={16}
                    strokeWidth={2.5}
                    className="transition-transform duration-200 group-hover:rotate-45"
                  />
                  <span>CLOSE</span>
                </Dialog.Close>
              </motion.div>

              {/* ── MENU PANEL ── */}
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="floating-menu-panel"
                  initial={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.99 }}
                  transition={modalTiming.panel.enter}
                >
                  {/* ── MOBILE LAYOUT ── */}
                  <div className="flex flex-col h-full sm:hidden">
                    {/* Mobile header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border)]">
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

                    {/* Mobile scrollable body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4" aria-label="Mobile navigation">
                      {/* Primary nav */}
                      <nav>
                        <p className="eyebrow mb-4">Navigate DeviceDestination</p>
                        <div className="grid gap-0.5">
                          {primaryNavLinks.map((item) => (
                            <Dialog.Close asChild key={item.href}>
                              <Link
                                href={item.href}
                                className="group flex items-center justify-between py-3.5 border-b border-[var(--border)] font-display text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors duration-160"
                              >
                                {item.label}
                                {isActive(item.href) && (
                                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                                )}
                                <ChevronRight
                                  size={16}
                                  className="ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-160"
                                />
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </nav>

                      {/* Category shortcuts */}
                      <div className="mt-6">
                        <p className="eyebrow mb-3">Shop hardware</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {categoryShortcuts.map((cat) => (
                            <Dialog.Close asChild key={cat.href}>
                              <Link
                                href={cat.href}
                                className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-160"
                              >
                                {cat.label}
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </div>

                      {/* Utility links */}
                      <div className="mt-6">
                        <p className="eyebrow mb-3">Utility</p>
                        <div className="grid gap-1">
                          {utilityLinks.map((item) => (
                            <Dialog.Close asChild key={item.href}>
                              <Link
                                href={item.href}
                                className="flex items-center justify-between py-2.5 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-160"
                              >
                                {item.label}
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Mobile footer */}
                    <div className="border-t border-[var(--border)] px-5 py-4">
                      <div className="flex flex-col gap-2">
                        <a
                          href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                          className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
                          aria-label="WhatsApp product help"
                        >
                          <MessageCircle size={16} />
                          WhatsApp product help
                        </a>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                          {trustItems.slice(0, 3).map((t, i) => (
                            <span key={t}>
                              {i > 0 && <span>·</span>}
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── TABLET/DESKTOP TWO-PANEL LAYOUT ── */}
                  <div className="hidden sm:flex gap-[14px] h-full">
                    {/* LEFT: Primary panel (~66%) */}
                    <div className="flex flex-col w-[66%] min-w-0 p-[38px] overflow-y-auto">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Brand compact compactMark />
                          <span className="font-display text-xl font-bold">Menu</span>
                        </div>
                        {/* No primary close button here — external pill handles it */}
                      </div>

                      <p className="eyebrow mb-5">Navigate DeviceDestination</p>

                      {/* Primary navigation links */}
                      <nav aria-label="Primary navigation">
                        <div className="grid gap-0.5">
                          {primaryNavLinks.map((item, i) => (
                            <motion.div
                              key={item.href}
                              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: durations.normal,
                                delay: reduceMotion ? 0 : 0.18 + i * modalTiming.stagger,
                                ease,
                              }}
                            >
                              <Dialog.Close asChild>
                                <Link
                                  href={item.href}
                                  className="group flex items-center justify-between py-[16px] border-b border-[var(--border)] font-display text-[clamp(28px,4vw,38px)] font-semibold leading-[1.05] text-[var(--text-primary)] hover:text-[var(--accent)] hover:translate-x-[4px] transition-all duration-160"
                                >
                                  <span className="flex items-center gap-3">
                                    {isActive(item.href) && (
                                      <span className="h-[6px] w-[6px] rounded-full bg-[var(--accent)]" />
                                    )}
                                    {item.label}
                                  </span>
                                  <ChevronRight
                                    size={20}
                                    className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-160"
                                  />
                                </Link>
                              </Dialog.Close>
                            </motion.div>
                          ))}
                        </div>
                      </nav>

                      {/* Category shortcuts */}
                      <motion.div
                        className="mt-8"
                        initial={reduceMotion ? undefined : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: durations.normal, delay: reduceMotion ? 0 : 0.36 }}
                      >
                        <p className="eyebrow mb-3">Shop hardware</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          {categoryShortcuts.map((cat) => (
                            <Dialog.Close asChild key={cat.href}>
                              <Link
                                href={cat.href}
                                className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-160"
                              >
                                {cat.label}
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </motion.div>
                    </div>

                    {/* RIGHT: Support panel (~34%) */}
                    <motion.div
                      className="flex flex-col w-[34%] min-w-0 rounded-[26px] bg-[var(--dark)] text-white p-[30px] overflow-y-auto"
                      initial={reduceMotion ? undefined : { opacity: 0, x: 16, scale: 0.99 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                      transition={{ duration: durations.normal, delay: modalTiming.secondaryDelay, ease }}
                    >
                      <p className="text-sm font-bold tracking-wide text-white/60 uppercase mb-4">
                        Product support
                      </p>
                      <p className="text-base leading-7 text-white/80 mb-6">
                        Need help identifying a model or building a compatible system? Contact the DeviceDestination team.
                      </p>

                      {/* Support actions */}
                      <div className="grid gap-3">
                        <a
                          href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                          className="flex items-center gap-2.5 rounded-[var(--radius-btn)] border border-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors duration-160"
                          aria-label="WhatsApp product help"
                        >
                          <MessageCircle size={16} className="text-[var(--accent)]" />
                          WhatsApp product help
                        </a>
                        <Dialog.Close asChild>
                          <Link
                            href="/contact"
                            className="flex items-center gap-2.5 rounded-[var(--radius-btn)] border border-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors duration-160"
                          >
                            <Phone size={16} className="text-[var(--accent)]" />
                            Contact us
                          </Link>
                        </Dialog.Close>
                        <Dialog.Close asChild>
                          <Link
                            href="/compare"
                            className="flex items-center gap-2.5 rounded-[var(--radius-btn)] border border-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors duration-160"
                          >
                            <ArrowRight size={16} className="text-[var(--accent)]" />
                            Compare products
                          </Link>
                        </Dialog.Close>
                      </div>

                      {/* Contact info */}
                      <div className="mt-6 space-y-2 text-sm text-white/50">
                        <p className="flex items-center gap-2">
                          <Phone size={14} />
                          {siteConfig.contact.phoneDisplay}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail size={14} />
                          {siteConfig.contact.email}
                        </p>
                        <p>{siteConfig.serviceArea} service area</p>
                      </div>

                      {/* Utility links */}
                      <div className="mt-6 border-t border-white/10 pt-5">
                        <div className="grid gap-2.5">
                          {utilityLinks.map((item) => (
                            <Dialog.Close asChild key={item.href}>
                              <Link
                                href={item.href}
                                className="text-sm font-semibold text-white/60 hover:text-white transition-colors duration-160"
                              >
                                {item.label}
                              </Link>
                            </Dialog.Close>
                          ))}
                        </div>
                      </div>

                      {/* Trust line */}
                      <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
                        {trustItems.map((t, i) => (
                          <span key={t} className="flex items-center gap-1.5">
                            {i > 0 && <span>·</span>}
                            {t}
                          </span>
                        ))}
                      </div>
                    </motion.div>
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
