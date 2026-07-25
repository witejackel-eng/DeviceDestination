"use client";

import { useActionState, useState } from "react";
import { updateOrderStatusAction, type ActionResult } from "@/app/admin/actions";

const initial: ActionResult = { ok: false, message: "" };

const options = [
  ["processing", "Processing"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["refunded", "Refunded"],
] as const;

/**
 * Fulfilment transitions only. "Paid" is absent by design — money received is
 * decided by the signed payment webhook, never by a person clicking a button.
 * Cancel and refund ask for confirmation because they are not reversible here.
 */
export function AdminOrderStatusForm({
  orderNumber,
  current,
  canManage,
}: {
  orderNumber: string;
  current: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => updateOrderStatusAction(formData),
    initial,
  );
  const [status, setStatus] = useState(current);
  const destructive = status === "cancelled" || status === "refunded";

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          destructive &&
          !window.confirm(`Mark order ${orderNumber} as ${status}? This is recorded in the audit log.`)
        )
          event.preventDefault();
      }}
      className="grid gap-3"
    >
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <label className="grid gap-1.5">
        <span className="text-xs font-bold">Fulfilment status</span>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 text-sm"
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!canManage || pending || status === current}
        className="button-secondary min-h-10 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : "Update status"}
      </button>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-sm ${state.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
