"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addInternalNoteAction,
  markDeliveredAction,
  recordShipmentAction,
  requestRefundAction,
  retryNotificationAction,
  transitionOrderStatusAction,
} from "@/app/admin/actions/orders";
import { formatPrice } from "@/lib/products";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  subtotalInclGstPaise: number;
  shippingPaise: number;
  totalInclGstPaise: number;
  includedGstPaise: number;
  emailStatus: string;
  whatsappStatus: string;
  invoiceNumber: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  estimatedDeliveryAt: Date | null;
  fulfilmentNotes: string | null;
  internalNotes: string | null;
  refundTotalPaise: number;
};
type OrderItem = {
  id: string;
  model: string;
  title: string;
  quantity: number;
  unitPriceInclGstPaise: number;
  gstRateBasisPoints: number;
};
type Payment = {
  id: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: string;
  amountPaise: number;
  rawEventId: string | null;
};
type Refund = {
  id: string;
  providerRefundId: string | null;
  amountPaise: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
};
type Reservation = {
  id: string;
  productId: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  consumedAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
};
type Event = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorEmail: string | null;
  note: string | null;
  createdAt: Date;
};

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function OrderDetail({
  order,
  items,
  payments,
  refunds,
  reservations,
  events,
}: {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  refunds: Refund[];
  reservations: Reservation[];
  events: Event[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; reason: string }>) {
    setError("");
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  async function transition(toStatus: string) {
    await run(() => transitionOrderStatusAction({ orderId: order.id, toStatus: toStatus as never }));
  }

  async function retry(channel: "email" | "whatsapp" | "invoice") {
    await run(() => retryNotificationAction({ orderId: order.id, channel }));
  }

  async function markDelivered() {
    await run(() => markDeliveredAction({ orderId: order.id }));
  }

  async function handleShipment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(() =>
      recordShipmentAction({
        orderId: order.id,
        courierName: String(formData.get("courierName") ?? ""),
        trackingNumber: String(formData.get("trackingNumber") ?? ""),
        trackingUrl: String(formData.get("trackingUrl") ?? "") || null,
        note: String(formData.get("note") ?? "") || undefined,
      }),
    );
  }

  async function handleNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(() => addInternalNoteAction({ orderId: order.id, note: String(formData.get("note") ?? "") }));
    (event.target as HTMLFormElement).reset();
  }

  async function handleRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(() =>
      requestRefundAction({
        orderId: order.id,
        amountPaise: Number(formData.get("amountPaise") ?? 0),
        reason: String(formData.get("reason") ?? ""),
      }),
    );
    (event.target as HTMLFormElement).reset();
  }

  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-2xl font-semibold">Items</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="p-2">Model</th>
            <th className="p-2">Title</th>
            <th className="p-2">Qty</th>
            <th className="p-2">Unit price</th>
            <th className="p-2">GST</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="p-2 font-mono text-xs">{item.model}</td>
              <td className="p-2">{item.title}</td>
              <td className="p-2">{item.quantity}</td>
              <td className="p-2">{formatPrice(item.unitPriceInclGstPaise)}</td>
              <td className="p-2 font-mono text-xs">{item.gstRateBasisPoints / 100}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr>
            <td className="p-2" colSpan={3}></td>
            <td className="p-2">Subtotal</td>
            <td className="p-2">{formatPrice(order.subtotalInclGstPaise)}</td>
          </tr>
          <tr>
            <td className="p-2" colSpan={3}></td>
            <td className="p-2">Shipping</td>
            <td className="p-2">{formatPrice(order.shippingPaise)}</td>
          </tr>
          <tr>
            <td className="p-2" colSpan={3}></td>
            <td className="p-2">Included GST</td>
            <td className="p-2">{formatPrice(order.includedGstPaise)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="p-2" colSpan={3}></td>
            <td className="p-2">Total</td>
            <td className="p-2">{formatPrice(order.totalInclGstPaise)}</td>
          </tr>
          {order.refundTotalPaise > 0 && (
            <tr>
              <td className="p-2" colSpan={3}></td>
              <td className="p-2">Refunded</td>
              <td className="p-2 text-red-700">−{formatPrice(order.refundTotalPaise)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-semibold">Payments</h3>
          {payments.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No payment records.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="font-mono text-xs">
                  {payment.provider}:{payment.providerOrderId} — {payment.status} —{" "}
                  {formatPrice(payment.amountPaise)}
                  {payment.providerPaymentId && ` · ${payment.providerPaymentId}`}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Inventory reservations</h3>
          {reservations.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No reservations recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {reservations.map((r) => (
                <li key={r.id} className="font-mono text-xs">
                  {r.status} · qty {r.quantity} · expires {new Date(r.expiresAt).toLocaleString()}
                  {r.releaseReason && ` · reason ${r.releaseReason}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {refunds.length > 0 && (
        <div className="mt-4">
          <h3 className="font-display text-lg font-semibold">Refunds</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-2">Amount</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Status</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td className="p-2">{formatPrice(r.amountPaise)}</td>
                  <td className="p-2">{r.reason}</td>
                  <td className="p-2 font-mono text-xs">{r.status}</td>
                  <td className="p-2 text-[var(--text-muted)]">
                    {new Date(r.requestedAt).toLocaleString()}
                  </td>
                  <td className="p-2 text-[var(--text-muted)]">
                    {r.processedAt ? new Date(r.processedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="mt-6 border-t border-[var(--border)] pt-6">
        <h3 className="font-display text-lg font-semibold">Order actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "paid" && (
            <button type="button" className="button-primary" disabled={busy} onClick={() => transition("processing")}>
              Start processing
            </button>
          )}
          {order.status === "processing" && (
            <button type="button" className="button-primary" disabled={busy} onClick={() => transition("shipped")}>
              Mark shipped (use form below for tracking)
            </button>
          )}
          {order.status === "shipped" && (
            <button type="button" className="button-primary" disabled={busy} onClick={markDelivered}>
              Mark delivered
            </button>
          )}
          {(order.status === "pending" || order.status === "payment_pending") && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => transition("cancelled")}
            >
              Cancel unpaid order
            </button>
          )}
          {["paid", "processing", "shipped"].includes(order.status) && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => transition("refund_pending")}
            >
              Request refund (use form below for amount)
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <form onSubmit={handleShipment} className="border-t border-[var(--border)] pt-4">
          <h3 className="font-display text-lg font-semibold">Record shipment</h3>
          <div className="mt-3 grid gap-2">
            <input name="courierName" placeholder="Courier name" required className={inputClass} />
            <input name="trackingNumber" placeholder="Tracking number" required className={inputClass} />
            <input name="trackingUrl" placeholder="Tracking URL (https://...)" type="url" className={inputClass} />
            <input name="note" placeholder="Note (optional)" className={inputClass} />
            <button type="submit" className="button-primary" disabled={busy}>
              Save shipment
            </button>
          </div>
        </form>

        <form onSubmit={handleRefund} className="border-t border-[var(--border)] pt-4">
          <h3 className="font-display text-lg font-semibold">Request refund</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Refunds are idempotent and never exceed the captured payment. Razorpay call is attempted
            immediately if credentials are configured; otherwise the refund is recorded as pending.
          </p>
          <div className="mt-3 grid gap-2">
            <input
              name="amountPaise"
              type="number"
              min="1"
              placeholder="Amount in paise"
              required
              className={inputClass}
            />
            <input name="reason" placeholder="Reason (min 3 chars)" required className={inputClass} />
            <button type="submit" className="button-primary" disabled={busy}>
              Request refund
            </button>
          </div>
        </form>

        <form onSubmit={handleNote} className="border-t border-[var(--border)] pt-4">
          <h3 className="font-display text-lg font-semibold">Internal note</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Visible to admins only.</p>
          <div className="mt-3 grid gap-2">
            <textarea
              name="note"
              required
              minLength={1}
              maxLength={2000}
              className="min-h-20 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
            />
            <button type="submit" className="button-secondary" disabled={busy}>
              Add note
            </button>
          </div>
        </form>

        <div className="border-t border-[var(--border)] pt-4">
          <h3 className="font-display text-lg font-semibold">Notifications</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt>Email</dt>
              <dd>{order.emailStatus}</dd>
            </div>
            <div className="flex justify-between">
              <dt>WhatsApp</dt>
              <dd>{order.whatsappStatus}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Invoice</dt>
              <dd>{order.invoiceNumber ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="button-secondary" disabled={busy} onClick={() => retry("email")}>
              Retry email
            </button>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => retry("whatsapp")}>
              Retry WhatsApp
            </button>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => retry("invoice")}>
              Regenerate invoice
            </button>
          </div>
        </div>
      </div>

      {order.internalNotes && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <h3 className="font-display text-lg font-semibold">Internal notes</h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--surface-muted)] p-3 text-xs">
            {order.internalNotes}
          </pre>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h3 className="font-display text-lg font-semibold">Status timeline</h3>
        <ol className="mt-2 space-y-1 text-sm">
          {events.map((event) => (
            <li key={event.id} className="text-[var(--text-muted)]">
              {new Date(event.createdAt).toLocaleString()} ·{" "}
              <span className="font-mono text-xs">
                {event.fromStatus ?? "—"} → {event.toStatus}
              </span>{" "}
              by {event.actorEmail ?? "system"}
              {event.note && ` · ${event.note}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
