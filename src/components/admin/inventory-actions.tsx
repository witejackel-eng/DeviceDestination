"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordInventoryAdjustmentAction } from "@/app/admin/actions/inventory";

type Product = { productId: string; model: string };

export function InventoryActions({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const delta = Number(formData.get("delta") ?? 0);
    const result = await recordInventoryAdjustmentAction({
      productId: String(formData.get("productId") ?? ""),
      type: String(formData.get("type")) as
        | "receipt"
        | "correction"
        | "damage"
        | "return"
        | "reservation_correction"
        | "release",
      delta,
      reason: String(formData.get("reason") ?? ""),
      internalNote: String(formData.get("internalNote") ?? "") || undefined,
    });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  const inputClass =
    "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

  return (
    <div className="surface-card mt-4 p-6">
      <h2 className="font-display text-2xl font-semibold">New inventory adjustment</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Use positive deltas for receipts/returns; negative deltas for corrections/damage. The system
        prevents negative resulting stock and always records an immutable history entry.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Product</span>
          <select name="productId" required className={`mt-1 ${inputClass}`}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.model}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Type</span>
          <select name="type" required className={`mt-1 ${inputClass}`}>
            <option value="receipt">Receipt (stock in)</option>
            <option value="correction">Manual correction</option>
            <option value="damage">Damage / write-off</option>
            <option value="return">Customer return</option>
            <option value="reservation_correction">Reservation correction</option>
            <option value="release">Release</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Delta (non-zero integer)</span>
          <input name="delta" type="number" step="1" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Reason</span>
          <input name="reason" required minLength={3} maxLength={300} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block text-[var(--text-muted)]">Internal note (optional)</span>
          <input name="internalNote" maxLength={1000} className={`mt-1 ${inputClass}`} />
        </label>
        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{error}</p>
        )}
        <button type="submit" disabled={busy} className="button-primary sm:col-span-2">
          {busy ? "Recording…" : "Record adjustment"}
        </button>
      </form>
    </div>
  );
}
