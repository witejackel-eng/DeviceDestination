"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { shippingPincodeRules, shippingZones } from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/audit";
import { setSetting, SETTING_VALIDATORS, SETTING_DEFAULTS } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; reason: string; status?: number };

const updateSettingSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.string().trim().max(2000),
  description: z.string().trim().max(500).optional(),
});

const zoneCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  deliveryFeePaise: z.number().int().min(0).max(9900000000).default(0),
  freeShippingThresholdPaise: z.number().int().min(0).max(9900000000).nullable().optional(),
  estimatedDaysMin: z.number().int().min(0).max(60).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).max(60).nullable().optional(),
  codAvailable: z.boolean().default(false),
  remoteAreaSurchargePaise: z.number().int().min(0).max(9900000000).default(0),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
});

const zoneUpdateSchema = zoneCreateSchema.partial().extend({
  zoneId: z.string().uuid(),
});

const ruleCreateSchema = z.object({
  zoneId: z.string().uuid(),
  pincodePrefix: z
    .string()
    .trim()
    .min(1)
    .max(6)
    .regex(/^\d+$/, "Pincode prefix must be digits only"),
  serviceability: z.enum(["serviceable", "manual_confirmation", "unserviceable"]),
  overrideFeePaise: z.number().int().min(0).max(9900000000).nullable().optional(),
  overrideEstimatedDaysMin: z.number().int().min(0).max(60).nullable().optional(),
  overrideEstimatedDaysMax: z.number().int().min(0).max(60).nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const ruleUpdateSchema = ruleCreateSchema.partial().extend({
  ruleId: z.string().uuid(),
});

export async function listShippingZonesForAdmin() {
  const admin = await resolveAdmin();
  if (!admin.ok) return [];
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  return db.select().from(shippingZones).orderBy(shippingZones.slug);
}

export async function listShippingRulesForAdmin(zoneId?: string) {
  const admin = await resolveAdmin();
  if (!admin.ok) return [];
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const where = zoneId ? eq(shippingPincodeRules.zoneId, zoneId) : undefined;
  return db
    .select({
      rule: shippingPincodeRules,
      zoneName: shippingZones.name,
      zoneSlug: shippingZones.slug,
    })
    .from(shippingPincodeRules)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingPincodeRules.zoneId))
    .where(where)
    .orderBy(shippingPincodeRules.pincodePrefix);
}

export async function updateSettingAction(input: z.infer<typeof updateSettingSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = updateSettingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  if (!SETTING_DEFAULTS.hasOwnProperty(parsed.data.key)) {
    return { ok: false, reason: "Unknown setting key" };
  }
  const validator = SETTING_VALIDATORS[parsed.data.key];
  if (validator && !validator(parsed.data.value)) {
    return { ok: false, reason: `Invalid value for setting ${parsed.data.key}` };
  }
  try {
    await setSetting({
      key: parsed.data.key,
      value: parsed.data.value,
      updatedBy: admin.context.userId,
      description: parsed.data.description,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return { ok: false, reason: message };
  }
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "setting_updated",
    entityType: "setting",
    entityId: parsed.data.key,
    after: { value: parsed.data.value },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createShippingZoneAction(input: z.infer<typeof zoneCreateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = zoneCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  try {
    const [created] = await db
      .insert(shippingZones)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        isActive: parsed.data.isActive,
        deliveryFeePaise: parsed.data.deliveryFeePaise,
        freeShippingThresholdPaise: parsed.data.freeShippingThresholdPaise ?? null,
        estimatedDaysMin: parsed.data.estimatedDaysMin ?? null,
        estimatedDaysMax: parsed.data.estimatedDaysMax ?? null,
        codAvailable: parsed.data.codAvailable,
        remoteAreaSurchargePaise: parsed.data.remoteAreaSurchargePaise,
        notes: parsed.data.notes ?? null,
      })
      .returning({ id: shippingZones.id });
    await recordAudit({
      actorUserId: admin.context.userId,
      actorEmail: admin.context.email,
      action: "shipping_zone_created",
      entityType: "shipping_zone",
      entityId: created.id,
      after: parsed.data,
    });
    revalidatePath("/admin/settings/shipping");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return { ok: false, reason: message };
  }
}

export async function updateShippingZoneAction(input: z.infer<typeof zoneUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = zoneUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const updates: Partial<typeof shippingZones.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
    if (key === "zoneId") continue;
    const value = parsed.data[key];
    if (value !== undefined) {
      // @ts-expect-error dynamic assignment is schema-safe
      updates[key] = value;
    }
  }
  await db.update(shippingZones).set(updates).where(eq(shippingZones.id, parsed.data.zoneId));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "shipping_zone_updated",
    entityType: "shipping_zone",
    entityId: parsed.data.zoneId,
    after: updates,
  });
  revalidatePath("/admin/settings/shipping");
  return { ok: true };
}

export async function createShippingRuleAction(input: z.infer<typeof ruleCreateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = ruleCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [created] = await db
    .insert(shippingPincodeRules)
    .values({
      zoneId: parsed.data.zoneId,
      pincodePrefix: parsed.data.pincodePrefix,
      serviceability: parsed.data.serviceability,
      overrideFeePaise: parsed.data.overrideFeePaise ?? null,
      overrideEstimatedDaysMin: parsed.data.overrideEstimatedDaysMin ?? null,
      overrideEstimatedDaysMax: parsed.data.overrideEstimatedDaysMax ?? null,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: shippingPincodeRules.id });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "shipping_rule_created",
    entityType: "shipping_rule",
    entityId: created.id,
    after: parsed.data,
  });
  revalidatePath("/admin/settings/shipping");
  return { ok: true };
}

export async function updateShippingRuleAction(input: z.infer<typeof ruleUpdateSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = ruleUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const updates: Partial<typeof shippingPincodeRules.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
    if (key === "ruleId") continue;
    const value = parsed.data[key];
    if (value !== undefined) {
      // @ts-expect-error dynamic assignment is schema-safe
      updates[key] = value;
    }
  }
  await db
    .update(shippingPincodeRules)
    .set(updates)
    .where(eq(shippingPincodeRules.id, parsed.data.ruleId));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "shipping_rule_updated",
    entityType: "shipping_rule",
    entityId: parsed.data.ruleId,
    after: updates,
  });
  revalidatePath("/admin/settings/shipping");
  return { ok: true };
}

export async function deleteShippingRuleAction(input: { ruleId: string }): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  await db.delete(shippingPincodeRules).where(eq(shippingPincodeRules.id, input.ruleId));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "shipping_rule_deleted",
    entityType: "shipping_rule",
    entityId: input.ruleId,
  });
  revalidatePath("/admin/settings/shipping");
  return { ok: true };
}
