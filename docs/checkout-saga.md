# Checkout Saga

This document explains the checkout orchestration process, which uses the saga pattern with the `checkout_attempts` table for idempotency tracking, compensation on failure, and durable payment-record-before-provider-call semantics.

## Checkout-attempt phases

The `checkout_attempts` table tracks each checkout attempt through a well-defined status sequence:

```
initialized → local_order_created → inventory_reserved → provider_order_creating → provider_order_created → payment_recorded → ready_for_checkout
                                                                                                                                                    ↓
                                                                                                                                              failed / cancelled
```

Each phase is recorded on the `checkout_attempt` row with `status` and `last_completed_step`. This allows recovery or monitoring to know exactly how far a checkout got before it stopped.

### Phase descriptions

| Phase | What happens | Failure outcome |
|---|---|---|
| `initialized` | Checkout attempt row created with the idempotency key | N/A |
| `local_order_created` | Customer, address, order, order items, and placeholder payment record are created in the database | If any insert fails, the attempt is marked `failed` |
| `inventory_reserved` | Inventory is reserved for the order items | If stock is insufficient, order is cancelled, payment is failed, and the attempt is marked `failed` |
| `provider_order_creating` | The checkout attempt status is updated before calling Razorpay | N/A |
| `provider_order_created` | Razorpay order is created (but not yet durably linked to payment) | If Razorpay throws, inventory is released, order is cancelled, payment is failed, attempt is `failed` |
| `payment_recorded` | The placeholder payment row is updated with the real Razorpay order ID | If the update fails after bounded retries, inventory is released, order is cancelled, attempt is `failed` |
| `ready_for_checkout` | Checkout is complete — the Razorpay order ID and key are returned to the client | N/A |

## Idempotency key behavior

The `idempotencyKey` on `checkout_attempts` has a unique index. When `orchestrateCheckout` receives a request, it first checks whether an attempt with that key already exists:

- **`ready_for_checkout`** — the checkout already completed successfully. Return `duplicate_completed` with the existing order details, Razorpay order ID, and amount. No new work is done.
- **`initialized` / `local_order_created` / `inventory_reserved` / `provider_order_creating` / `provider_order_created` / `payment_recorded`** — the checkout is currently in progress. Return `processing` with a message asking the client to retry. This prevents duplicate order creation from concurrent requests.
- **`failed`** — the previous attempt failed. Return `failed` with `retryable: true`, allowing the client to retry with a new idempotency key.
- **`cancelled`** — the previous attempt was cancelled. Return `failed` with `retryable: true`.

### Concurrent identical requests

When two concurrent requests use the same idempotency key, the unique index on `checkout_attempts.idempotency_key` ensures only one attempt row is created. The first request to successfully insert proceeds through the saga. The second request finds the existing attempt and returns an appropriate response based on its current phase.

## Compensation on failure

The checkout saga follows the **compensating transaction** pattern. If any step fails, all previously completed steps are undone:

### Inventory reservation failure

If `reserveInventoryForOrder` throws (insufficient stock):
1. The order is set to `cancelled`.
2. The placeholder payment is set to `failed`.
3. The checkout attempt is marked `failed`.

### Razorpay order creation failure

If `getRazorpay().orders.create()` throws:
1. `releaseReservationsForOrder(orderId, "razorpay_create_failed")` releases all reserved inventory.
2. The order is set to `cancelled`.
3. The placeholder payment is set to `failed`.
4. The checkout attempt is marked `failed`.

### Payment-row update failure

After Razorpay creates the order, the placeholder payment row must be updated with the real `providerOrderId`. This update is retried up to 3 times (bounded retries). If all retries fail:
1. `releaseReservationsForOrder(orderId, "payment_row_update_failed")` releases all reserved inventory.
2. The order is set to `cancelled`.
3. The checkout attempt is marked `failed`.

This ensures no "orphaned" Razorpay order exists without a corresponding tracked payment — a critical safety guarantee.

## Payment record before provider call

### Placeholder payment pattern

Before calling Razorpay, the orchestrator creates a **placeholder payment record** with `providerOrderId = "placeholder_<attemptId>"` and `status = "created"`. This guarantees:

1. If Razorpay succeeds but the payment-row update fails, the placeholder can be updated with the real ID on retry.
2. If Razorpay succeeds and the payment-row update also succeeds, the placeholder is replaced with the real `providerOrderId`.
3. If the checkout fails before calling Razorpay, the placeholder payment is marked `failed` — no orphan record.

### Bounded retries for persistence

The payment-row update (replacing the placeholder `providerOrderId` with the real Razorpay order ID) is retried up to 3 times. This is bounded because:
- The operation is a simple UPDATE, unlikely to fail repeatedly.
- If it fails 3 times, the checkout is aborted with compensation (inventory released, order cancelled).
- An unbounded retry loop would risk leaving an untracked Razorpay order.

## Cleanup of failed checkout attempts

Failed checkout attempts remain in the database for monitoring and audit purposes. The `checkout_attempts` row records:
- `status = "failed"` (or `"cancelled"`).
- `last_error` — the error message (up to 500 characters).
- `last_completed_step` — how far the checkout got before failing.

These records are never automatically deleted. The admin can review them at `/admin/audit?tab=checkout` (future enhancement) or directly in the database.

The associated order, customer, address, and payment records from a failed checkout are left in their terminal states (`cancelled` for orders, `failed` for payments). They serve as audit trails and do not interfere with subsequent checkouts because:
- Each new checkout uses a unique `idempotencyKey`.
- Cancelled orders do not affect inventory (reservations are released).
- Failed payments do not affect the payment provider (no real Razorpay order was tracked, or the Razorpay order was never authorized).

### Stale checkout attempts

If a checkout attempt is stuck in an intermediate phase (`initialized`, `local_order_created`, etc.) for an extended period, the `repairIncompletePostPaymentProcessing` reconciliation function does not attempt to resume it — checkout attempts are one-shot operations. The client should retry with a new idempotency key. The stale attempt will remain in its intermediate state for audit purposes.
