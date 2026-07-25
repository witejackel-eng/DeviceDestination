"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MapPin, Package, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/account", label: "Overview", icon: UserRound },
  { href: "/account/orders", label: "My orders", icon: Package },
  { href: "/account/addresses", label: "Saved addresses", icon: MapPin },
  { href: "/account/profile", label: "Account details", icon: UserRound },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav aria-label="Account navigation" className="lg:sticky lg:top-28 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-colors ${
                  active
                    ? "bg-[var(--tangerine-soft)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--canvas-alt)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon size={16} /> {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-[var(--muted)] transition-colors hover:bg-[var(--canvas-alt)] hover:text-[var(--ink)]"
          >
            <LogOut size={16} /> Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
