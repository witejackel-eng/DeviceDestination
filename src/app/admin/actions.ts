"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { adminAuditLogs, inventory, orders, products, users } from "@/db/schema";
import { authorize, type Capability } from "@/lib/authz";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: boolean; message: string };

/**
 * Every admin mutation runs through this wrapper so that authorisation, the
 * database precondition and the audit trail cannot be forgotten at a call site.
 * Fields are read explicitly from FormData by each action — there is no
 * pass-through object, so an extra input in the browser cannot set a column.
 */
async function withCapability(
  capability: Capability,
  run: (actorId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  const auth = await authorize(capability);
  if (!auth.ok)
    return {
      ok: false,
      message: auth.status === 401 ? "Please sign in again." : "You do not have permission.",
    };
  if (!isDatabaseConfigured())
    return { ok: false, message: "The production database is not configured." };
  try {
    return await run(auth.user!.id);
  } catch (error) {
    logger.error({ event: "admin_action_failed", capability, error }, "Admin action failed");
    return { ok: false, message: "The change could not be saved. Please retry." };
  }
}

async function recordAudit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  await getDb()
    .insert(adminAuditLogs)
    .values({ actorUserId, action, entityType, entityId, before, after });
}

const optionalInt = z
  .union([z.string(), z.null()])
  .transform((value) => (value === null || value.trim() === "" ? null : Number(value)))
  .refine((value) => value === null || Number.isInteger(value), "Must be a whole number");

const productSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  model: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  shortDescription: z.string().trim().min(10).max(600),
  longDescription: z.string().trim().max(6000).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  stockStatus: z.enum(["in_stock", "limited", "lead_time", "quote_only"]),
  sellingPriceInclGstPaise: optionalInt,
  mrpInclGstPaise: optionalInt,
  gstRateBasisPoints: optionalInt,
  priceSourceStatus: z.enum(["verified", "needs-review", "request-price"]),
  warrantySummary: z.string().trim().max(400).optional().nullable(),
  officialSourceUrl: z.string().trim().url(),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(400).optional().nullable(),
  leadTime: z.string().trim().max(120).optional().nullable(),
});

export async function updateProductAction(formData: FormData): Promise<ActionResult> {
  return withCapability("catalogue.manage", async (actorId) => {
    const parsed = productSchema.safeParse({
      id: formData.get("id"),
      title: formData.get("title"),
      model: formData.get("model"),
      slug: formData.get("slug"),
      shortDescription: formData.get("shortDescription"),
      longDescription: formData.get("longDescription"),
      status: formData.get("status"),
      stockStatus: formData.get("stockStatus"),
      sellingPriceInclGstPaise: formData.get("sellingPriceInclGstPaise"),
      mrpInclGstPaise: formData.get("mrpInclGstPaise"),
      gstRateBasisPoints: formData.get("gstRateBasisPoints"),
      priceSourceStatus: formData.get("priceSourceStatus"),
      warrantySummary: formData.get("warrantySummary"),
      officialSourceUrl: formData.get("officialSourceUrl"),
      seoTitle: formData.get("seoTitle"),
      seoDescription: formData.get("seoDescription"),
      leadTime: formData.get("leadTime"),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, message: `${first.path.join(".")}: ${first.message}` };
    }
    const { id, ...fields } = parsed.data;

    // A price may only be published as "verified" alongside an actual amount —
    // this is the same rule the storefront enforces before allowing a purchase.
    if (fields.priceSourceStatus === "verified" && fields.sellingPriceInclGstPaise === null)
      return {
        ok: false,
        message: "A verified price needs a selling price. Use request-price instead.",
      };
    if (
      fields.mrpInclGstPaise !== null &&
      fields.sellingPriceInclGstPaise !== null &&
      fields.sellingPriceInclGstPaise > fields.mrpInclGstPaise
    )
      return { ok: false, message: "The selling price cannot exceed the recorded MRP." };

    const db = getDb();
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) return { ok: false, message: "That product no longer exists." };

    const priceChanged = before.sellingPriceInclGstPaise !== fields.sellingPriceInclGstPaise;
    const [after] = await db
      .update(products)
      .set({
        ...fields,
        longDescription: fields.longDescription || null,
        warrantySummary: fields.warrantySummary || null,
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
        leadTime: fields.leadTime || null,
        gstRateBasisPoints: fields.gstRateBasisPoints ?? before.gstRateBasisPoints,
        // Re-stamp the verification date whenever the published price moves, so
        // a stale-price guard cannot be bypassed by editing the amount alone.
        priceVerifiedAt:
          fields.priceSourceStatus === "verified" && priceChanged
            ? new Date()
            : before.priceVerifiedAt,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    await recordAudit(actorId, "product.update", "product", id, before, after);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    revalidatePath(`/products/${after.slug}`);
    revalidatePath("/products");
    return { ok: true, message: "Product saved." };
  });
}

const inventorySchema = z.object({
  productId: z.string().uuid(),
  quantityAvailable: optionalInt,
  leadTime: z.string().trim().max(120).optional().nullable(),
});

export async function updateInventoryAction(formData: FormData): Promise<ActionResult> {
  return withCapability("inventory.manage", async (actorId) => {
    const parsed = inventorySchema.safeParse({
      productId: formData.get("productId"),
      quantityAvailable: formData.get("quantityAvailable"),
      leadTime: formData.get("leadTime"),
    });
    if (!parsed.success) return { ok: false, message: "Enter a whole number of units." };
    const { productId, quantityAvailable, leadTime } = parsed.data;
    if (quantityAvailable !== null && quantityAvailable < 0)
      return { ok: false, message: "Stock cannot be negative." };

    const db = getDb();
    const [before] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, productId))
      .limit(1);

    if (before) {
      await db
        .update(inventory)
        .set({ quantityAvailable, leadTime: leadTime || null, updatedAt: new Date() })
        .where(eq(inventory.productId, productId));
    } else {
      await db.insert(inventory).values({ productId, quantityAvailable, leadTime: leadTime || null });
    }

    await recordAudit(actorId, "inventory.update", "inventory", productId, before ?? {}, {
      quantityAvailable,
      leadTime,
    });
    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Inventory updated." };
  });
}

