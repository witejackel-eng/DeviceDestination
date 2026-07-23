# Inventory Operations

This document explains how inventory is modelled, reserved, adjusted, and reconciled in production. It covers the updated reservation status flow with atomic status claims, the pending→active creation pattern, compensation on failure, concurrent reservation protection, opportunistic cleanup, and reconciliation of stale reservations.

## Schema

Three tables govern inventory:

- `inventory` — one row per product. Columns: `quantity_available` (physical stock on hand), `reserved` (held for pending orders), `lead_time`.
- `inventory_reservations` — one row per order line. Columns: `order_id`, `product_id`, `quantity`, `status`, `expires_at`, `consumed_at`, `released_at`, `release_reason`.
- `inventory_adjustments` — immutable history. Every manual adjustment produces one row with `delta`, `reason`, `actor_user_id`, `actor_email`, `quantity_before`, `quantity_after`, `reserved_before`, `reserved_after`.

The `inventory.reserved` column is never negative — application logic uses `GREATEST(reserved - quantity, 0)` on release.

## Reservation lifecycle

A reservation moves through these statuses:

```
pending → active → consuming → consumed
                → releasing → released
                → expired (by cron sweep)
                → cancelled (admin override)
                → failed (compensation or stale reconciliation)
```

### Status descriptions

| Status | Meaning | Inventory effect |
|---|---|---|
| `pending` | Row inserted, counter not yet incremented. Should be activated within seconds. | None (reserved counter is NOT incremented yet) |
| `active` | Reservation is holding stock. Counter is incremented. | `reserved += quantity` |
| `consuming` | Worker has atomically claimed the reservation for consumption. Only the claiming worker may decrement inventory. | In progress: will decrement both `reserved` and `quantity_available` |
| `consumed` | Payment was captured. Stock is permanently allocated. | `reserved -= quantity`, `quantity_available -= quantity` |
| `releasing` | Worker has atomically claimed the reservation for release. Only the claiming worker may decrement `reserved`. | In progress: will decrement `reserved` only |
| `released` | Order was cancelled, payment failed, or admin released. Stock is returned to sellable pool. | `reserved -= quantity` |
| `expired` | Cron sweep found an active reservation past its `expires_at`. Same effect as released. | `reserved -= quantity` |
| `cancelled` | Administrative override (rare). | Depends on prior state |
| `failed` | Compensation after a mid-creation failure, or stale pending reconciliation. | Counter was compensated back |

### Atomic status claims

Consumption and release use **atomic status claims** — a conditional UPDATE that transitions the reservation from `active` to a transitional state, and only the worker receiving the `RETURNING` row may alter inventory:

```sql
-- Consume: active → consuming
UPDATE inventory_reservations
SET status = 'consuming', updated_at = now()
WHERE order_id = $1 AND status = 'active'
RETURNING id, product_id, quantity;
```

```sql
-- Release: active → releasing
UPDATE inventory_reservations
SET status = 'releasing', updated_at = now()
WHERE order_id = $1 AND status = 'active'
RETURNING id, product_id, quantity;
```

This ensures that **consume and release cannot both succeed** on the same reservation. If a consume claim succeeds, the reservation is in `consuming` and the release claim's `WHERE status = 'active'` will match 0 rows. If a release claim succeeds first, the consume claim will find 0 rows. Only the claiming worker proceeds to alter inventory counters.

## Reservation creation: insert row first, then increment, then activate

The `reserveInventoryForOrder` function follows a strict three-phase creation pattern for each reservation line, with compensation on failure:

### Phase 1: Insert reservation row with `status = 'pending'`

The row is inserted BEFORE incrementing the `reserved` counter. This ensures:
- If the INSERT fails, no counter was touched — no compensation needed.
- The row exists as a reference even if subsequent steps fail.

### Phase 2: Atomically increment `inventory.reserved`

```sql
UPDATE inventory
SET reserved = reserved + $1, updated_at = now()
WHERE product_id = $2
  AND COALESCE(quantity_available, 0) - reserved >= $1
RETURNING id, quantity_available, reserved;
```

If 0 rows are returned, stock is insufficient. The reservation row is marked `failed` and all previously-activated reservations for the same order are compensated (see below).

