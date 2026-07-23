import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
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
 * Acquire inventory reservations atomically. The neon-http driver does not
 * support interactive transactions with row locks, so we use atomic
 * conditional UPDATEs — `RETURNING` rows that succeeded, no rows for products
 * that would oversell.
 *
 * Returns the reservation IDs that were created. If ANY line fails to
 * reserve, all previously-created reservations for this order are released
 * and an error is thrown. The caller MUST handle this error and not create
 * the order/payment record.
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

  const created: string[] = [];
  for (const item of input.items) {
    if (item.quantity <= 0) {
      throw new InventoryError(`Invalid quantity for product ${item.productId}`, "invalid_quantity");
    }
    // Atomic conditional reservation: only succeed if enough stock is available.
    // We don't use a transaction because neon-http does not support interactive
    // row-locked transactions. The atomic UPDATE itself is the lock.
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
      .returning({ id: inventory.id, quantityAvailable: inventory.quantityAvailable, reserved: inventory.reserved });

    if (updated.length === 0) {
      // Roll back all reservations created so far for this order.
      await releaseReservationsForOrder(input.orderId, "checkout_rollback");
      throw new InventoryError(
        `Insufficient stock for product ${item.productId}`,
        "insufficient_stock",
      );
    }
    const [reservation] = await db
      .insert(inventoryReservations)
      .values({
        orderId: input.orderId,
        productId: item.productId,
        quantity: item.quantity,
        status: "active",
        expiresAt,
      })
      .returning({ id: inventoryReservations.id });
    if (!reservation) {
      await releaseReservationsForOrder(input.orderId, "checkout_rollback");
      throw new InventoryError("Failed to create reservation record", "reservation_failed");
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
 * Release all active reservations for an order. Idempotent — calling twice is
 * safe. Updates the reserved counter and marks each reservation as `released`
 * or `cancelled` (depending on context).
 */
export async function releaseReservationsForOrder(orderId: string, reason: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const active = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    );
  if (active.length === 0) return 0;
  for (const reservation of active) {
    // Atomic decrement — never let reserved go negative.
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
      .set({
        status: "released",
        releasedAt: new Date(),
        releaseReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(inventoryReservations.id, reservation.id));
  }
  logger.info({ event: "inventory_released", orderId, reason, count: active.length }, "Inventory released");
  return active.length;
}

/**
 * Consume reservations for an order after verified payment capture. Decrements
 * both the reserved counter AND the physical available quantity.
 *
 * Idempotent — already-consumed reservations are skipped.
 */
export async function consumeReservationsForOrder(orderId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const active = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "active"),
      ),
    );
  if (active.length === 0) return 0;
  for (const reservation of active) {
    // Decrement both reserved and quantityAvailable atomically.
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
    await db
      .update(inventoryReservations)
      .set({
        status: "consumed",
        consumedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryReservations.id, reservation.id));
  }
  logger.info({ event: "inventory_consumed", orderId, count: active.length }, "Inventory consumed for paid order");
  return active.length;
}

/**
 * Expire all reservations whose `expiresAt` has passed and that are still
 * active. Called by the cron job runner.
 */
export async function expirePendingReservations(): Promise<{ expired: number; ordersAffected: string[] }> {
  if (!isDatabaseConfigured()) return { expired: 0, ordersAffected: [] };
  const db = getDb();
  const stale = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.status, "active"),
        lte(inventoryReservations.expiresAt, new Date()),
      ),
    );
  const ordersAffected = new Set<string>();
  for (const reservation of stale) {
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
      .set({
        status: "expired",
        releasedAt: new Date(),
        releaseReason: "expired",
        updatedAt: new Date(),
      })
      .where(eq(inventoryReservations.id, reservation.id));
    ordersAffected.add(reservation.orderId);
  }
  if (stale.length > 0) {
    logger.info(
      { event: "inventory_expired", count: stale.length, orders: Array.from(ordersAffected) },
      "Expired stale inventory reservations",
    );
  }
  return { expired: stale.length, ordersAffected: Array.from(ordersAffected) };
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
  // For `receipt`/`return` deltas (positive), no upper bound check needed.
  // For negative deltas (correction/damage), enforce non-negative result.
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
