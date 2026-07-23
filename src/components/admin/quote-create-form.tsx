"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuoteAction } from "@/app/admin/actions/quotes";

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

type Item = {
  model: string;
  title: string;
  quantity: number;
  unitPriceInclGstPaise: number;
  gstRateBasisPoints: number;
};

export function QuoteCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([
    { model: "", title: "", quantity: 1, unitPriceInclGstPaise: 0, gstRateBasisPoints: 1800 },
  ]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((current) => [
      ...current,
      { model: "", title: "", quantity: 1, unitPriceInclGstPaise: 0, gstRateBasisPoints: 1800 },
    ]);
  }
  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const result = await createQuoteAction({
      enquiryId: null,
      customerName: String(formData.get("customerName") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      customerMobile: String(formData.get("customerMobile") ?? ""),
      customerBusinessName: String(formData.get("customerBusinessName") ?? "") || null,
      customerGstin: String(formData.get("customerGstin") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      shippingPaise: Number(formData.get("shippingPaise") ?? 0),
      installationPaise: Number(formData.get("installationPaise") ?? 0),
      items: items.map((item) => ({
        productId: null,
        model: item.model,
        title: item.title,
        quantity: item.quantity,
        unitPriceInclGstPaise: item.unitPriceInclGstPaise,
        gstRateBasisPoints: item.gstRateBasisPoints,
      })),
    });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.push(`/admin/quotes/${result.quoteId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold">Create quote</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Customer name</span>
          <input name="customerName" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Email</span>
          <input name="customerEmail" type="email" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Mobile</span>
          <input name="customerMobile" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Business name (optional)</span>
          <input name="customerBusinessName" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">GSTIN (optional)</span>
          <input name="customerGstin" className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Shipping (paise)</span>
          <input name="shippingPaise" type="number" min="0" defaultValue={0} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Installation (paise)</span>
          <input name="installationPaise" type="number" min="0" defaultValue={0} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Notes (optional)</span>
        <textarea name="notes" className="mt-1 min-h-20 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3" />
      </label>

      <div className="border-t border-[var(--border)] pt-4">
        <h3 className="font-display text-lg font-semibold">Items</h3>
        {items.map((item, index) => (
          <div key={index} className="mt-3 grid gap-2 rounded-md border border-[var(--border)] p-3 sm:grid-cols-6">
            <input
              placeholder="Model"
              required
              value={item.model}
              onChange={(e) => updateItem(index, { model: e.target.value })}
              className={inputClass}
            />
            <input
              placeholder="Title"
              required
              value={item.title}
              onChange={(e) => updateItem(index, { title: e.target.value })}
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
              className={inputClass}
            />
            <input
              type="number"
              min="0"
              placeholder="Unit price (paise)"
              value={item.unitPriceInclGstPaise}
              onChange={(e) => updateItem(index, { unitPriceInclGstPaise: Number(e.target.value) })}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="button-secondary"
              disabled={items.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="button-secondary mt-3">
          Add item
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="button-primary">
        {busy ? "Creating…" : "Create draft quote"}
      </button>
    </form>
  );
}
