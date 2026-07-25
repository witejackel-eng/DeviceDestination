"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  FileText,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { Capability } from "@/lib/authz";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: keyof typeof icons;
  capability: Capability;
};

const icons = {
  overview: LayoutDashboard,
  products: Package,
  inventory: Boxes,
  orders: ShoppingCart,
  customers: Users,
  enquiries: MessageSquare,
  pricing: IndianRupee,
  settings: Settings,
  documents: FileText,
};

export const adminNavGroups: Array<{ title: string; items: AdminNavItem[] }> = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "overview", capability: "admin.view" }],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: "products", capability: "catalogue.manage" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory", capability: "inventory.manage" },
      { href: "/admin/pricing", label: "Pricing", icon: "pricing", capability: "catalogue.manage" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders", capability: "orders.view" },
      { href: "/admin/customers", label: "Customers", icon: "customers", capability: "customers.view" },
      { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", capability: "orders.view" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings", label: "Store & staff", icon: "settings", capability: "settings.manage" },
    ],
  },
];

export function AdminNav({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const groups = adminNavGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed.includes(item.href)) }))
    .filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Admin navigation" className="grid gap-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {group.title}
          </p>
          <ul className="mt-2 grid gap-0.5">
            {group.items.map((item) => {
              const Icon = icons[item.icon];
              const active =
                item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-[var(--tangerine-soft)] text-[var(--ink)]"
                        : "text-[var(--muted)] hover:bg-[var(--canvas-alt)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <Icon size={16} /> {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
