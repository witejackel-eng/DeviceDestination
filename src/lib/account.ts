import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  customers,
  orderItems,
  orders,
  users,
} from "@/db/schema";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";
import { getSettingInt } from "@/lib/settings";

export class AccountError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AccountError";
  }
}

/**
 * Get or create a customer record for the given user. Used by account pages
 * to ensure the user has a customer row before creating addresses or placing
 * authenticated orders.
 */
export async function ensureCustomerForUser(input: {
  userId: string;
  name: string;
  email: string;
  mobile?: string | null;
}): Promise<{ customerId: string; created: boolean }> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, input.userId))
    .limit(1);
  if (existing) return { customerId: existing.id, created: false };
  const [created] = await db
    .insert(customers)
    .values({
      userId: input.userId,
      name: input.name,
      email: input.email,
      mobile: input.mobile ?? "",
    })
    .returning({ id: customers.id });
  return { customerId: created.id, created: true };
}

/**
 * List orders for an authenticated user. Page is 1-indexed.
 */
export async function listOrdersForUser(input: {
  userId: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalInclGstPaise: number;
    createdAt: Date;
    invoiceNumber: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!isDatabaseConfigured()) return { orders: [], total: 0, page: 1, pageSize: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10));
  // Find the user's customer rows (could be multiple if they had guest orders
  // linked by email — we link them via userId after claim).
  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, input.userId));
  if (customerRows.length === 0) {
    return { orders: [], total: 0, page, pageSize };
  }
  const customerIds = customerRows.map((row) => row.id);
  const where = inArray(orders.customerId, customerIds);
  const totalRows = await db.select({ count: count() }).from(orders).where(where);
  const total = Number(totalRows[0]?.count ?? 0);
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalInclGstPaise: orders.totalInclGstPaise,
      createdAt: orders.createdAt,
      invoiceNumber: orders.invoiceNumber,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { orders: rows, total, page, pageSize };
}

/**
 * Verify that an order belongs to the given user. Returns the order row if
 * owned, otherwise null.
 */
export async function getOrderForUser(
  userId: string,
  orderNumber: string,
): Promise<{ order: typeof orders.$inferSelect; items: Array<typeof orderItems.$inferSelect> } | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, userId));
  if (customerRows.length === 0) return null;
  const customerIds = customerRows.map((row) => row.id);
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), inArray(orders.customerId, customerIds)))
    .limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

/**
 * Claim guest orders when a verified signed-in user's email matches the order's
 * customer email. Performs the link server-side and records an audit event.
 *
 * Rules:
 *  - Only links orders whose customer row has userId = null
 *  - Only links when the signed-in user's email matches the customer email
 *  - Idempotent — already-linked orders are skipped
 */
export async function claimGuestOrdersForUser(input: {
  userId: string;
  email: string;
}): Promise<{ claimed: number; skipped: number }> {
  if (!isDatabaseConfigured()) return { claimed: 0, skipped: 0 };
  const db = getDb();
  const guestCustomers = await db
    .select()
    .from(customers)
    .where(and(eq(customers.email, input.email.toLowerCase()), sql`${customers.userId} IS NULL`));
  if (guestCustomers.length === 0) return { claimed: 0, skipped: 0 };
  let claimed = 0;
  for (const guest of guestCustomers) {
    await db
      .update(customers)
      .set({ userId: input.userId, updatedAt: new Date() })
      .where(eq(customers.id, guest.id));
    claimed++;
    await recordAudit({
      actorUserId: input.userId,
      action: "guest_order_claimed",
      entityType: "customer",
      entityId: guest.id,
      before: { userId: null, email: guest.email },
      after: { userId: input.userId, email: guest.email },
    });
  }
  logger.info({ event: "guest_orders_claimed", userId: input.userId, claimed }, "Guest orders claimed");
  return { claimed, skipped: guestCustomers.length - claimed };
}

/**
 * List saved addresses for a user.
 */
export async function listAddressesForUser(userId: string): Promise<Array<typeof addresses.$inferSelect>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, userId));
  if (customerRows.length === 0) return [];
  const customerIds = customerRows.map((row) => row.id);
  return db
    .select()
    .from(addresses)
    .where(inArray(addresses.customerId, customerIds))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
}

async function getCustomerIdsForUser(userId: string): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, userId));
  return rows.map((row) => row.id);
}

/**
 * Add a saved address. Enforces ownership and the per-user maximum.
 */
