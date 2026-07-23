import { createHash } from "node:crypto";
import { isBlobConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Vercel Blob upload adapter. Only attempts uploads when
 * BLOB_READ_WRITE_TOKEN is set. Otherwise returns a safe `unconfigured`
 * result — the caller must surface this to the admin UI as "uploads disabled"
 * and must NOT store data URLs in PostgreSQL.
 */

export type BlobUploadResult =
  | { ok: true; url: string; pathname: string; contentType: string; size: number }
  | { ok: false; reason: "unconfigured" | "rejected" | "error"; message?: string };

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase());
}

export function isAllowedDocumentType(contentType: string): boolean {
  return ALLOWED_DOCUMENT_TYPES.includes(contentType.toLowerCase());
}

/**
 * Validate an uploaded file's content type against its byte signature. This
 * prevents naive content-type spoofing. Returns null if the type is allowed
 * and matches, otherwise returns the rejection reason.
 */
export function validateFileSignature(input: {
  contentType: string;
  bytes: Uint8Array;
  kind: "image" | "document";
}): { ok: true; canonicalType: string } | { ok: false; reason: string } {
  const { contentType, bytes, kind } = input;
  if (bytes.length < 12) {
    return { ok: false, reason: "File too small to validate" };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (kind === "image" && contentType.toLowerCase() === "image/jpeg") return { ok: true, canonicalType: "image/jpeg" };
    return { ok: false, reason: "JPEG signature did not match declared type" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    if (kind === "image" && contentType.toLowerCase() === "image/png") return { ok: true, canonicalType: "image/png" };
    return { ok: false, reason: "PNG signature did not match declared type" };
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    if (kind === "image" && contentType.toLowerCase() === "image/webp") return { ok: true, canonicalType: "image/webp" };
    return { ok: false, reason: "WebP signature did not match declared type" };
  }
  // AVIF: ftyp box with avif/avis brand
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") {
      if (kind === "image" && contentType.toLowerCase() === "image/avif") return { ok: true, canonicalType: "image/avif" };
    }
  }
  // PDF: %PDF-
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    if (kind === "document" && contentType.toLowerCase() === "application/pdf") return { ok: true, canonicalType: "application/pdf" };
    return { ok: false, reason: "PDF signature did not match declared type" };
  }
  return { ok: false, reason: `Unrecognized file signature for declared type ${contentType}` };
}

/**
 * Generate a deterministic safe filename. Strips path separators, collapses
 * whitespace, and prefixes with a short hash for collision avoidance.
 */
export function safeFilename(input: { originalName: string; model: string; extension: string }): string {
  const slug = input.model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hash = createHash("sha1").update(input.originalName).digest("hex").slice(0, 8);
  const ext = input.extension.toLowerCase().replace(/^\./, "");
  return `${slug}-${hash}.${ext}`;
}

/**
 * Upload a file to Vercel Blob. Dynamically imports `@vercel/blob` only when
 * configured — the dependency may not be installed in development.
 */
export async function uploadToBlob(input: {
  pathname: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<BlobUploadResult> {
  if (!isBlobConfigured()) {
    return { ok: false, reason: "unconfigured", message: "Vercel Blob is not configured." };
  }
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(input.pathname, Buffer.from(input.bytes), {
      access: "public",
      contentType: input.contentType,
      addRandomSuffix: true,
    });
    return {
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      contentType: input.contentType,
      size: input.bytes.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error({ event: "blob_upload_failed", error: message }, "Blob upload failed");
    return { ok: false, reason: "error", message };
  }
}
