import type { orderStatus } from "@/db/schema";

export type OrderStatus = (typeof orderStatus.enumValues)[number];

/**
 * The single source of truth for order-state transitions. Mutations must call
 * {@link assertTransition} before persisting any status change.
 *
 * Allowed transitions:
 *   pending → payment_pending
 *   pending → cancelled
 *   payment_pending → paid
 *   payment_pending → cancelled
 *   paid → processing
 *   paid → refund_pending
 *   processing → shipped
 *   processing → refund_pending
 *   shipped → delivered
 *   shipped → refund_pending  (rare; requires operational review)
 *   refund_pending → refunded
 *   refund_pending → paid     (refund failed; restore paid)
 *   refunded → cancelled      (terminal cleanup only)
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "cancelled"],
  paid: ["processing", "refund_pending", "cancelled"],
  processing: ["shipped", "refund_pending"],
  shipped: ["delivered", "refund_pending"],
  delivered: [],
  cancelled: [],
  refund_pending: ["refunded", "paid"],
  refunded: ["cancelled"],
};

export function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Order transition ${from} → ${to} is not allowed.`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!isAllowedTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

/** Whether the order is in any "paid-equivalent" state (not cancelled/refunded). */
export function isPaidLike(status: OrderStatus): boolean {
  return status === "paid" || status === "processing" || status === "shipped" || status === "delivered";
}

/** Whether the order can be cancelled (only unpaid orders). */
export function canCancelUnpaid(status: OrderStatus): boolean {
  return status === "pending" || status === "payment_pending";
}

/** Whether shipment can be recorded (requires paid-equivalent state). */
export function canShip(status: OrderStatus): boolean {
  return status === "processing";
}

/** Whether the order can be marked delivered. */
export function canDeliver(status: OrderStatus): boolean {
  return status === "shipped";
}

/** Whether a refund can be requested. */
export function canRequestRefund(status: OrderStatus): boolean {
  return isPaidLike(status) && status !== "refund_pending";
}

/** Human-readable label for the admin UI. */
export function labelForStatus(status: OrderStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
