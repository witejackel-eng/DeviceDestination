"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  quoteItems,
  quoteStatusHistory,
  quotes,
} from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/audit";
import { getSettingInt } from "@/lib/settings";
import { extractIncludedGst } from "@/lib/products";

export type ActionResult = { ok: true; quoteId?: string } | { ok: false; reason: string; status?: number };

const itemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  model: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unitPriceInclGstPaise: z.number().int().min(0).max(9900000000),
  gstRateBasisPoints: z.number().int().min(0).max(10000).default(1800),
});

const createSchema = z.object({
  enquiryId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().email().max(200),
  customerMobile: z.string().trim().min(10).max(20),
  customerBusinessName: z.string().trim().max(200).nullable().optional(),
  customerGstin: z
    .string()
    .trim()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i)
    .nullable()
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  shippingPaise: z.number().int().min(0).max(9900000000).default(0),
  installationPaise: z.number().int().min(0).max(9900000000).default(0),
  items: z.array(itemSchema).min(1).max(50),
});

const statusTransitionSchema = z.object({
  quoteId: z.string().uuid(),
  toStatus: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]),
  note: z.string().trim().max(500).optional(),
});

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "expired", "rejected"],
  sent: ["accepted", "rejected", "expired", "converted"],
  accepted: ["converted", "expired"],
  rejected: [],
  expired: [],
  converted: [],
};

export async function listQuotesForAdmin(input: {
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted" | "all";
  page?: number;
  pageSize?: number;
}) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 25));
  const where = input.status && input.status !== "all" ? eq(quotes.status, input.status) : undefined;
  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerName: quotes.customerName,
      customerEmail: quotes.customerEmail,
      status: quotes.status,
      totalInclGstPaise: quotes.totalInclGstPaise,
      expiryAt: quotes.expiryAt,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(where)
    .orderBy(desc(quotes.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export async function getQuoteForAdmin(quoteId: string) {
  const admin = await resolveAdmin();
  if (!admin.ok) return null;
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  const history = await db
    .select()
    .from(quoteStatusHistory)
    .where(eq(quoteStatusHistory.quoteId, quoteId))
    .orderBy(desc(quoteStatusHistory.createdAt));
  return { quote, items, history };
}

export async function createQuoteAction(input: z.infer<typeof createSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const validityDays = await getSettingInt("quote_validity_days", 7);
  const quoteNumber = `QUO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  const subtotalInclGstPaise = parsed.data.items.reduce(
    (sum, item) => sum + item.unitPriceInclGstPaise * item.quantity,
    0,
  );
  const includedGstPaise = parsed.data.items.reduce(
    (sum, item) =>
      sum + extractIncludedGst(item.unitPriceInclGstPaise * item.quantity, item.gstRateBasisPoints),
    0,
  );
  const totalInclGstPaise =
    subtotalInclGstPaise + parsed.data.shippingPaise + parsed.data.installationPaise;
  const [created] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      enquiryId: parsed.data.enquiryId ?? null,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerMobile: parsed.data.customerMobile,
      customerBusinessName: parsed.data.customerBusinessName ?? null,
      customerGstin: parsed.data.customerGstin ?? null,
      expiryAt: new Date(Date.now() + validityDays * 86_400_000),
      status: "draft",
      subtotalInclGstPaise,
      includedGstPaise,
      shippingPaise: parsed.data.shippingPaise,
      installationPaise: parsed.data.installationPaise,
      totalInclGstPaise,
      notes: parsed.data.notes ?? null,
      createdBy: admin.context.userId,
    })
    .returning({ id: quotes.id });
  await db.insert(quoteItems).values(
    parsed.data.items.map((item) => ({
      quoteId: created.id,
      productId: item.productId ?? null,
      model: item.model,
      title: item.title,
      quantity: item.quantity,
      unitPriceInclGstPaise: item.unitPriceInclGstPaise,
      gstRateBasisPoints: item.gstRateBasisPoints,
    })),
  );
  await db.insert(quoteStatusHistory).values({
    quoteId: created.id,
    fromStatus: null,
    toStatus: "draft",
    actorUserId: admin.context.userId,
    note: "Quote created",
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "quote_created",
    entityType: "quote",
    entityId: created.id,
    after: { quoteNumber, totalInclGstPaise },
  });
  revalidatePath("/admin/quotes");
  return { ok: true, quoteId: created.id };
}

export async function transitionQuoteStatusAction(input: z.infer<typeof statusTransitionSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, parsed.data.quoteId)).limit(1);
  if (!existing) return { ok: false, reason: "Quote not found" };
  if (!QUOTE_TRANSITIONS[existing.status]?.includes(parsed.data.toStatus)) {
    return { ok: false, reason: `Quote cannot transition from ${existing.status} to ${parsed.data.toStatus}` };
  }
  await db
    .update(quotes)
    .set({
      status: parsed.data.toStatus,
      approvedBy: parsed.data.toStatus === "accepted" ? admin.context.userId : existing.approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, parsed.data.quoteId));
  await db.insert(quoteStatusHistory).values({
    quoteId: parsed.data.quoteId,
    fromStatus: existing.status,
    toStatus: parsed.data.toStatus,
    actorUserId: admin.context.userId,
    note: parsed.data.note ?? null,
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: `quote_${parsed.data.toStatus}`,
    entityType: "quote",
    entityId: parsed.data.quoteId,
    before: { status: existing.status },
    after: { status: parsed.data.toStatus, note: parsed.data.note },
  });
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${parsed.data.quoteId}`);
  return { ok: true };
}
