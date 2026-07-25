"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, Scale, ShoppingBag, X } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { useCartStore } from "@/lib/cart-store";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { getPriceMaxAgeDays, siteConfig } from "@/config/site";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { durations, easings, springs } from "@/lib/motion/constants";

const primaryNav = [
  { href: "/products?q=camera", label: "Cameras" },
  { href: "/categories/biometric-devices", label: "Biometrics" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
] as const;

const shopColumns = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["Popular models", "/products?sort=popular"],
      ["Compare products", "/compare"],
      ["Build a CCTV kit", "/system-builder"],
      ["Downloads", "/downloads"],
    ],
  },
  {
    title: "Categories",
    links: [
      ["CCTV cameras", "/products?q=camera"],
      ["NVRs and storage", "/categories/nvr-systems"],
      ["Biometric devices", "/categories/biometric-devices"],
      ["PoE and networking", "/categories/poe-switches"],
      ["Dome cameras", "/categories/dome-cameras"],
      ["Bullet cameras", "/categories/bullet-cameras"],
    ],
  },
] as const;

const mobileNav = [
  { href: "/products", label: "Shop all products" },
  { href: "/products?q=camera", label: "CCTV cameras" },
  { href: "/categories/nvr-systems", label: "NVRs & storage" },
  { href: "/categories/biometric-devices", label: "Biometrics" },
  { href: "/categories/poe-switches", label: "Networking" },
  { href: "/brands", label: "Brands" },
  { href: "/compare", label: "Compare models" },
  { href: "/system-builder", label: "Build a CCTV kit" },
  { href: "/about", label: "About" },
  { href: "/account", label: "Account" },
  { href: "/support", label: "Customer help" },
  { href: "/contact", label: "Contact" },
] as const;

export function Header({ authConfigured = false }: { authConfigured?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const shopRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const featured = useMemo(
    () => catalogue.find((product) => product.stockStatus === "in_stock") ?? catalogue[0],
    [],
  );
  const featuredEligible = featured
    ? getPurchaseEligibility(featured, { maxAgeDays: getPriceMaxAgeDays() }).eligible
    : false;

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the Shop menu on route change (adjusted during render, not in an effect),
  // as well as on Escape or an outside click.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setShopOpen(false);
  }

  useEffect(() => {
    if (!shopOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShopOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!shopRef.current?.contains(event.target as Node)) setShopOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [shopOpen]);

  return (
    <>
      <div className="border-b border-[var(--line)] bg-[var(--canvas-alt)] py-2 text-center text-[11px] font-semibold tracking-[0.04em] text-[var(--muted)] sm:text-xs">
        GST-inclusive prices · Exact-model documents · Secure checkout · {siteConfig.serviceArea}{" "}
        support
      </div>
      <header className="sticky top-3 z-50 sm:top-4">
        <div className="header-shell">
          <div
            data-header-capsule
            className={`header-capsule flex items-center justify-between gap-3 ${compact ? "header-capsule--compact" : ""}`}
          >
            <Brand responsive compactMark />

            <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
              <div className="relative" ref={shopRef}>
                <button
                  type="button"
                  onClick={() => setShopOpen((value) => !value)}
                  className="header-link"
                  data-active={shopOpen || pathname.startsWith("/products") ? "true" : "false"}
                  aria-expanded={shopOpen}
                  aria-haspopup="true"
                >
                  Shop{" "}
                  <ChevronDown
                    size={13}
                    className={shopOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  />
                </button>
                <AnimatePresence>
                  {shopOpen && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: durations.fast, ease: easings.enter }}
                      className="absolute left-0 top-full mt-3 w-[720px] rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl"
                    >
                      <div className="grid grid-cols-[1fr_1fr_1.05fr] gap-7">
                        {shopColumns.map((column) => (
                          <div key={column.title}>
                            <p className="eyebrow">{column.title}</p>
                            <div className="mt-3 grid gap-0.5">
                              {column.links.map(([label, href]) => (
                                <Link
                                  key={href}
                                  href={href}
                                  onClick={() => setShopOpen(false)}
                                  className="rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--tangerine-soft)] hover:text-[var(--ink)]"
                                >
                                  {label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                        {featured && (
                          <div>
                            <p className="eyebrow">Featured</p>
                            <Link
                              href={`/products/${featured.slug}`}
                              onClick={() => setShopOpen(false)}
                              className="mt-3 block rounded-[14px] border border-[var(--line)] p-3 transition-colors hover:border-[var(--tangerine-border-hover)]"
                            >
                              <span className="relative block aspect-[1.4] overflow-hidden rounded-lg bg-[var(--canvas-alt)]">
                                <Image
                                  src={featured.images[0]}
                                  alt=""
                                  fill
                                  sizes="220px"
                                  className="object-contain p-3"
                                />
                              </span>
                              <span className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tangerine-text)]">
                                {featured.model}
                              </span>
                              <span className="mt-1 block truncate font-display text-lg font-semibold">
                                {featured.title}
                              </span>
                              <span className="mt-1 block text-sm font-bold">
                                {featuredEligible
                                  ? formatPrice(featured.sellingPriceInclGstPaise)
                                  : "Request price"}
                              </span>
                              <span className="mt-2 block text-xs font-bold text-[var(--muted)]">
                                View product →
                              </span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="header-link"
                  data-active={pathname === item.href.split("?")[0] ? "true" : "false"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-0.5">
              <ProductSearch className="inline-flex" />
              <Link
                href="/compare"
                className="header-control hidden sm:inline-flex"
                aria-label="Compare products"
              >
                <Scale size={19} />
              </Link>
              <AccountMenu authConfigured={authConfigured} />
              <button
                type="button"
                onClick={openCart}
                className="header-control inline-flex"
                aria-label={`Open cart with ${count} items`}
              >
                <ShoppingBag size={19} />
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={reduceMotion ? false : { scale: 0.65 }}
                    animate={{ scale: 1 }}
                    transition={springs.interface}
                    className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--tangerine)] px-1 text-[10px] font-extrabold text-[var(--ink)]"
                  >
                    {count}
                  </motion.span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="header-control inline-flex lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <AnimatePresence>
          {mobileOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[70] bg-black/30"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-y-0 right-0 z-[80] w-[min(94vw,430px)] overflow-y-auto bg-[var(--canvas)] p-6 shadow-2xl"
                  initial={reduceMotion ? false : { x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={springs.drawer}
                >
                  <div className="mb-8 flex items-center justify-between">
                    <Dialog.Title className="font-display text-xl font-bold">
                      Shop DeviceDestination
                    </Dialog.Title>
                    <Dialog.Close
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)]"
                      aria-label="Close menu"
                    >
                      <X size={20} />
                    </Dialog.Close>
                  </div>
                  <nav className="grid gap-1" aria-label="Mobile navigation">
                    {mobileNav.map((item) => (
                      <Dialog.Close asChild key={`${item.href}-${item.label}`}>
                        <Link
                          href={item.href}
                          className="border-b border-[var(--line)] py-4 font-display text-2xl font-semibold"
                        >
                          {item.label}
                        </Link>
                      </Dialog.Close>
                    ))}
                  </nav>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