### Phase 3: Activate the reservation (`pending → active`)

```sql
UPDATE inventory_reservations
SET status = 'active', updated_at = now()
WHERE id = $1 AND status = 'pending'
RETURNING id;
```

If 0 rows are returned (activation failed after a successful increment), the `reserved` counter is compensated back:

```sql
UPDATE inventory
SET reserved = GREATEST(reserved - $1, 0), updated_at = now()
WHERE product_id = $2;
```

And the reservation is marked `failed`.

## Compensation on failure

Failed reservations **do not leak reserved quantity**. Every failure path compensates the `reserved` counter:

### Insufficient stock (phase 2 fails)

The current reservation is marked `failed`. All previously-activated reservations for the same order are compensated via `compensateActivatedReservation`:

1. Find the reservation row (must be `active`).
2. Atomically decrement `reserved` by the reservation's quantity.
3. Mark the reservation as `failed`.

### Activation failure (phase 3 fails)

1. Decrement `reserved` back by the reservation's quantity.
2. Mark the reservation as `failed`.
3. Compensate all previously-activated reservations for the same order.

### Stale pending reservations

Reservations that remain in `pending` for more than 2 minutes are considered stale (the activation should have completed within seconds). The `expirePendingReservations` sweep marks them as `failed`. Since `pending` reservations never incremented the `reserved` counter, no counter compensation is needed — this is why the "insert first, increment second" pattern is critical.

## Concurrent reservation protection

### Consume and release cannot both succeed

Because both operations claim reservations with `WHERE status = 'active'`, only one can claim a given reservation. The `RETURNING` set is empty for the losing operation, which returns 0 affected rows and does nothing. The winning operation proceeds to alter the inventory counters and transition the reservation to its final state (`consumed` or `released`).

### Double consume is idempotent

Calling `consumeReservationsForOrder` on an order whose reservations are already `consumed` returns 0 — the `WHERE status = 'active'` clause finds no rows. No inventory is double-decremented.

### Double release is idempotent

Calling `releaseReservationsForOrder` on an order whose reservations are already `released`/`expired` returns 0. No inventory is double-decremented.

### Concurrent checkout races

Two checkout requests for the same stock cannot oversell because the `inventory.reserved` increment uses `WHERE COALESCE(quantity_available, 0) - reserved >= quantity`. If one request's increment succeeds, the available pool shrinks and the other request's increment fails. The atomic conditional UPDATE ensures exactly one winner.

## Opportunistic cleanup

Expired reservations are cleaned up at three points:

### Before checkout

`cleanupExpiredReservationsBeforeCheckout(items)` is called during checkout orchestration before creating new reservations. It only cleans up expired active reservations for the specific products in the order — bounded and indexed:

```sql
UPDATE inventory_reservations
SET status = 'releasing', updated_at = now()
WHERE status = 'active'
  AND expires_at <= now()
  AND product_id IN (product_ids)
RETURNING ...;
```

Each claimed reservation is then released (decrement `reserved`, mark `expired` with `release_reason = 'expired_opportunistic'`).

### Before sellable quantity reads

`getSellableQuantity(productId)` returns `max(0, quantity_available - reserved)`. If stale reservations inflate `reserved`, the sellable quantity appears lower than it should. The cron sweep (below) eventually corrects this, but the opportunistic checkout cleanup provides immediate correction for the products being purchased.

### In batches (cron sweep)

`expirePendingReservations()` is called by each cron run. It handles three categories:

1. **Expired active reservations** (`active` with `expires_at <= now()`) — claimed as `releasing`, then decremented and marked `expired`.
2. **Stale pending reservations** (`pending` older than 2 minutes) — marked `failed`. No counter compensation needed because pending reservations never incremented `reserved`.
3. **Stale transitional reservations** (`consuming`/`releasing` older than 5 minutes) — reconciled:
   - `consuming` → treated as `consumed`: decrement both `reserved` and `quantity_available`, mark as `consumed`.
   - `releasing` → treated as `released`: decrement `reserved` only, mark as `released` with `release_reason = 'reconciliation_stale_releasing'`.

This ensures that even if a worker crashes mid-transition, the inventory counters are eventually corrected.

