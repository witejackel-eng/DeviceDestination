"use server";

import { and, asc, desc, eq, ilike, inArray, ne, not, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  brands,
  categories,
  productCompatibility,
  productDocuments,
  productHighlights,
  productImages,
  productPriceHistory,
  products,
  productSpecs,
} from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit, redactSecrets } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getSettingInt } from "@/lib/settings";

export type ActionResult = { ok: true; id?: string } | { ok: false; reason: string; status?: number };

const productCreateSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Use lowercase, digits and hyphens only"),
  model: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(200),
  shortDescription: z.string().trim().min(8).max(300),
  longDescription: z.string().trim().max(5000).optional(),
  brandSlug: z.string().trim().min(1).max(120),
  categorySlug: z.string().trim().min(1).max(120),
  officialSourceUrl: z.string().url().max(500),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  warrantySummary: z.string().trim().max(400).optional(),
  leadTime: z.string().trim().max(120).optional(),
});

const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const priceUpdateSchema = z.object({
  productId: z.string().uuid(),
  sellingPriceInclGstPaise: z.number().int().min(0).max(9900000000).nullable(),
  mrpInclGstPaise: z.number().int().min(0).max(9900000000).nullable().optional(),
  compareAtPriceInclGstPaise: z.number().int().min(0).max(9900000000).nullable().optional(),
  compareAtLabel: z.string().trim().max(80).nullable().optional(),
  gstRateBasisPoints: z.number().int().min(0).max(10000),
  priceSourceStatus: z.enum(["verified", "request_price", "needs_review"]),
  publicSourceLabel: z.string().trim().max(200).nullable().optional(),
  changeReason: z.string().trim().max(300).optional(),
});

const statusUpdateSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

const stockStatusUpdateSchema = z.object({
  productId: z.string().uuid(),
  stockStatus: z.enum(["in_stock", "limited", "lead_time", "quote_only"]),
  leadTime: z.string().trim().max(120).nullable().optional(),
});