const orderStatusSchema = z.object({
  orderNumber: z.string().trim().min(3).max(60),
  status: z.enum([
    "pending",
    "payment_pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
});

export async function updateOrderStatusAction(formData: FormData): Promise<ActionResult> {
  return withCapability("orders.manage", async (actorId) => {
    const parsed = orderStatusSchema.safeParse({
      orderNumber: formData.get("orderNumber"),
      status: formData.get("status"),
    });
    if (!parsed.success) return { ok: false, message: "Choose a valid fulfilment status." };

    const db = getDb();
    const [before] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, parsed.data.orderNumber))
      .limit(1);
    if (!before) return { ok: false, message: "That order no longer exists." };

    // Payment state is owned by the verified Razorpay webhook. Fulfilment staff
    // move an order forward; they never declare money received.
    if (parsed.data.status === "paid" && before.status !== "paid")
      return {
        ok: false,
        message: "Only a verified payment webhook can mark an order paid.",
      };

    const [after] = await db
      .update(orders)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(orders.orderNumber, parsed.data.orderNumber))
      .returning();

    await recordAudit(actorId, "order.status", "order", before.id, before, after);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${parsed.data.orderNumber}`);
    return { ok: true, message: `Order marked ${parsed.data.status.replaceAll("_", " ")}.` };
  });
}

const roleSchema = z.object({
  userId: z.string().min(1).max(120),
  role: z.enum(["customer", "operations", "catalogue_manager", "admin", "owner"]),
});

/** Role changes are owner-only, and an owner cannot demote themselves by accident. */
export async function updateStaffRoleAction(formData: FormData): Promise<ActionResult> {
  return withCapability("settings.manage", async (actorId) => {
    const parsed = roleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
    if (!parsed.success) return { ok: false, message: "Choose a valid role." };
    if (parsed.data.userId === actorId)
      return { ok: false, message: "Ask another owner to change your own role." };

    const db = getDb();
    const [before] = await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1);
    if (!before) return { ok: false, message: "That account no longer exists." };

    const [after] = await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.userId))
      .returning();

    await recordAudit(actorId, "user.role", "user", parsed.data.userId, before, after);
    revalidatePath("/admin/settings");
    return { ok: true, message: `Role updated to ${parsed.data.role.replaceAll("_", " ")}.` };
  });
}
