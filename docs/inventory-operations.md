# Inventory Operations

This document explains how inventory is modelled, reserved, adjusted, and reconciled in production.

## Schema

Three tables govern inventory:

- `inventory` — one row per product. Columns: `quantity_available` (physical stock on hand), `reserved` (held for pending orders), `lead_time`.
- `inventory_reservations` — one row per order line. Columns: `order_id`, `product_id`, `quantity`, `status`, `expires_at`, `consumed_at`, `released_at`, `release_reason`.
- `inventory_adjustments` — immutable history. Every manual adjustment produces one row with `delta`, `reason`, `actor_user_id`, `actor_email`, `quantity_before`, `quantity_after`, `reserved_before`, `reserved_after`.

The `inventory.reserved` column is never negative — application logic uses `GREATEST(reserved - quantity, 0)` on release.

## Reservation lifecycle

A reservation moves through five statuses:

1. **active** — created at checkout, holds stock.
2. **consumed** — set after verified payment capture. Both `inventory.reserved` and `inventory.quantity_available` are decremented.
3. **released** — set when an unpaid order is cancelled or payment fails. Only `inventory.reserved` is decremented.
4. **expired** — set by the cron sweep when `expires_at` passes. Same effect as released.
5. **cancelled** — administrative override (rare).

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

## Cron sweep

The `/api/internal/jobs/run` endpoint (triggered every 5 minutes by Vercel Cron) calls `expirePendingReservations()`. This:

1. Selects all `inventory_reservations` rows with `status = 'active'` AND `expires_at <= now()`.
2. For each, atomically decrements `inventory.reserved` and updates the reservation to `status = 'expired'`.
3. Marks any unpaid orders (`status = 'payment_pending'`) for those reservations as `cancelled`.

## Sellable quantity

`getSellableQuantity(productId)` returns `max(0, quantity_available - reserved)`. This is the value displayed to customers and used by the low-stock warning threshold (`low_stock_threshold` setting, default 3).

## Failure modes

- **Concurrent checkout races** — handled by the atomic conditional UPDATE. Only one request can claim a given unit of stock.
- **Reservation consumed twice** — prevented by the `WHERE status = 'active'` filter in `consumeReservationsForOrder`.
- **Reservation released twice** — prevented by the same filter in `releaseReservationsForOrder`.
- **Negative stock** — prevented by `GREATEST(... , 0)` in every decrement path.
- **Reservation leaked after Razorpay failure** — the checkout route explicitly calls `releaseReservationsForOrder` if Razorpay order creation throws.
- **Reservation leaked after webhook timeout** — the cron sweep catches any active reservation whose `expires_at` has passed.
