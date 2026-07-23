/**
 * Inventory reservation/consumption/release with atomic status claims.
 *
 * The neon-http driver does NOT support interactive transactions with row
 * locks, so all atomic operations use conditional UPDATEs with RETURNING.
 *
 * Key design choices:
 *  - Reservation rows are inserted in "pending" status FIRST, before
 *    incrementing the inventory counter. If the counter update fails,
 *    the reservation is marked "failed" and the counter is not touched.
 *  - Consumption and release use atomic status claims (active → consuming
 *    or releasing) so only the claiming worker may alter inventory.
 *  - Never let reserved go negative, never let quantityAvailable go negative.
 */

import { and, eq, inArray, lte, sql } from "drizzle-orm";
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
 * Reserve inventory for an order using the pending→active flow.
 *
 * 1. Aggregate duplicate product lines by product ID
 * 2. Insert reservation row with status "pending" FIRST
 * 3. Atomically increment inventory.reserved only when stock is available
 * 4. If inventory update fails → mark reservation "failed"
 * 5. If inventory update succeeds → atomically activate (pending → active)
 * 6. If activation fails after inventory increment → compensate the counter
 * 7. If ANY line fails → rollback all previously-created reservations
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

  // Step 1: Aggregate duplicates.
  const aggregated = aggregateItems(input.items);

  const created: string[] = [];
  const pendingReservations: string[] = []; // Track for rollback.

  for (const item of aggregated) {
    // Step 2: Insert reservation row with status "pending" FIRST.
    const [reservation] = await db
      .insert(inventoryReservations)
      .values({
        orderId: input.orderId,
        productId: item.productId,
        quantity: item.quantity,
        status: "pending",
        expiresAt,
      })
      .returning({ id: inventoryReservations.id });

    if (!reservation) {
      // Mark any previous pending reservations as failed.
      for (const pendingId of pendingReservations) {
        await db
          .update(inventoryReservations)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(inventoryReservations.id, pendingId));
      }
      throw new InventoryError("Failed to create reservation record", "reservation_failed");
    }

    pendingReservations.push(reservation.id);

    // Step 3: Atomically increment inventory.reserved only when stock is available.
    const updated = await db
      .update(inventory)
      .set({
        reserved: sql`${inventory.reserved} + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventory.productId, item.productId),
          sql`COALESCE(${inventory.quantityAvailable}, 0) - ${inventory.reserved} >= ${item.quantity}`,
        ),
      )
      .returning({ id: inventory.id });

    if (updated.length === 0) {
      // Step 4: Inventory update failed → mark reservation "failed".
      await db
        .update(inventoryReservations)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(inventoryReservations.id, reservation.id));

      // Roll back all previously-activated reservations for this order.
      for (const prevId of created) {
        // These were already activated, so we need to compensate.
        await compensateActivatedReservation(db, prevId, input.orderId);
      }
      // Also mark any previous pending reservations as failed.
      for (const pendingId of pendingReservations) {
        if (pendingId !== reservation.id) {
          await db
            .update(inventoryReservations)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(inventoryReservations.id, pendingId));
        }
      }

      throw new InventoryError(
        `Insufficient stock for product ${item.productId}`,
        "insufficient_stock",
      );
    }

    // Step 5: Atomically activate reservation (pending → active).
    const activated = await db
      .update(inventoryReservations)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(inventoryReservations.id, reservation.id),
          eq(inventoryReservations.status, "pending"),
        ),
      )
      .returning({ id: inventoryReservations.id });

    if (activated.length === 0) {
      // Step 6: Activation failed after inventory increment — compensate.
      // Decrement the reserved counter back.
      await db
        .update(inventory)
        .set({
          reserved: sql`GREATEST(${inventory.reserved} - ${item.quantity}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.productId, item.productId));

      // Mark reservation as failed.
      await db
        .update(inventoryReservations)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(inventoryReservations.id, reservation.id));

      // Roll back all previously-activated reservations.
      for (const prevId of created) {
        await compensateActivatedReservation(db, prevId, input.orderId);
      }

      throw new InventoryError(
        "Failed to activate reservation after inventory increment",
        "activation_failed",
      );
    }

    created.push(reservation.id);
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
 * safe. Uses atomic status claims: active → releasing → released.
 */
export async function releaseReservationsForOrder(orderId: string, reason: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();

  // Atomically claim all active reservations: active → releasing.
  const claimed = await db
    .update(inventoryReservations)
    .set({ status: "releasing", updatedAt: new Date() })
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    )
    .returning({
      id: inventoryReservations.id,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
    });

  if (claimed.length === 0) return 0;

  // Also claim any "pending" reservations (shouldn't normally exist, but
  // handle them for safety).
  const pendingClaimed = await db
    .update(inventoryReservations)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "pending"),
      ),
    )
    .returning({ id: inventoryReservations.id });

  for (const reservation of claimed) {
    // Decrement reserved atomically — never let it go negative.
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

    // Mark reservation released.
    await db
      .update(inventoryReservations)
      .set({
        status: "released",
        releasedAt: new Date(),
        releaseReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(inventoryReservations.id, reservation.id));
  }

  logger.info(
    { event: "inventory_released", orderId, reason, count: claimed.length },
    "Inventory released",
  );
  return claimed.length;
}

/**
 * Consume reservations for an order after verified payment capture.
 * Uses atomic status claims: active → consuming → consumed.
 *
 * Decrements both the reserved counter AND the physical available quantity.
 * Idempotent — already-consumed reservations are skipped.
 * Never permits double consumption.
 */
export async function consumeReservationsForOrder(orderId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();

  // Atomically claim all active reservations: active → consuming.
  // Only the worker receiving the returned row may alter inventory.
  const claimed = await db
    .update(inventoryReservations)
    .set({ status: "consuming", updatedAt: new Date() })
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    )
    .returning({
      id: inventoryReservations.id,
      productId: inventoryReservations.productId,
      quantity: inventoryReservations.quantity,
    });

  if (claimed.length === 0) return 0;

  for (const reservation of claimed) {
    // Decrement both reserved and quantityAvailable atomically.
    // Never let either go negative.
    await db
      .update(inventory)
      .set({
        reserved: sql`GREATEST(${inventory.reserved} - ${reservation.quantity}, 0)`,
        quantityAvailable: sql`GREATEST(COALESCE(${inventory.quantityAvailable}, 0) - ${reservation.quantity}, 0)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventory.productId, reservation.productId),
          sql`${inventory.reserved} >= ${reservation.quantity}`,
        ),
      );

    // Change consuming → consumed.
    await db
      .update(inventoryReservations)
      .set({
        status: "consumed",
        consumedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryReservations.id, reservation.id));
  }

  logger.info(
    { event: "inventory_consumed", orderId, count: claimed.length },
    "Inventory consumed for paid order",
  );
  return claimed.length;
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