export async function listProductsForAdmin(input: {
  search?: string;
  status?: "draft" | "published" | "archived" | "all";
  stockStatus?: "in_stock" | "limited" | "lead_time" | "quote_only" | "all";
  priceSourceStatus?: "verified" | "request_price" | "needs_review" | "all";
  stalePriceOnly?: boolean;
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
  if (input.search && input.search.trim().length > 0) {
    const term = `%${input.search.trim()}%`;
    conditions.push(
      sql`(${products.model} ILIKE ${term} OR ${products.title} ILIKE ${term} OR ${products.slug} ILIKE ${term})`,
    );
  }
  if (input.status && input.status !== "all") {
    conditions.push(eq(products.status, input.status));
  }
  if (input.stockStatus && input.stockStatus !== "all") {
    conditions.push(eq(products.stockStatus, input.stockStatus));
  }
  if (input.priceSourceStatus && input.priceSourceStatus !== "all") {
    conditions.push(eq(products.priceSourceStatus, input.priceSourceStatus));
  }
  if (input.stalePriceOnly) {
    const maxAgeDays = await getSettingInt("price_max_age_days", 30);
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);
    conditions.push(sql`(${products.priceVerifiedAt} IS NULL OR ${products.priceVerifiedAt} < ${cutoff})`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      model: products.model,
      title: products.title,
      status: products.status,
      stockStatus: products.stockStatus,
      sellingPriceInclGstPaise: products.sellingPriceInclGstPaise,
      gstRateBasisPoints: products.gstRateBasisPoints,
      priceSourceStatus: products.priceSourceStatus,
      priceVerifiedAt: products.priceVerifiedAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(where)
    .orderBy(desc(products.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(products).where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export async function getProductForAdmin(productId: string) {
  const admin = await resolveAdmin();
  if (!admin.ok) return null;
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return null;
  const [brand] = await db.select().from(brands).where(eq(brands.id, product.brandId)).limit(1);
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, product.categoryId))
    .limit(1);
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
  const documents = await db
    .select()
    .from(productDocuments)
    .where(eq(productDocuments.productId, productId))
    .orderBy(desc(productDocuments.createdAt));
  const specs = await db
    .select()
    .from(productSpecs)
    .where(eq(productSpecs.productId, productId))
    .orderBy(asc(productSpecs.groupName), asc(productSpecs.position));
  const highlights = await db
    .select()
    .from(productHighlights)
    .where(eq(productHighlights.productId, productId))
    .orderBy(asc(productHighlights.position));
  const compatibility = await db
    .select()
    .from(productCompatibility)
    .where(eq(productCompatibility.productId, productId));
  const priceHistory = await db
    .select()
    .from(productPriceHistory)
    .where(eq(productPriceHistory.productId, productId))
    .orderBy(desc(productPriceHistory.createdAt))
    .limit(20);
  return { product, brand, category, images, documents, specs, highlights, compatibility, priceHistory };
}

export async function createProductAction(input: z.infer<typeof productCreateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [brand] = await db.select().from(brands).where(eq(brands.slug, parsed.data.brandSlug)).limit(1);
  if (!brand) return { ok: false, reason: "Brand not found" };
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, parsed.data.categorySlug))
    .limit(1);
  if (!category) return { ok: false, reason: "Category not found" };
  const [created] = await db
    .insert(products)
    .values({
      slug: parsed.data.slug,
      model: parsed.data.model,
      title: parsed.data.title,
      shortDescription: parsed.data.shortDescription,
      longDescription: parsed.data.longDescription ?? null,
      brandId: brand.id,
      categoryId: category.id,
      status: "draft",
      stockStatus: "quote_only",
      officialSourceUrl: parsed.data.officialSourceUrl,
      seoTitle: parsed.data.seoTitle ?? null,
      seoDescription: parsed.data.seoDescription ?? null,
      warrantySummary: parsed.data.warrantySummary ?? null,
      leadTime: parsed.data.leadTime ?? null,
      verifiedAt: new Date(),
    })
    .returning({ id: products.id });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "product_created",
    entityType: "product",
    entityId: created.id,
    after: redactSecrets(parsed.data as unknown as Record<string, unknown>),
  });
  revalidatePath("/admin/products");
  return { ok: true, id: created.id };
}

