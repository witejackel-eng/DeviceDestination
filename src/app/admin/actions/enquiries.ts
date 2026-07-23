"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { enquiries } from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";

export type ActionResult = { ok: true } | { ok: false; reason: string; status?: number };

const updateSchema = z.object({
  enquiryId: z.string().uuid(),
  status: z.enum(["new", "contacted", "qualified", "quoted", "won", "lost", "closed"]).optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
  linkedQuoteId: z.string().uuid().nullable().optional(),
  linkedOrderId: z.string().uuid().nullable().optional(),
});

export async function listEnquiriesForAdmin(input: {
  status?: "new" | "contacted" | "qualified" | "quoted" | "won" | "lost" | "closed" | "all";
  assignedTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 25));
  const conditions = [];
  if (input.status && input.status !== "all") {
    conditions.push(eq(enquiries.status, input.status));
  }
  if (input.assignedTo) {
    conditions.push(eq(enquiries.assignedTo, input.assignedTo));
  }
  if (input.search) {
    const term = `%${input.search.trim()}%`;
    conditions.push(
      or(
        ilike(enquiries.referenceNumber, term),
        ilike(enquiries.name, term),
        ilike(enquiries.email, term),
        ilike(enquiries.mobile, term),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: enquiries.id,
      referenceNumber: enquiries.referenceNumber,
      type: enquiries.type,
      name: enquiries.name,
      email: enquiries.email,
      mobile: enquiries.mobile,
      status: enquiries.status,
      assignedTo: enquiries.assignedTo,
      followUpAt: enquiries.followUpAt,
      lastContactedAt: enquiries.lastContactedAt,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(where)
    .orderBy(desc(enquiries.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(enquiries).where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export async function getEnquiryForAdmin(enquiryId: string) {
  const admin = await resolveAdmin();
  if (!admin.ok) return null;
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
  return enquiry ?? null;
}

export async function updateEnquiryAction(input: z.infer<typeof updateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(enquiries).where(eq(enquiries.id, parsed.data.enquiryId)).limit(1);
  if (!existing) return { ok: false, reason: "Enquiry not found" };
  const updates: Partial<typeof enquiries.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.assignedTo !== undefined) updates.assignedTo = parsed.data.assignedTo;
  if (parsed.data.internalNotes !== undefined) updates.internalNotes = parsed.data.internalNotes;
  if (parsed.data.followUpAt !== undefined)
    updates.followUpAt = parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null;
  if (parsed.data.lastContactedAt !== undefined)
    updates.lastContactedAt = parsed.data.lastContactedAt ? new Date(parsed.data.lastContactedAt) : null;
  if (parsed.data.linkedQuoteId !== undefined) updates.linkedQuoteId = parsed.data.linkedQuoteId;
  if (parsed.data.linkedOrderId !== undefined) updates.linkedOrderId = parsed.data.linkedOrderId;
  await db.update(enquiries).set(updates).where(eq(enquiries.id, parsed.data.enquiryId));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "enquiry_updated",
    entityType: "enquiry",
    entityId: parsed.data.enquiryId,
    before: {
      status: existing.status,
      assignedTo: existing.assignedTo,
      followUpAt: existing.followUpAt,
    },
    after: updates,
  });
  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${parsed.data.enquiryId}`);
  return { ok: true };
}

export async function retryEnquiryNotificationAction(input: { enquiryId: string }): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  await enqueueJob({ type: "send-enquiry-email", payload: { enquiryId: input.enquiryId } });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "enquiry_notification_retry",
    entityType: "enquiry",
    entityId: input.enquiryId,
  });
  revalidatePath(`/admin/enquiries/${input.enquiryId}`);
  return { ok: true };
}
