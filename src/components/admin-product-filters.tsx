"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const statuses = [
  ["all", "All statuses"],
  ["published", "Published"],
  ["draft", "Draft"],
  ["archived", "Archived"],
] as const;

/**
 * Search and status filter for the product table. State lives in the URL so a
 * filtered view can be shared or reloaded, and the server does the filtering.
 */
export function AdminProductFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const push = (next: URLSearchParams) => {
    next.delete("page");
    const suffix = next.toString();
    router.push(suffix ? `/admin/products?${suffix}` : "/admin/products");
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        const next = new URLSearchParams(params.toString());
        if (value) next.set("q", value);
        else next.delete("q");
        push(next);
      }}
    >
      <label className="relative flex-1 sm:max-w-sm">
        <span className="sr-only">Search products</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search title, model, brand or slug"
          className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-white pl-9 pr-3 text-sm"
        />
      </label>
      <label>
        <span className="sr-only">Filter by publication status</span>
        <select
          defaultValue={params.get("status") ?? "all"}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            if (event.target.value === "all") next.delete("status");
            else next.set("status", event.target.value);
            push(next);
          }}
          className="h-10 rounded-[10px] border border-[var(--line)] bg-white px-3 text-sm"
        >
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button-secondary min-h-10 !py-2 text-sm">
        Search
      </button>
    </form>
  );
}
