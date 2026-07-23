"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { catalogue } from "@/data/catalog";
import { useCompareStore } from "@/lib/compare-store";
import { comparisonGroup, formatPrice, getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";

/** Category-based colour for compare product panels */
function categoryPanelBg(categorySlug: string): string {
  if (categorySlug.includes("dome")) return "var(--powder-blue-soft)";
  if (categorySlug.includes("bullet")) return "var(--butter-soft)";
  if (categorySlug.includes("color")) return categorySlug.includes("bullet")
    ? "var(--peach)"
    : "var(--coral-soft)";
  if (categorySlug.includes("nvr")) return "var(--lilac-soft)";
  if (categorySlug.includes("biometric")) return "var(--mint-soft)";
  if (categorySlug.includes("poe") || categorySlug.includes("switch")) return "var(--technical-grey)";
  return "var(--canvas-warm)";
}

export function ComparisonPage({ initialIds }: { initialIds: string[] }) {
  const ids = useCompareStore((state) => state.ids);
  const replace = useCompareStore((state) => state.replace);
  const remove = useCompareStore((state) => state.remove);
  const toggle = useCompareStore((state) => state.toggle);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (initialIds.length) replace(initialIds.filter((id) => catalogue.some((p) => p.id === id)));
  }, [initialIds, replace]);
  const selected = ids.flatMap((id) => {
    const product = catalogue.find((item) => item.id === id);
    return product ? [product] : [];
  });
  const specLabels = useMemo(
    () =>
      Array.from(new Set(selected.flatMap((product) => Object.keys(product.specs)))).slice(0, 24),
    [selected],
  );
  const selectedGroup = selected[0] ? comparisonGroup(selected[0]) : null;
  const available = catalogue.filter(
    (product) =>
      !ids.includes(product.id) && (!selectedGroup || comparisonGroup(product) === selectedGroup),
  );
  const sharePath = `/compare?ids=${selected.map((product) => product.id).join(",")}`;
  const share = async () => {
    await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="container-standard section-space !pt-14" style={{ background: "var(--surface)" }}>
      <p className="eyebrow">Side-by-side</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5 max-w-2xl">
        <h1 className="display-section">Compare exact models.</h1>
        {selected.length > 0 && (
          <button type="button" onClick={share} className="button-secondary">
            {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
            {copied ? "Link copied" : "Copy share link"}
          </button>
        )}
      </div>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-soft)]">
        Choose up to four models. The comparison is stored on this device and encoded in the
        shareable URL.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] p-4" style={{ background: "var(--canvas-warm)" }}>
        <label htmlFor="compare-add" className="text-sm font-bold">
          Add a model
        </label>
        <select
          id="compare-add"
          value=""
          disabled={selected.length >= 4 || !available.length}
          onChange={(event) => event.target.value && toggle(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 sm:max-w-md"
        >
          <option value="">
            {selected.length >= 4 ? "Four-product limit reached" : "Select product…"}
          </option>
          {available.map((product) => (
            <option key={product.id} value={product.id}>
              {product.model} — {product.title}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--muted)]">{selected.length}/4 selected</span>
      </div>
      {!selected.length ? (
        <div className="surface-card mt-10 grid min-h-[360px] place-content-center p-8 text-center" style={{ background: "var(--surface)" }}>
          <Plus className="mx-auto text-[var(--tangerine-text)]" size={32} />
          <h2 className="mt-5 font-display text-3xl font-semibold">Your comparison is empty.</h2>
          <p className="mt-3 text-[var(--muted)]">
            Add models from the catalogue or use the selector above.
          </p>
          <Link href="/products" className="button-primary mt-6">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[22px] border border-[var(--line)]" style={{ background: "var(--surface)" }}>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[210px] bg-[var(--canvas)] p-4 text-sm font-bold sticky left-0 z-10">Product</th>
                {selected.map((product) => (
                  <th
                    key={product.id}
                    className="relative min-w-[240px] border-l border-[var(--line)] p-5 align-top"
                    style={{ background: categoryPanelBg(product.categorySlug) }}
                  >
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white/80 backdrop-blur-sm"
                      aria-label={`Remove ${product.model}`}
                    >
                      <X size={15} />
                    </button>
                    <div className="relative mb-4 aspect-[1.3] rounded-2xl bg-white/50">
                      <Image
                        src={product.images[0]}
                        alt=""
                        fill
                        sizes="240px"
                        className="object-contain p-3"
                      />
                    </div>
                    <p className="text-xs font-bold text-[var(--tangerine-text)]">
                      {product.model}
                    </p>
                    <Link
                      href={`/products/${product.slug}`}
                      className="mt-1 block font-display text-xl font-semibold hover:underline"
                    >
                      {product.title}
                    </Link>
                    <p className="mt-3 text-xl font-bold">
                      {getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() })
                        .eligible
                        ? formatPrice(product.sellingPriceInclGstPaise)
                        : "Request latest price"}
                    </p>
                    <AddToCart productId={product.id} className="button-primary mt-3 w-full" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--line)]">
                <th className="bg-[var(--canvas)] p-4 text-sm font-bold sticky left-0 z-10">Availability</th>
                {selected.map((product) => (
                  <td key={product.id} className="border-l border-[var(--line)] p-5 text-sm">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${product.stockStatus === "in_stock" ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                      {product.stockStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--line)]">
                <th className="bg-[var(--canvas)] p-4 text-sm font-bold sticky left-0 z-10">Warranty</th>
                {selected.map((product) => (
                  <td key={product.id} className="border-l border-[var(--line)] p-5 text-sm font-semibold">
                    {product.warrantySummary}
                  </td>
                ))}
              </tr>
              {specLabels.map((label) => (
                <tr key={label} className="border-t border-[var(--line)]">
                  <th className="bg-[var(--canvas)] p-4 text-sm font-bold sticky left-0 z-10">{label}</th>
                  {selected.map((product) => {
                    const value = product.specs[label];
                    const hasValue = value !== undefined && value !== "—";
                    return (
                      <td
                        key={product.id}
                        className={`border-l border-[var(--line)] p-5 text-sm leading-6 ${hasValue ? "text-[var(--ink-soft)] font-medium" : "text-[var(--muted)]"}`}
                      >
                        {value ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
