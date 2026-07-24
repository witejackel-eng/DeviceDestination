/**
 * Inventory reservation/consumption/release with atomic PostgreSQL functions.
 *
 * Critical mutations are encapsulated in SECURITY DEFINER functions
 * (migration 0004_inventory_atomic.sql) that use row-level locks internally.
 * Each function is a single atomic transaction: it validates the expected
 * state, updates counters, updates reservation state, and writes an
 * immutable inventory_ledger entry — all or nothing.
 *
 * The functions are called from TypeScript via `db.execute(sql\`SELECT ...\`)`.
 * This works with both the neon-http driver (production) and the node-postgres
 * driver (tests/local dev).
 *
 * Invariants enforced by the database:
 *  - reserved >= 0 (CHECK constraint)
 *  - quantity_available >= 0 (CHECK constraint)
 *  - reservation quantity > 0 (CHECK constraint)
 *  - operation_id is unique (prevents replay)
 *  - One reservation cannot be consumed twice (function checks status)
 *  - Release and consumption cannot both succeed (function checks status)
 */

import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  inventory,
  inventoryAdjustments,
  inventoryReservations,
  orders,
  products,
} from "@/db/schema";
import { logger } from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import type { reservationStatus, inventoryAdjustmentType } from "@/db/schema";

export type ReservationStatus = (typeof reservationStatus.enumValues)[number];
export type AdjustmentType = (typeof inventoryAdjustmentType.enumValues)[number];

export class InventoryError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "InventoryError";
  }
}

/**
 * Aggregate duplicate product lines by product ID. If the same product
 * appears multiple times, merge them into one line with summed quantity.
 */
function aggregateItems(items: Array<{ productId: string; quantity: number }>): Array<{ productId: string; quantity: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new InventoryError(`Invalid quantity for product ${item.productId}`, "invalid_quantity");
    }
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
  }
  return Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Reserve inventory for an order using the atomic `reserve_inventory_for_order`
 * PostgreSQL function. Each item is reserved in its own atomic transaction;
 * if any item fails, all previously-created reservations for this order are
 * released.
 *
 * The function:
 *   1. Inserts a reservation row with status 'pending'
 *   2. Locks the inventory row (FOR UPDATE)
 *   3. Validates stock availability
 *   4. Increments inventory.reserved
 *   5. Activates the reservation (pending → active)
 *   6. Writes an inventory_ledger entry
 *   7. Returns the reservation ID
 *
 * All of this happens inside a single DB transaction. A process crash cannot
 * leave the counters and reservation state inconsistent.
 */
export async function reserveInventoryForOrder(input: {
  orderId: string;
  items: Array<{ productId: string; quantity: number }>;
  reservationMinutes?: number;
}): Promise<{ reservationIds: string[]; expiresAt: Date }> {
  if (!isDatabaseConfigured()) {
    throw new InventoryError("Database is not configured", "db_unconfigured");
  }
  if (input.items.length === 0) {
    throw new InventoryError("No items to reserve", "no_items");
  }

  const db = getDb();
  const reservationMinutes =
    input.reservationMinutes ?? Number(await getSetting("default_reservation_minutes", "15"));
  const minutes = Number.isFinite(reservationMinutes) && reservationMinutes > 0 ? reservationMinutes : 15;
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  const aggregated = aggregateItems(input.items);
  const created: string[] = [];

  for (const item of aggregated) {
    const operationId = `reserve_${input.orderId}_${item.productId}_${randomUUID().slice(0, 8)}`;
    try {
      const result = await db.execute(sql`
        SELECT reserve_inventory_for_order(
          ${input.orderId}::uuid,
          ${item.productId}::uuid,
          ${item.quantity}::integer,
          ${expiresAt}::timestamptz,
          ${operationId}::text,
          'system'::text
        ) AS reservation_id
      `);
      const rows = Array.isArray(result) ? result : ((result as any).rows ?? []);
      const reservationId = (rows[0] as { reservation_id?: string })?.reservation_id;
      if (!reservationId) {
        throw new InventoryError("Failed to create reservation", "reservation_failed");
      }
      created.push(reservationId);
    } catch (error) {
      // Roll back all previously-created reservations for this order.
      for (const prevId of created) {
        const rollbackOpId = `release_rollback_${prevId}_${randomUUID().slice(0, 8)}`;
        try {
          await db.execute(sql`
            SELECT release_reservation(
              ${prevId}::uuid,
              'reserve_rollback'::text,
              ${rollbackOpId}::text,
              'system'::text
            )
          `);
        } catch {
          // Best-effort rollback; the ledger records the attempt.
        }
      }
      const message = error instanceof Error ? error.message : "Insufficient stock";
      logger.warn(
        { event: "inventory_reservation_failed", orderId: input.orderId, productId: item.productId, error: message },
        "Inventory reservation failed",
      );
      throw new InventoryError(
        `Insufficient stock for product ${item.productId}`,
        "insufficient_stock",
      );
    }
  }

  logger.info(
    { event: "inventory_reserved", orderId: input.orderId, count: created.length, expiresAt },
    "Inventory reserved for order",
  );
  return { reservationIds: created, expiresAt };
}