export async function updateProductAction(input: z.infer<typeof productUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(products).where(eq(products.id, parsed.data.id)).limit(1);
  if (!existing) return { ok: false, reason: "Product not found" };

  // Check whether the model can be changed.
  if (parsed.data.model && parsed.data.model !== existing.model) {
    const [refs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productCompatibility)
      .where(eq(productCompatibility.productId, existing.id));
    const referenced = Number(refs?.count ?? 0) > 0;
    if (referenced) {
      return { ok: false, reason: "Model cannot be changed — product is referenced by compatibility data" };
    }
  }

  // Slug change: preserve old slug in legacySlugs.
  let legacySlugs = existing.legacySlugs ?? [];
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    if (!legacySlugs.includes(existing.slug)) {
      legacySlugs = [...legacySlugs, existing.slug];
    }
    const conflict = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.slug, parsed.data.slug), ne(products.id, existing.id)))
      .limit(1);
    if (conflict[0]) return { ok: false, reason: "Slug is already in use" };
  }

  const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
    if (key === "id" || key === "brandSlug" || key === "categorySlug") continue;
    const value = parsed.data[key];
    if (value !== undefined) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }
  if (parsed.data.brandSlug) {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, parsed.data.brandSlug)).limit(1);
    if (brand) updates.brandId = brand.id;
  }
  if (parsed.data.categorySlug) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, parsed.data.categorySlug))
      .limit(1);
    if (category) updates.categoryId = category.id;
  }
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    updates.legacySlugs = legacySlugs;
  }
  await db.update(products).set(updates).where(eq(products.id, existing.id));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "product_updated",
    entityType: "product",
    entityId: existing.id,
    before: redactSecrets(existing as unknown as Record<string, unknown>),
    after: redactSecrets(updates as unknown as Record<string, unknown>),
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${existing.id}`);
  revalidatePath(`/products/${parsed.data.slug ?? existing.slug}`);
  return { ok: true, id: existing.id };
}

export async function updateProductPriceAction(input: z.infer<typeof priceUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = priceUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1);
  if (!existing) return { ok: false, reason: "Product not found" };
  if (
    parsed.data.sellingPriceInclGstPaise !== null &&
    parsed.data.sellingPriceInclGstPaise !== undefined &&
    parsed.data.mrpInclGstPaise &&
    parsed.data.sellingPriceInclGstPaise > parsed.data.mrpInclGstPaise
  ) {
    return { ok: false, reason: "Selling price cannot exceed MRP" };
  }
  const previousPrice = existing.sellingPriceInclGstPaise;
  const previousSource = existing.priceSourceStatus;
  const newPrice = parsed.data.sellingPriceInclGstPaise ?? null;
  const newSource = parsed.data.priceSourceStatus;
  await db
    .update(products)
    .set({
      sellingPriceInclGstPaise: newPrice,
      mrpInclGstPaise: parsed.data.mrpInclGstPaise ?? existing.mrpInclGstPaise,
      compareAtPriceInclGstPaise: parsed.data.compareAtPriceInclGstPaise ?? existing.compareAtPriceInclGstPaise,
      compareAtLabel: parsed.data.compareAtLabel ?? existing.compareAtLabel,
      gstRateBasisPoints: parsed.data.gstRateBasisPoints,
      priceSourceStatus: newSource,
      priceVerifiedAt: newSource === "verified" ? new Date() : existing.priceVerifiedAt,
      publicSourceLabel: parsed.data.publicSourceLabel ?? existing.publicSourceLabel,
      updatedAt: new Date(),
    })
    .where(eq(products.id, existing.id));
  await db.insert(productPriceHistory).values({
    productId: existing.id,
    previousPricePaise: previousPrice,
    newPricePaise: newPrice,
    gstRateBasisPoints: parsed.data.gstRateBasisPoints,
    previousSourceStatus: previousSource,
    newSourceStatus: newSource,
    verifiedAt: newSource === "verified" ? new Date() : null,
    changedBy: admin.context.userId,
    changeReason: parsed.data.changeReason ?? null,
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "product_price_updated",
    entityType: "product",
    entityId: existing.id,
    before: { price: previousPrice, source: previousSource },
    after: { price: newPrice, source: newSource, reason: parsed.data.changeReason },
  });
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${existing.id}`);
  return { ok: true, id: existing.id };
}

export async function updateProductStatusAction(input: z.infer<typeof statusUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = statusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1);
  if (!existing) return { ok: false, reason: "Product not found" };
  await db
    .update(products)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(products.id, existing.id));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: `product_status_${parsed.data.status}`,
    entityType: "product",
    entityId: existing.id,
    before: { status: existing.status },
    after: { status: parsed.data.status },
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${existing.id}`);
  return { ok: true, id: existing.id };
}

export async function updateStockStatusAction(input: z.infer<typeof stockStatusUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = stockStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1);
  if (!existing) return { ok: false, reason: "Product not found" };
  await db
    .update(products)
    .set({
      stockStatus: parsed.data.stockStatus,
      leadTime: parsed.data.leadTime ?? existing.leadTime,
      updatedAt: new Date(),
    })
    .where(eq(products.id, existing.id));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "product_stock_status_updated",
    entityType: "product",
    entityId: existing.id,
    before: { stockStatus: existing.stockStatus, leadTime: existing.leadTime },
    after: { stockStatus: parsed.data.stockStatus, leadTime: parsed.data.leadTime },
  });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${existing.id}`);
  return { ok: true, id: existing.id };
}
