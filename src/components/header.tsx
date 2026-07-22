"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { Brand } from "@/components/brand";
import { ProductSearch } from "@/components/product-search";
import { siteConfig } from "@/config/site";

const nav = [
  { href: "/products", label: "Products" },
  { href: "/system-builder", label: "Solutions" },
  { href: "/brands/cp-plus", label: "Brands" },
  { href: "/support", label: "Support" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <div className="border-b border-[var(--line)] bg-[var(--canvas-alt)] py-2 text-center text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] sm:text-xs">
        Exact-model invoice · OEM warranty where applicable · {siteConfig.serviceArea} support ·
        Call {siteConfig.contact.phoneDisplay}
      </div>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(255,253,248,0.94)] backdrop-blur-xl">
        <div className="container-standard flex h-[72px] items-center justify-between gap-4">
          <Brand responsive />

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ProductSearch />

          <div className="flex items-center gap-1">
            <ProductSearch mobile />
            <Link
              href="/account"
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--canvas-alt)] sm:flex"
              aria-label="Account"
            >
              <UserRound size={20} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--canvas-alt)]"
              aria-label={`Open cart with ${count} items`}
            >
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--tangerine)] px-1 text-[10px] font-extrabold">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-[80] w-[min(90vw,410px)] bg-[var(--canvas)] p-6 shadow-2xl">
            <div className="mb-12 flex items-center justify-between">
              <Dialog.Title className="font-display text-xl font-bold">Menu</Dialog.Title>
              <Dialog.Close
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)]"
                aria-label="Close menu"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            <div className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--tangerine-soft)] p-4 text-sm text-[var(--muted)]">
              Use the search button in the header to find an exact model. Dashes and spaces are
              optional.
            </div>
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {nav.concat([{ href: "/account", label: "Account" }]).map((item) => (
                <Dialog.Close asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="border-b border-[var(--line)] py-5 font-display text-3xl font-semibold"
                  >
                    {item.label}
                  </Link>
                </Dialog.Close>
              ))}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
