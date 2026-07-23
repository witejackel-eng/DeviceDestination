"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function ProfilePanel({
  user,
}: {
  user: { id: string; name: string; email: string; mobile: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        mobile: String(formData.get("mobile") ?? "") || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to save");
      return;
    }
    setSuccess("Profile updated.");
    router.refresh();
  }

  async function handleAction(action: "export" | "deletion") {
    setError("");
    setSuccess("");
    if (
      action === "deletion" &&
      !confirm(
        "Account deletion is irreversible. Our team will contact you to confirm. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to submit request");
      return;
    }
    setSuccess(data.message ?? "Request submitted.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleProfile} className="surface-card grid gap-3 p-6">
        <h2 className="font-display text-2xl font-semibold">Profile</h2>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Name</span>
          <input name="name" defaultValue={user.name} required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Email (read-only)</span>
          <input
            value={user.email}
            readOnly
            disabled
            className={`mt-1 ${inputClass} opacity-70`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Mobile</span>
          <input
            name="mobile"
            defaultValue={user.mobile ?? ""}
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        <p className="text-xs text-[var(--text-muted)]">
          Password changes are handled by Better Auth via the forgot-password flow.
        </p>
      </form>

      <div className="surface-card grid gap-3 p-6">
        <h2 className="font-display text-2xl font-semibold">Data & account</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Submit a data export or account deletion request. Our team will contact you within 72
          hours to verify and complete the request.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => handleAction("export")}
          >
            Request data export
          </button>
          <button
            type="button"
            className="button-secondary text-red-700"
            disabled={busy}
            onClick={() => handleAction("deletion")}
          >
            Request account deletion
          </button>
        </div>
      </div>
    </div>
  );
}
