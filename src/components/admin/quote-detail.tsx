"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { transitionQuoteStatusAction } from "@/app/admin/actions/quotes";

type History = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  note: string | null;
  createdAt: Date;
};

export function QuoteDetail({
  quoteId,
  currentStatus,
  history,
}: {
  quoteId: string;
  currentStatus: string;
  history: History[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function transition(toStatus: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted") {
    setError("");
    setBusy(true);
    const result = await transitionQuoteStatusAction({ quoteId, toStatus });
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold">Lifecycle</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Current status: <strong>{currentStatus}</strong>. Accepting a quote does NOT mark payment
        received. Conversion creates a separate order.
      </p>
      <div className="flex flex-wrap gap-2">
        {currentStatus === "draft" && (
          <button type="button" className="button-primary" disabled={busy} onClick={() => transition("sent")}>
            Mark sent
          </button>
        )}
        {currentStatus === "sent" && (
          <>
            <button type="button" className="button-primary" disabled={busy} onClick={() => transition("accepted")}>
              Mark accepted
            </button>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => transition("rejected")}>
              Mark rejected
            </button>
          </>
        )}
        {currentStatus === "accepted" && (
          <button type="button" className="button-primary" disabled={busy} onClick={() => transition("converted")}>
            Convert to order
          </button>
        )}
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="border-t border-[var(--border)] pt-4">
        <h3 className="font-display text-lg font-semibold">History</h3>
        <ol className="mt-2 space-y-1 text-sm">
          {history.map((event) => (
            <li key={event.id} className="text-[var(--text-muted)]">
              {new Date(event.createdAt).toLocaleString()} ·{" "}
              <span className="font-mono text-xs">
                {event.fromStatus ?? "—"} → {event.toStatus}
              </span>
              {event.note && ` · ${event.note}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
