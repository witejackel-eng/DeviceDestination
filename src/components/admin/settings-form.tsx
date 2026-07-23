"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingAction } from "@/app/admin/actions/settings";

type Setting = {
  key: string;
  value: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
};

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function handleSave(key: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusyKey(key);
    const formData = new FormData(event.currentTarget);
    const result = await updateSettingAction({
      key,
      value: String(formData.get("value") ?? ""),
    });
    setBusyKey(null);
    if (!result.ok) setError(`${key}: ${result.reason}`);
    else router.refresh();
  }

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold">Operational settings</h2>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-4">
        {settings.map((setting) => (
          <form
            key={setting.key}
            onSubmit={(event) => handleSave(setting.key, event)}
            className="grid gap-2 rounded-md border border-[var(--border)] p-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <div>
              <code className="text-xs">{setting.key}</code>
              {setting.updatedAt && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Updated {new Date(setting.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <input
              name="value"
              defaultValue={setting.value}
              className={inputClass}
            />
            <button type="submit" className="button-primary" disabled={busyKey === setting.key}>
              {busyKey === setting.key ? "Saving…" : "Save"}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
