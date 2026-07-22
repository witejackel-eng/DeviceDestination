"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, Scale, ShoppingBag, UserRound, X } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { siteConfig } from "@/config/site";
import { durations, easings, springs } from "@/lib/motion/constants";

const primaryNav = [
  { href: "/products?q=camera", label: "CCTV Cameras" },
  { href: "/categories/nvr-systems", label: "NVRs & Storage" },
  { href: "/categories/biometric-devices", label: "Biometrics" },
  { href: "/categories/poe-switches", label: "Networking" },
  { href: "/brands", label: "Brands" },
] as const;

const shopGroups = [
  {
    title: "CCTV cameras",
    links: [
      ["Dome cameras", "/categories/dome-cameras"],
      ["Bullet cameras", "/categories/bullet-cameras"],
      ["Full-color dome", "/categories/color-dome-cameras"],
      ["Full-color bullet", "/categories/color-bullet-cameras"],
      ["2MP cameras", "/products?q=2MP+camera"],
      ["4MP cameras", "/products?q=4MP+camera"],
    ],
  },
  {
    title: "Recording & access",
    links: [
      ["NVR systems", "/categories/nvr-systems"],
      ["Biometric attendance", "/categories/biometric-devices"],
      ["Face recognition", "/products?q=face+recognition"],
      ["Fingerprint devices", "/products?q=fingerprint"],
    ],
  },
  {
    title: "Networking & quick links",
    links: [
      ["PoE switches", "/categories/poe-switches"],
      ["Shop all products", "/products"],
      ["Compare models", "/compare"],
      ["Build a CCTV kit", "/system-builder"],
      ["Downloads", "/downloads"],
    ],
  },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const reduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="border-b border-[var(--line)] bg-[var(--canvas-alt)] py-2 text-center text-[11px] font-semibold tracking-[0.04em] text-[var(--muted)] sm:text-xs">
        GST-inclusive prices · Exact-model documents · Secure checkout · {siteConfig.serviceArea}{" "}
        support
      </div>
      <header className="sticky top-3 z-50 px-3 sm:top-4 sm:px-4">
        <div className="container-standard">
          <div
            data-header-capsule
            className={`header-capsule flex items-center justify-between gap-3 text-white ${compact ? "header-capsule--compact" : ""}`}
          >
          <Brand responsive inverted />

          <nav className="hidden items-center gap-4 xl:flex" aria-label="Primary navigation">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShopOpen((value) => !value)}
                onKeyDown={(event) => event.key === "Escape" && setShopOpen(false)}
                className="flex min-h-11 items-center gap-1 text-sm font-bold text-white"
                aria-expanded={shopOpen}
                aria-haspopup="true"
              >
                Shop <ChevronDown size={14} className={shopOpen ? "rotate-180" : ""} />
              </button>
              <AnimatePresence>
                {shopOpen && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.995 }}
                    transition={{ duration: durations.fast, ease: easings.enter }}
                    className="absolute left-0 top-full mt-3 w-[760px] rounded-[24px] border border-[var(--tangerine-border)] bg-[var(--canvas)] p-7 shadow-2xl"
                  >
                    <div className="grid grid-cols-3 gap-8">
                      {shopGroups.map((group) => (
                        <div key={group.title}>
                          <p className="eyebrow text-[var(--tangerine-text)]">{group.title}</p>
                          <div className="mt-4 grid gap-1">
                            {group.links.map(([label, href]) => (
                              <Link
                                key={href}
                                href={href}
                                onClick={() => setShopOpen(false)}
                                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--tangerine-soft)] hover:text-[var(--ink)]"
                              >
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-xs font-semibold text-white/70 transition-colors hover:text-white 2xl:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ProductSearch />

          <div className="flex items-center gap-0.5">
            <ProductSearch mode="mobile" />
            <Link
              href="/compare"
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 sm:flex"
              aria-label="Compare products"
            >
              <Scale size={19} />
            </Link>
            <Link
              href="/account"
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 sm:flex"
              aria-label="Account"
            >
              <UserRound size={19} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/85 hover:bg-white/10"
              aria-label={`Open cart with ${count} items`}
            >
              <ShoppingBag size={20} />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={reduceMotion ? false : { scale: 0.65 }}
                  animate={{ scale: 1 }}
                  transition={springs.interface}
                  className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--tangerine)] px-1 text-[10px] font-extrabold text-[var(--ink)]"
                >
                  {count}
                </motion.span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 xl:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
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
                  <ProductSearch mode="hero" />
                  <nav className="mt-8 grid gap-1" aria-label="Mobile navigation">
                    {[
                      { href: "/products", label: "Shop all products" },
                      ...primaryNav,
                      { href: "/system-builder", label: "Build a CCTV kit" },
                      { href: "/compare", label: "Compare models" },
                      { href: "/account", label: "Account" },
                      { href: "/support", label: "Customer help" },
                    ].map((item) => (
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
