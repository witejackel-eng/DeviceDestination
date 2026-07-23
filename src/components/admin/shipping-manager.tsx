"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createShippingRuleAction,
  createShippingZoneAction,
  deleteShippingRuleAction,
  updateShippingZoneAction,
} from "@/app/admin/actions/settings";

type Zone = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  deliveryFeePaise: number;
  freeShippingThresholdPaise: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  codAvailable: boolean;
  remoteAreaSurchargePaise: number;
  notes: string | null;
};
type Rule = {
  rule: {
    id: string;
    zoneId: string;
    pincodePrefix: string;
    serviceability: "serviceable" | "manual_confirmation" | "unserviceable";
    overrideFeePaise: number | null;
    overrideEstimatedDaysMin: number | null;
    overrideEstimatedDaysMax: number | null;
    isActive: boolean;
    notes: string | null;
  };
  zoneName: string;
  zoneSlug: string;
};

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function ShippingManager({ zones, rules }: { zones: Zone[]; rules: Rule[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createZone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const result = await createShippingZoneAction({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      deliveryFeePaise: Number(formData.get("deliveryFeePaise") ?? 0),
      freeShippingThresholdPaise: String(formData.get("freeShippingThresholdPaise") ?? "")
        ? Number(formData.get("freeShippingThresholdPaise"))
        : null,
      estimatedDaysMin: String(formData.get("estimatedDaysMin") ?? "")
        ? Number(formData.get("estimatedDaysMin"))
        : null,
      estimatedDaysMax: String(formData.get("estimatedDaysMax") ?? "")
        ? Number(formData.get("estimatedDaysMax"))
        : null,
      codAvailable: formData.get("codAvailable") === "on",
      remoteAreaSurchargePaise: Number(formData.get("remoteAreaSurchargePaise") ?? 0),
      isActive: formData.get("isActive") !== "off",
    });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else {
      (event.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const result = await createShippingRuleAction({
      zoneId: String(formData.get("zoneId") ?? ""),
      pincodePrefix: String(formData.get("pincodePrefix") ?? ""),
      serviceability: String(formData.get("serviceability")) as
        | "serviceable"
        | "manual_confirmation"
        | "unserviceable",
      isActive: formData.get("isActive") !== "off",
    });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else {
      (event.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  async function toggleZoneActive(zone: Zone) {
    setError("");
    setBusy(true);
    const result = await updateShippingZoneAction({ zoneId: zone.id, isActive: !zone.isActive });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  async function removeRule(ruleId: string) {
    setError("");
    setBusy(true);
    const result = await deleteShippingRuleAction({ ruleId });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="font-display text-2xl font-semibold">Zones ({zones.length})</h2>
        {zones.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No shipping zones. Create one below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {zones.map((zone) => (
              <li key={zone.id} className="rounded-md border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{zone.name}</strong>{" "}
                    <code className="text-xs">/{zone.slug}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleZoneActive(zone)}
                    className="text-xs underline"
                    disabled={busy}
                  >
                    {zone.isActive ? "active" : "inactive"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Fee: ₹{(zone.deliveryFeePaise / 100).toFixed(2)} ·
                  {zone.freeShippingThresholdPaise
                    ? ` free above ₹${(zone.freeShippingThresholdPaise / 100).toFixed(2)} ·`
                    : ""}{" "}
                  ETA: {zone.estimatedDaysMin ?? "?"}-{zone.estimatedDaysMax ?? "?"} days ·
                  COD: {zone.codAvailable ? "yes" : "no"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={createZone} className="mt-4 grid gap-2 rounded-md border border-[var(--border)] p-3">
          <h3 className="font-display text-lg font-semibold">New zone</h3>
          <input name="name" placeholder="Zone name" required className={inputClass} />
          <input name="slug" placeholder="Slug (lowercase, hyphens)" required pattern="[a-z0-9-]+" className={inputClass} />
          <input name="deliveryFeePaise" type="number" min="0" placeholder="Delivery fee (paise)" defaultValue={0} className={inputClass} />
          <input name="freeShippingThresholdPaise" type="number" min="0" placeholder="Free shipping threshold (paise, optional)" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input name="estimatedDaysMin" type="number" min="0" placeholder="Min days" className={inputClass} />
            <input name="estimatedDaysMax" type="number" min="0" placeholder="Max days" className={inputClass} />
          </div>
          <input name="remoteAreaSurchargePaise" type="number" min="0" placeholder="Remote surcharge (paise)" defaultValue={0} className={inputClass} />
          <label className="text-sm">
            <input type="checkbox" name="codAvailable" /> COD available (rare)
          </label>
          <label className="text-sm">
            <input type="checkbox" name="isActive" defaultChecked /> Active
          </label>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Saving…" : "Create zone"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold">Pincode rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No pincode rules.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {rules.map(({ rule, zoneName }) => (
              <li
                key={rule.id}
                className="flex items-center justify-between rounded-md border border-[var(--border)] p-2 text-xs"
              >
                <span>
                  <code>{rule.pincodePrefix}</code> · {zoneName} · {rule.serviceability}
                </span>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="text-red-700 underline"
                  disabled={busy}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={createRule} className="mt-4 grid gap-2 rounded-md border border-[var(--border)] p-3">
          <h3 className="font-display text-lg font-semibold">New rule</h3>
          <select name="zoneId" required className={inputClass}>
            <option value="">Select zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <input name="pincodePrefix" placeholder="Pincode prefix (1-6 digits)" required pattern="\d+" maxLength={6} className={inputClass} />
          <select name="serviceability" defaultValue="manual_confirmation" className={inputClass}>
            <option value="manual_confirmation">Manual confirmation</option>
            <option value="serviceable">Serviceable</option>
            <option value="unserviceable">Unserviceable</option>
          </select>
          <label className="text-sm">
            <input type="checkbox" name="isActive" defaultChecked /> Active
          </label>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Saving…" : "Create rule"}
          </button>
        </form>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 lg:col-span-2">{error}</p>}
    </div>
  );
}
