"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { inventory, inventoryAdjustments, inventoryReservations, products } from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/audit";
import { recordInventoryAdjustment } from "@/lib/inventory";
import { getSettingInt } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; reason: string; status?: number };

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["receipt", "correction", "damage", "return", "reservation_correction", "release"]),
  delta: z.number().int().refine((v) => v !== 0, "Delta must be non-zero"),
  reason: z.string().trim().min(3).max(300),
  internalNote: z.string().trim().max(1000).optional(),
});

export async function listInventoryForAdmin(input: { lowStockOnly?: boolean; page?: number; pageSize?: number }) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const lowStockThreshold = await getSettingInt("low_stock_threshold", 3);
  const conditions = [];
  if (input.lowStockOnly) {
    conditions.push(
      sql`(COALESCE(${inventory.quantityAvailable}, 0) - ${inventory.reserved} <= ${lowStockThreshold})`,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      productId: inventory.productId,
      model: products.model,
      title: products.title,
      stockStatus: products.stockStatus,
      leadTime: products.leadTime,
      quantityAvailable: inventory.quantityAvailable,
      reserved: inventory.reserved,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .where(where)
    .orderBy(desc(inventory.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(inventory).where(where);
  const items = rows.map((row) => ({
    ...row,
    sellable: Math.max(0, (row.quantityAvailable ?? 0) - (row.reserved ?? 0)),
    lowStock: Math.max(0, (row.quantityAvailable ?? 0) - (row.reserved ?? 0)) <= lowStockThreshold,
  }));
  return { items, total: Number(totalRows[0]?.count ?? 0), page, pageSize, lowStockThreshold };
}

export async function listInventoryAdjustmentsForAdmin(input: { productId?: string; page?: number; pageSize?: number }) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const where = input.productId ? eq(inventoryAdjustments.productId, input.productId) : undefined;
  const rows = await db
    .select({
      id: inventoryAdjustments.id,
      productId: inventoryAdjustments.productId,
      model: products.model,
      type: inventoryAdjustments.type,
      delta: inventoryAdjustments.delta,
      reason: inventoryAdjustments.reason,
      internalNote: inventoryAdjustments.internalNote,
      actorEmail: inventoryAdjustments.actorEmail,
      quantityBefore: inventoryAdjustments.quantityBefore,
      quantityAfter: inventoryAdjustments.quantityAfter,
      reservedBefore: inventoryAdjustments.reservedBefore,
      reservedAfter: inventoryAdjustments.reservedAfter,
      createdAt: inventoryAdjustments.createdAt,
    })
    .from(inventoryAdjustments)
    .leftJoin(products, eq(products.id, inventoryAdjustments.productId))
    .where(where)
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryAdjustments)
    .where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export async function recordInventoryAdjustmentAction(input: z.infer<typeof adjustmentSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  try {
    const result = await recordInventoryAdjustment({
      productId: parsed.data.productId,
      type: parsed.data.type,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      actorUserId: admin.context.userId,
      actorEmail: admin.context.email,
      internalNote: parsed.data.internalNote,
    });
    await recordAudit({
      actorUserId: admin.context.userId,
      actorEmail: admin.context.email,
      action: `inventory_adjustment_${parsed.data.type}`,
      entityType: "inventory",
      entityId: parsed.data.productId,
      before: { quantity: result.quantityBefore, reserved: result.reservedBefore },
      after: { quantity: result.quantityAfter, reserved: result.reservedAfter, reason: parsed.data.reason },
    });
    revalidatePath("/admin/inventory");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return { ok: false, reason: message };
  }
}

export async function listReservationsForAdmin(input: { activeOnly?: boolean; page?: number; pageSize?: number }) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 25));
  const where = input.activeOnly ? eq(inventoryReservations.status, "active") : undefined;
  const rows = await db
    .select({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
      productId: inventoryReservations.productId,
      model: products.model,
      quantity: inventoryReservations.quantity,
      status: inventoryReservations.status,
      expiresAt: inventoryReservations.expiresAt,
      consumedAt: inventoryReservations.consumedAt,
      releasedAt: inventoryReservations.releasedAt,
      releaseReason: inventoryReservations.releaseReason,
      createdAt: inventoryReservations.createdAt,
    })
    .from(inventoryReservations)
    .leftJoin(products, eq(products.id, inventoryReservations.productId))
    .where(where)
    .orderBy(desc(inventoryReservations.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryReservations)
    .where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}
