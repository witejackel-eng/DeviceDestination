"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, MapPin, Package, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const menuItem =
  "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[var(--ink-soft)] outline-none data-[highlighted]:bg-[var(--tangerine-soft)] data-[highlighted]:text-[var(--ink)]";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

/**
 * Header account control. Logged out it is a plain link to sign-in that carries
 * the current route as the return destination; logged in it becomes an avatar
 * menu. Rendered as a link (not a menu) when authentication is unconfigured so
 * preview environments never show a broken control.
 */
export function AccountMenu({ authConfigured }: { authConfigured: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();

  if (!authConfigured || !session.data)
    return (
      <Link
        href={authConfigured ? `/login?next=${encodeURIComponent(pathname)}` : "/account"}
        className="header-control hidden sm:inline-flex"
        aria-label="Sign in to your account"
      >
        <UserRound size={19} />
      </Link>
    );

  const user = session.data.user;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="header-control hidden sm:inline-flex"
        aria-label={`Account menu for ${user.name || user.email}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--tangerine)] text-[11px] font-extrabold text-[var(--ink)]">
          {initials(user.name ?? "", user.email)}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-[90] w-60 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-[var(--line)]" />
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href="/account">
              <UserRound size={16} /> Account overview
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href="/account/orders">
              <Package size={16} /> My orders
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href="/account/addresses">
              <MapPin size={16} /> Saved addresses
            </Link>
          </DropdownMenu.Item>
          <div className="my-1 h-px bg-[var(--line)]" />
          <DropdownMenu.Item
            className={menuItem}
            onSelect={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut size={16} /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
