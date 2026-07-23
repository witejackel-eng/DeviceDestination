"use client";

import { useEffect, useState } from "react";
import { catalogue } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";

const storageKey = "devicedestination-recent-v1";

function readStoredIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const ids = readStoredIds().filter((id) => id !== productId);
      window.localStorage.setItem(storageKey, JSON.stringify([productId, ...ids].slice(0, 8)));
    } catch {
      // Browsing and purchasing remain available when storage is disabled.
    }
  }, [productId]);
  return null;
}

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIds(readStoredIds()));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const products = ids
    .filter((id) => id !== excludeId)
    .flatMap((id) => {
      const product = catalogue.find((item) => item.id === id);
      return product ? [product] : [];
    })
    .slice(0, 8);

  if (!products.length) return null;
  return (
    <section className="section-space !pt-10" aria-labelledby="recently-viewed-title">
      <div className="container-standard">
        <p className="eyebrow">Continue shopping</p>
        <h2 id="recently-viewed-title" className="section-title mt-4">
          Recently viewed.
        </h2>
        <div className="mt-8 grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
