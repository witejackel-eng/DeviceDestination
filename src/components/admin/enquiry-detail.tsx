"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEnquiryAction, retryEnquiryNotificationAction } from "@/app/admin/actions/enquiries";

type Enquiry = {
  id: string;
  status: string;
  assignedTo: string | null;
  internalNotes: string | null;
  followUpAt: Date | null;
  lastContactedAt: Date | null;
  linkedQuoteId: string | null;
  linkedOrderId: string | null;
};

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function EnquiryDetail({ enquiry }: { enquiry: Enquiry }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const followUpRaw = String(formData.get("followUpAt") ?? "");
    const lastContactedRaw = String(formData.get("lastContactedAt") ?? "");
    const result = await updateEnquiryAction({
      enquiryId: enquiry.id,
      status: String(formData.get("status")) as
        | "new"
        | "contacted"
        | "qualified"
        | "quoted"
        | "won"
        | "lost"
        | "closed",
      assignedTo: String(formData.get("assignedTo") ?? "") || null,
      internalNotes: String(formData.get("internalNotes") ?? "") || null,
      followUpAt: followUpRaw ? new Date(followUpRaw).toISOString() : null,
      lastContactedAt: lastContactedRaw ? new Date(lastContactedRaw).toISOString() : null,
    });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  async function retry() {
    setError("");
    setBusy(true);
    const result = await retryEnquiryNotificationAction({ enquiryId: enquiry.id });
    setBusy(false);
    if (!result.ok) setError(result.reason);
  }

  const toLocalInput = (date: Date | null) =>
    date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold">Follow-up management</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Status</span>
          <select name="status" defaultValue={enquiry.status} className={`mt-1 ${inputClass}`}>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Assigned to (email)</span>
          <input
            name="assignedTo"
            defaultValue={enquiry.assignedTo ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Follow-up at</span>
          <input
            name="followUpAt"
            type="datetime-local"
            defaultValue={toLocalInput(enquiry.followUpAt)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Last contacted at</span>
          <input
            name="lastContactedAt"
            type="datetime-local"
            defaultValue={toLocalInput(enquiry.lastContactedAt)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Internal notes (admin-only)</span>
        <textarea
          name="internalNotes"
          defaultValue={enquiry.internalNotes ?? ""}
          className="mt-1 min-h-24 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
        />
      </label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="button-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={retry} disabled={busy} className="button-secondary">
          Retry notification
        </button>
      </div>
    </form>
  );
}