/**
 * Compensate an already-activated reservation by releasing it.
 */
async function compensateActivatedReservation(
  db: ReturnType<typeof getDb>,
  reservationId: string,
  orderId: string,
): Promise<void> {
  const [reservation] = await db
    .select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.id, reservationId))
    .limit(1);

  if (!reservation || reservation.status !== "active") return;

  // Decrement reserved counter atomically.
  await db
    .update(inventory)
    .set({
      reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inventory.productId, reservation.productId),
        sql`${inventory.reserved} >= ${reservation.quantity}`,
      ),
    );

  await db
    .update(inventoryReservations)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(inventoryReservations.id, reservationId));
}

/**
 * Release all active reservations for an order. Idempotent — calling twice is
 * safe. Uses the atomic `release_reservation` PostgreSQL function per
 * reservation, which locks the reservation row, validates status, decrements
 * the counter, and writes a ledger entry in a single transaction.
 */
export async function releaseReservationsForOrder(orderId: string, reason: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();

  // Find all active reservations for this order.
  const active = await db
    .select({ id: inventoryReservations.id })
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    );

  if (active.length === 0) {
    // Also fail any pending reservations (shouldn't normally exist).
    await db
      .update(inventoryReservations)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(inventoryReservations.orderId, orderId),
          eq(inventoryReservations.status, "pending"),
        ),
      );
    return 0;
  }

  let released = 0;
  for (const reservation of active) {
    const operationId = `release_${reservation.id}_${randomUUID().slice(0, 8)}`;
    try {
      const result = await db.execute(sql`
        SELECT release_reservation(
          ${reservation.id}::uuid,
          ${reason}::text,
          ${operationId}::text,
          'system'::text
        ) AS released_qty
      `);
      const rows = Array.isArray(result) ? result : ((result as any).rows ?? []);
      const qty = (rows[0] as { released_qty?: number })?.released_qty;
      if (qty && qty > 0) released++;
    } catch (error) {
      logger.error(
        { event: "release_reservation_failed", reservationId: reservation.id, orderId, error: error instanceof Error ? error.message : "unknown" },
        "Failed to release reservation",
      );
    }
  }

  logger.info(
    { event: "inventory_released", orderId, reason, count: released },
    "Inventory released",
  );
  return released;
}

/**
 * Consume reservations for an order after verified payment capture.
 * Uses the atomic `consume_reservation` PostgreSQL function per reservation,
 * which locks the reservation row, validates status, decrements both counters,
 * and writes a ledger entry in a single transaction.
 *
 * Idempotent — already-consumed reservations return 0 from the function.
 * Never permits double consumption (the function checks status = 'active').
 */
export async function consumeReservationsForOrder(orderId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();

  // Find all active reservations for this order.
  const active = await db
    .select({ id: inventoryReservations.id })
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    );

  if (active.length === 0) return 0;

  let consumed = 0;
  for (const reservation of active) {
    const operationId = `consume_${reservation.id}_${randomUUID().slice(0, 8)}`;
    try {
      const result = await db.execute(sql`
        SELECT consume_reservation(
          ${reservation.id}::uuid,
          ${operationId}::text,
          'system'::text
        ) AS consumed_qty
      `);
      const rows = Array.isArray(result) ? result : ((result as any).rows ?? []);
      const qty = (rows[0] as { consumed_qty?: number })?.consumed_qty;
      if (qty && qty > 0) consumed++;
    } catch (error) {
      logger.error(
        { event: "consume_reservation_failed", reservationId: reservation.id, orderId, error: error instanceof Error ? error.message : "unknown" },
        "Failed to consume reservation",
      );
    }
  }

  logger.info(
    { event: "inventory_consumed", orderId, count: consumed },
    "Inventory consumed for paid order",
  );
  return consumed;
}

/**
 * Expire all reservations whose `expiresAt` has passed and that are still
 * active. Also handles stale "pending" reservations and stale
 * "consuming"/"releasing" reservations.
 *
 * Called by the cron job runner.
 */