## Reconciliation of stale pending/consuming/releasing reservations

The `expirePendingReservations` function (called by each cron run via `/api/internal/jobs/run`) performs three types of reconciliation:

### Stale pending reservations

Reservations stuck in `pending` for more than 2 minutes are marked `failed`. Since `pending` reservations never incremented `reserved`, no counter adjustment is needed. This handles the case where a server crash occurred between the row INSERT and the activation UPDATE.

### Stale consuming reservations

Reservations stuck in `consuming` for more than 5 minutes are treated as if consumption completed. Both `reserved` and `quantity_available` are decremented, and the reservation is marked `consumed`. This handles the case where a worker claimed the reservation for consumption but crashed before writing the final `consumed` status and decrementing the counters.

### Stale releasing reservations

Reservations stuck in `releasing` for more than 5 minutes are treated as if release completed. Only `reserved` is decremented, and the reservation is marked `released` with `release_reason = 'reconciliation_stale_releasing'`. This handles the case where a worker claimed the reservation for release but crashed before writing the final `released` status.

## Atomic operations

Because the neon-http driver does not support interactive row-locked transactions, all stock mutations use atomic conditional UPDATEs.

### Reserve (checkout)

```sql
UPDATE inventory
SET reserved = reserved + $1, updated_at = now()
WHERE product_id = $2
  AND COALESCE(quantity_available, 0) - reserved >= $1
RETURNING id, quantity_available, reserved;
```

If 0 rows are returned, the reservation failed (insufficient stock). The caller rolls back all previously-created reservations for the same order and aborts checkout.

### Consume (after capture)

```sql
UPDATE inventory
SET reserved = GREATEST(reserved - $1, 0),
    quantity_available = GREATEST(COALESCE(quantity_available, 0) - $1, 0),
    updated_at = now()
WHERE product_id = $2
  AND reserved >= $1;
```

### Release (on failure/cancel/expiry)

```sql
UPDATE inventory
SET reserved = GREATEST(reserved - $1, 0),
    updated_at = now()
WHERE product_id = $2
  AND reserved >= $1;
```

## Manual adjustments

Admins record adjustments via `/admin/inventory?tab=new`. The form requires:

- Product
- Type (receipt, correction, damage, return, reservation_correction, release)
- Delta (non-zero integer)
- Reason (3-300 characters)
- Internal note (optional)

The `recordInventoryAdjustment` helper:

1. Ensures an `inventory` row exists for the product (creates one with 0/0 if not).
2. Atomically updates `quantity_available`. Positive deltas add directly. Negative deltas use `GREATEST(... + delta, 0)` to prevent negative stock.
3. Inserts an `inventory_adjustments` row with the before/after snapshot.

Direct quantity overwrites are NOT permitted — every change goes through the adjustment flow.

## Sellable quantity

`getSellableQuantity(productId)` returns `max(0, quantity_available - reserved)`. This is the value displayed to customers and used by the low-stock warning threshold (`low_stock_threshold` setting, default 3).

## Failure modes

- **Concurrent checkout races** — handled by the atomic conditional UPDATE. Only one request can claim a given unit of stock.
- **Reservation consumed twice** — prevented by the `WHERE status = 'active'` filter in `consumeReservationsForOrder`. Second call returns 0 rows.
- **Reservation released twice** — prevented by the same filter in `releaseReservationsForOrder`. Second call returns 0 rows.
- **Consume and release racing** — prevented by atomic status claims. Only one can claim `active → consuming/releasing`.
- **Negative stock** — prevented by `GREATEST(... , 0)` in every decrement path.
- **Reservation leaked after Razorpay failure** — the checkout route explicitly calls `releaseReservationsForOrder` if Razorpay order creation throws.
- **Reservation leaked after webhook timeout** — the cron sweep catches any active reservation whose `expires_at` has passed.
- **Reservation leaked after payment captured but not consumed** — `repairIncompletePostPaymentProcessing` detects null `inventory_consumed_at` and attempts consumption.
- **Pending reservation stuck forever** — the 2-minute stale-pending sweep marks it `failed`.
- **Consuming/releasing reservation stuck forever** — the 5-minute stale-transition sweep completes the transition.