export async function createAddressForUser(input: {
  userId: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  instructions?: string;
  isDefault?: boolean;
}): Promise<string> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const customerIds = await getCustomerIdsForUser(input.userId);
  if (customerIds.length === 0) {
    throw new AccountError("Customer record not found", "no_customer");
  }
  const customerId = customerIds[0];
  const maxAddresses = await getSettingInt("max_addresses_per_user", 10);
  const existing = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(eq(addresses.customerId, customerId));
  if (existing.length >= maxAddresses) {
    throw new AccountError(`Maximum ${maxAddresses} addresses reached`, "max_addresses");
  }
  if (input.isDefault) {
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.customerId, customerId));
  }
  const [created] = await db
    .insert(addresses)
    .values({
      customerId,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      instructions: input.instructions ?? null,
      isDefault: input.isDefault ?? false,
    })
    .returning({ id: addresses.id });
  await recordAudit({
    actorUserId: input.userId,
    action: "address_created",
    entityType: "address",
    entityId: created.id,
    after: { customerId, pincode: input.pincode, city: input.city },
  });
  return created.id;
}

/**
 * Update an address. Verifies ownership before persisting.
 */
export async function updateAddressForUser(input: {
  userId: string;
  addressId: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  instructions?: string | null;
  isDefault?: boolean;
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const customerIds = await getCustomerIdsForUser(input.userId);
  if (customerIds.length === 0) {
    throw new AccountError("Customer record not found", "no_customer");
  }
  const [existing] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, input.addressId), inArray(addresses.customerId, customerIds)))
    .limit(1);
  if (!existing) {
    throw new AccountError("Address not found", "not_found");
  }
  const updates: Partial<typeof addresses.$inferInsert> = { updatedAt: new Date() };
  if (input.line1 !== undefined) updates.line1 = input.line1;
  if (input.line2 !== undefined) updates.line2 = input.line2;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;
  if (input.pincode !== undefined) updates.pincode = input.pincode;
  if (input.instructions !== undefined) updates.instructions = input.instructions;
  if (input.isDefault === true) {
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.customerId, existing.customerId));
    updates.isDefault = true;
  }
  await db.update(addresses).set(updates).where(eq(addresses.id, input.addressId));
  await recordAudit({
    actorUserId: input.userId,
    action: "address_updated",
    entityType: "address",
    entityId: input.addressId,
    before: { line1: existing.line1, city: existing.city, pincode: existing.pincode },
  });
}

/**
 * Delete an address. Verifies ownership.
 */
export async function deleteAddressForUser(input: { userId: string; addressId: string }): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const customerIds = await getCustomerIdsForUser(input.userId);
  if (customerIds.length === 0) {
    throw new AccountError("Customer record not found", "no_customer");
  }
  const [existing] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, input.addressId), inArray(addresses.customerId, customerIds)))
    .limit(1);
  if (!existing) {
    throw new AccountError("Address not found", "not_found");
  }
  // Check if address is referenced by an order — if so, do not delete (historical integrity).
  const orderCount = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.shippingAddressId, input.addressId));
  if (Number(orderCount[0]?.count ?? 0) > 0) {
    // Detach by leaving the record but mark it as non-default.
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.id, input.addressId));
    throw new AccountError(
      "Address is referenced by an order and cannot be deleted",
      "in_use",
    );
  }
  await db.delete(addresses).where(eq(addresses.id, input.addressId));
  await recordAudit({
    actorUserId: input.userId,
    action: "address_deleted",
    entityType: "address",
    entityId: input.addressId,
  });
}

/**
 * Update a user's profile (name and mobile). Email is read-only because it is
 * the identity anchor.
 */
export async function updateUserProfile(input: {
  userId: string;
  name?: string;
  mobile?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.mobile !== undefined) updates.mobile = input.mobile;
  await db.update(users).set(updates).where(eq(users.id, input.userId));
  // Keep customer rows in sync.
  if (input.name !== undefined || input.mobile !== undefined) {
    const customerRows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.userId, input.userId));
    for (const customer of customerRows) {
      await db
        .update(customers)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.mobile !== undefined ? { mobile: input.mobile ?? "" } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.id));
    }
  }
  await recordAudit({
    actorUserId: input.userId,
    action: "profile_updated",
    entityType: "user",
    entityId: input.userId,
    after: { name: input.name, mobileUpdated: input.mobile !== undefined },
  });
}

/**
 * Record a data-export or account-deletion request. Does not perform the
 * export/deletion itself — that requires operational review.
 */
export async function requestAccountAction(input: {
  userId: string;
  action: "export" | "deletion";
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new AccountError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();
  const now = new Date();
  await db
    .update(users)
    .set({
      ...(input.action === "export" ? { dataExportRequestedAt: now } : {}),
      ...(input.action === "deletion" ? { accountDeletionRequestedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));
  await recordAudit({
    actorUserId: input.userId,
    action: input.action === "export" ? "account_export_requested" : "account_deletion_requested",
    entityType: "user",
    entityId: input.userId,
  });
}