export async function expirePendingReservations(): Promise<{ expired: number; ordersAffected: string[] }> {
  if (!isDatabaseConfigured()) return { expired: 0, ordersAffected: [] };
  const db = getDb();
  const now = new Date();

  let totalExpired = 0;
  const ordersAffected = new Set<string>();

  // ── 1. Expire stale active reservations (past their expiry time) ────────
  // Atomically claim: active → releasing.
  const expiredActive = await db
    .update(inventoryReservations)
    .set({ status: "releasing", updatedAt: now })
    .where(
      and(
        eq(inventoryReservations.status, "active"),
        lte(inventoryReservations.expiresAt, now),
      ),
    )
    .returning({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
    });

  for (const reservation of expiredActive) {
    // Decrement reserved atomically.
    await db
      .update(inventory)
      .set({
        reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
        updatedAt: now,
      })
      .where(
        and(
          eq(inventory.productId, reservation.productId),
          sql`${inventory.reserved} >= ${reservation.quantity}`,
        ),
      );

    // Mark as expired.
    await db
      .update(inventoryReservations)
      .set({
        status: "expired",
        releasedAt: now,
        releaseReason: "expired",
        updatedAt: now,
      })
      .where(eq(inventoryReservations.id, reservation.id));

    ordersAffected.add(reservation.orderId);
    totalExpired++;
  }

  // ── 2. Handle stale "pending" reservations (older than 2 minutes) ──────
  // These should have been activated within seconds; if still pending after
  // 2 minutes, something went wrong. Mark them as failed.
  const stalePendingCutoff = new Date(now.getTime() - 2 * 60_000);
  const stalePending = await db
    .update(inventoryReservations)
    .set({ status: "failed", updatedAt: now })
    .where(
      and(
        eq(inventoryReservations.status, "pending"),
        lte(inventoryReservations.createdAt, stalePendingCutoff),
      ),
    )
    .returning({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
    });

  // Note: pending reservations did NOT increment the reserved counter,
  // so we don't need to compensate the counter.
  for (const reservation of stalePending) {
    ordersAffected.add(reservation.orderId);
    totalExpired++;
  }

  // ── 3. Handle stale "consuming" or "releasing" reservations (older than 5 minutes) ──
  // These should complete within seconds; if stuck, reconcile them.
  const staleTransitionCutoff = new Date(now.getTime() - 5 * 60_000);
  const staleConsuming = await db
    .select({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
      status: inventoryReservations.status,
    })
    .from(inventoryReservations)
    .where(
      and(
        sql`${inventoryReservations.status} IN ('consuming', 'releasing')`,
        lte(inventoryReservations.updatedAt, staleTransitionCutoff),
      ),
    );

  for (const reservation of staleConsuming) {
    if (reservation.status === "consuming") {
      // Treat as consumed — decrement both reserved and available.
      await db
        .update(inventory)
        .set({
          reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
          quantityAvailable: sql`GREATEST(COALESCE(${inventory.quantityAvailable}, 0) - ${reservation.quantity}, 0)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(inventory.productId, reservation.productId),
            sql`${inventory.reserved} >= ${reservation.quantity}`,
          ),
        );

      await db
        .update(inventoryReservations)
        .set({
          status: "consumed",
          consumedAt: now,
          updatedAt: now,
        })
        .where(eq(inventoryReservations.id, reservation.id));
    } else if (reservation.status === "releasing") {
      // Treat as released — decrement reserved only.
      await db
        .update(inventory)
        .set({
          reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(inventory.productId, reservation.productId),
            sql`${inventory.reserved} >= ${reservation.quantity}`,
          ),
        );

      await db
        .update(inventoryReservations)
        .set({
          status: "released",
          releasedAt: now,
          releaseReason: "reconciliation_stale_releasing",
          updatedAt: now,
        })
        .where(eq(inventoryReservations.id, reservation.id));
    }

    ordersAffected.add(reservation.orderId);
    totalExpired++;
  }

  if (totalExpired > 0) {
    logger.info(
      { event: "inventory_expired", count: totalExpired, orders: Array.from(ordersAffected) },
      "Expired stale inventory reservations",
    );
  }
  return { expired: totalExpired, ordersAffected: Array.from(ordersAffected) };
}

/**
 * Opportunistic cleanup: before creating new reservations for specific
 * products, cleanup expired ones for those products only. Bounded and indexed.
 */
export async function cleanupExpiredReservationsForProducts(productIds: string[]): Promise<number> {
  if (!isDatabaseConfigured() || productIds.length === 0) return 0;
  const db = getDb();
  const now = new Date();

  // Small batch: only cleanup expired active reservations for these products.
  const expired = await db
    .update(inventoryReservations)
    .set({ status: "releasing", updatedAt: now })
    .where(
      and(
        eq(inventoryReservations.status, "active"),
        lte(inventoryReservations.expiresAt, now),
        inArray(inventoryReservations.productId, productIds),
      ),
    )
    .returning({
      id: inventoryReservations.id,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
    });

  for (const reservation of expired) {
    await db
      .update(inventory)
      .set({
        reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
        updatedAt: now,
      })
      .where(
        and(
          eq(inventory.productId, reservation.productId),
          sql`${inventory.reserved} >= ${reservation.quantity}`,
        ),
      );

    await db
      .update(inventoryReservations)
      .set({
        status: "expired",
        releasedAt: now,
        releaseReason: "expired_opportunistic",
        updatedAt: now,
      })
      .where(eq(inventoryReservations.id, reservation.id));
  }

  return expired.length;
}

/**
 * Opportunistic cleanup before checkout: cleanup expired reservations for
 * the products in the order items. Called during checkout preparation.
 */
export async function cleanupExpiredReservationsBeforeCheckout(
  orderItems: Array<{ productId: string; quantity: number }>,
): Promise<number> {
  const productIds = orderItems.map((item) => item.productId);
  return cleanupExpiredReservationsForProducts(productIds);
}

/**
 * Record a manual inventory adjustment. Always creates an immutable history
 * entry and updates the current inventory row. The caller must authorize the
 * actor.
 */
export async function recordInventoryAdjustment(input: {
  productId: string;
  type: AdjustmentType;
  delta: number;
  reason: string;
  actorUserId: string;
  actorEmail?: string;
  internalNote?: string;
}): Promise<{ quantityBefore: number | null; quantityAfter: number | null; reservedBefore: number; reservedAfter: number }> {
  if (!isDatabaseConfigured()) {
    throw new InventoryError("Database is not configured", "db_unconfigured");
  }
  if (input.delta === 0) {
    throw new InventoryError("Adjustment delta must be non-zero", "zero_delta");
  }
  if (input.reason.trim().length === 0) {
    throw new InventoryError("Adjustment reason is required", "missing_reason");
  }
  const db = getDb();
  // Ensure an inventory row exists.
  const [existing] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, input.productId))
    .limit(1);
  let quantityBefore = existing?.quantityAvailable ?? null;
  let reservedBefore = existing?.reserved ?? 0;
  if (!existing) {
    const [created] = await db
      .insert(inventory)
      .values({
        productId: input.productId,
        quantityAvailable: 0,
        reserved: 0,
      })
      .returning();
    quantityBefore = 0;
    reservedBefore = 0;
    void created;
  }
  // Atomic update — never let quantity go negative for stock reductions.
  const updated = await db
    .update(inventory)
    .set({
      quantityAvailable:
        input.delta > 0
          ? sql`COALESCE(${inventory.quantityAvailable}, 0) + ${input.delta}`
          : sql`GREATEST(COALESCE(${inventory.quantityAvailable}, 0) + ${input.delta}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(inventory.productId, input.productId))
    .returning({ quantityAvailable: inventory.quantityAvailable, reserved: inventory.reserved });

  const quantityAfter = updated[0]?.quantityAvailable ?? null;
  const reservedAfter = updated[0]?.reserved ?? reservedBefore;

  await db.insert(inventoryAdjustments).values({
    productId: input.productId,
    type: input.type,
    delta: input.delta,
    reason: input.reason,
    internalNote: input.internalNote ?? null,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail ?? null,
    quantityBefore,
    quantityAfter,
    reservedBefore,
    reservedAfter,
  });

  return { quantityBefore, quantityAfter, reservedBefore, reservedAfter };
}

/**
 * Compute the current sellable quantity for a product (available minus
 * reserved). Returns null if inventory is unconfigured.
 */
export async function getSellableQuantity(productId: string): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select({
      available: inventory.quantityAvailable,
      reserved: inventory.reserved,
    })
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .limit(1);
  if (!row) return null;
  const available = row.available ?? 0;
  const reserved = row.reserved ?? 0;
  return Math.max(0, available - reserved);
}

/**
 * Bulk fetch sellable quantities for a list of products.
 */
export async function getSellableQuantities(productIds: string[]): Promise<Map<string, number>> {
  if (!isDatabaseConfigured() || productIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      productId: inventory.productId,
      available: inventory.quantityAvailable,
      reserved: inventory.reserved,
    })
    .from(inventory)
    .where(inArray(inventory.productId, productIds));
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.productId, Math.max(0, (row.available ?? 0) - (row.reserved ?? 0)));
  }
  return map;
}
