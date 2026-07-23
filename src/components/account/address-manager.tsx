"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Address = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  instructions: string | null;
  isDefault: boolean;
};

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function createOrUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      line1: String(formData.get("line1") ?? ""),
      line2: String(formData.get("line2") ?? "") || undefined,
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      pincode: String(formData.get("pincode") ?? ""),
      instructions: String(formData.get("instructions") ?? "") || undefined,
      isDefault: formData.get("isDefault") === "on",
    };
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/account/addresses/${editingId}` : "/api/account/addresses";
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to save address");
      return;
    }
    setEditingId(null);
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function remove(addressId: string) {
    setError("");
    setBusy(true);
    const response = await fetch(`/api/account/addresses/${addressId}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to delete address");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="surface-card p-6">
        <h2 className="font-display text-2xl font-semibold">Saved addresses ({addresses.length})</h2>
        {addresses.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No saved addresses yet.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {addresses.map((address) => (
              <li key={address.id} className="rounded-md border border-[var(--border)] p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    <p>
                      {address.city}, {address.state} {address.pincode}
                    </p>
                    {address.isDefault && (
                      <span className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-2 py-0.5 text-xs">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(address.id)}
                      className="text-xs underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(address.id)}
                      className="text-xs text-red-700 underline"
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>

      <form onSubmit={createOrUpdate} className="surface-card grid gap-3 p-6">
        <h2 className="font-display text-2xl font-semibold">
          {editingId ? "Edit address" : "Add address"}
        </h2>
        <input name="line1" placeholder="Address line 1" required className={inputClass} />
        <input name="line2" placeholder="Address line 2 (optional)" className={inputClass} />
        <input name="city" placeholder="City" required className={inputClass} />
        <input name="state" placeholder="State" required defaultValue="Delhi" className={inputClass} />
        <input
          name="pincode"
          placeholder="Pincode"
          required
          pattern="\d{6}"
          maxLength={6}
          className={inputClass}
        />
        <input
          name="instructions"
          placeholder="Delivery instructions (optional)"
          className={inputClass}
        />
        <label className="text-sm">
          <input type="checkbox" name="isDefault" /> Set as default
        </label>
        <div className="flex gap-2">
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add address"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="button-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
