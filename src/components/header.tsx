"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

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
        GST invoice · OEM warranty where applicable · Delhi NCR support · Call +91 83685 61919
      </div>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(255,253,248,0.94)] backdrop-blur-xl">
        <div className="container-standard flex h-[72px] items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-[-0.055em]"
            aria-label="DeviceDestination home"
          >
            Device<span className="text-[var(--tangerine-dark)]">Destination</span>
          </Link>

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

          <form
            action="/products"
            className="hidden min-w-0 max-w-[340px] flex-1 items-center rounded-xl border border-[var(--line)] bg-white px-3 md:flex"
          >
            <Search size={17} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
            <label htmlFor="header-search" className="sr-only">
              Search by product or model
            </label>
            <input
              id="header-search"
              name="q"
              placeholder="Search model number"
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
          </form>

          <div className="flex items-center gap-1">
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
            <form
              action="/products"
              className="mb-8 flex items-center rounded-xl border border-[var(--line)] bg-white px-3"
            >
              <Search size={18} aria-hidden="true" />
              <label htmlFor="mobile-search" className="sr-only">
                Search by product or model
              </label>
              <input
                id="mobile-search"
                name="q"
                placeholder="Search model number"
                className="h-12 min-w-0 flex-1 bg-transparent px-2 outline-none"
              />
            </form>
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
