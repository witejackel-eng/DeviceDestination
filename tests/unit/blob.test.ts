import { describe, expect, it } from "vitest";
import {
  isAllowedImageType,
  isAllowedDocumentType,
  safeFilename,
  validateFileSignature,
} from "@/lib/blob";

describe("file validation", () => {
  it("accepts declared image content types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/avif")).toBe(true);
  });
  it("rejects non-image content types for image kind", () => {
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("image/gif")).toBe(false);
    expect(isAllowedImageType("application/x-msdownload")).toBe(false);
  });
  it("accepts PDF for document kind", () => {
    expect(isAllowedDocumentType("application/pdf")).toBe(true);
    expect(isAllowedDocumentType("application/msword")).toBe(false);
  });
  it("validates a PNG signature correctly", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const result = validateFileSignature({ contentType: "image/png", bytes: pngBytes, kind: "image" });
    expect(result.ok).toBe(true);
  });
  it("rejects a content type that does not match the signature", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const result = validateFileSignature({
      contentType: "image/jpeg",
      bytes: pngBytes,
      kind: "image",
    });
    expect(result.ok).toBe(false);
  });
  it("validates a JPEG signature correctly", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
    const result = validateFileSignature({
      contentType: "image/jpeg",
      bytes: jpegBytes,
      kind: "image",
    });
    expect(result.ok).toBe(true);
  });
  it("validates a PDF signature correctly", () => {
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf,
    ]);
    const result = validateFileSignature({
      contentType: "application/pdf",
      bytes: pdfBytes,
      kind: "document",
    });
    expect(result.ok).toBe(true);
  });
  it("rejects an executable disguised as PDF", () => {
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const result = validateFileSignature({
      contentType: "application/pdf",
      bytes: exeBytes,
      kind: "document",
    });
    expect(result.ok).toBe(false);
  });
  it("rejects too-small files", () => {
    const tiny = new Uint8Array([0, 0, 0]);
    const result = validateFileSignature({
      contentType: "image/png",
      bytes: tiny,
      kind: "image",
    });
    expect(result.ok).toBe(false);
  });
  it("safeFilename produces a slug with hash and extension", () => {
    const name = safeFilename({
      originalName: "CP UNC TA41L3C Q.png",
      model: "CP-UNC-TA41L3C-Q",
      extension: ".PNG",
    });
    expect(name).toMatch(/^cp-unc-ta41l3c-q-[a-f0-9]{8}\.png$/);
  });
});
