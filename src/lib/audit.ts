import { getDb, isDatabaseConfigured } from "@/db/client";
import { adminAuditLogs } from "@/db/schema";
import { logger } from "@/lib/logger";

export type AuditInput = {
  actorUserId: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * Persist a single audit log entry. Sensitive fields (passwords, tokens,
 * secrets) must be redacted by the caller before being placed into `before`,
 * `after`, or `metadata`. This helper never throws — audit failures are logged
 * but never break the calling mutation.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  if (!isDatabaseConfigured()) {
    logger.warn(
      {
        event: "audit_skipped_no_db",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      },
      "Audit log skipped — database not configured",
    );
    return;
  }
  try {
    await getDb().insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (error) {
    logger.error(
      {
        event: "audit_persist_failed",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : "unknown",
      },
      "Audit log persistence failed",
    );
  }
}

/**
 * Strip secrets from a record before persisting it as audit `before`/`after`.
 * Removes keys matching common secret patterns and returns a shallow clone.
 */
export function redactSecrets<T extends Record<string, unknown>>(value: T): T {
  const sensitive = /^(password|secret|token|apiKey|api_key|access_token|refresh_token|webhook_secret|key_secret|razorpay_key_secret|whatsapp_access_token)$/i;
  const clone: Record<string, unknown> = { ...value };
  for (const key of Object.keys(clone)) {
    if (sensitive.test(key)) clone[key] = "[redacted]";
  }
  return clone as T;
}
