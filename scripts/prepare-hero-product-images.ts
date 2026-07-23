/**
 * prepare-hero-product-images.ts
 *
 * Generates hero-specific transparent WebP assets from raw product catalogue images.
 * Uses a two-pass approach: first pass removes backgrounds and saves intermediate
 * PNGs with transparency, second pass trims and exports as hero-optimized WebP.
 *
 * Run: npm run products:hero-images
 */

import sharp from "sharp";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

// ── Configuration ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const HERO_OUTPUT_DIR = join(PROJECT_ROOT, "public", "images", "products", "hero");
const INTERMEDIATE_DIR = join(PROJECT_ROOT, ".hero-intermediate");
const AUDIT_FILE = join(HERO_OUTPUT_DIR, "hero-audit.json");

interface HeroImageSpec {
  model: string;
  sourceFile: string;
  intermediateFile: string;
  outputFile: string;
  mode: "dome" | "bullet" | "nvr";
  maxWidth: number;
  bgThreshold: number;
}

const heroImageSpecs: HeroImageSpec[] = [
  {
    model: "CP-UNC-DA41L3C-D-Q",
    sourceFile: join(PROJECT_ROOT, "public", "images", "products", "CP-UNC-DA41L3C-D-Q 1st.png"),
    intermediateFile: join(INTERMEDIATE_DIR, "dome-bg-removed.png"),
    outputFile: join(HERO_OUTPUT_DIR, "cp-unc-da41l3c-d-q.webp"),
    mode: "dome",
    maxWidth: 600,
    bgThreshold: 240,
  },
  {
    model: "CP-UNC-TA41L3C-Q",
    sourceFile: join(PROJECT_ROOT, "public", "images", "products", "CP-UNC-TA41L3C-Q bullet 1st.png"),
    intermediateFile: join(INTERMEDIATE_DIR, "bullet-bg-removed.png"),
    outputFile: join(HERO_OUTPUT_DIR, "cp-unc-ta41l3c-q.webp"),
    mode: "bullet",
    maxWidth: 450,
    bgThreshold: 240,
  },
  {
    model: "CP-UNR-108F1",
    sourceFile: join(PROJECT_ROOT, "public", "images", "products", "CP-UNR-108F1 1st.jpg"),
    intermediateFile: join(INTERMEDIATE_DIR, "nvr-bg-removed.png"),
    outputFile: join(HERO_OUTPUT_DIR, "cp-unr-108f1.webp"),
    mode: "nvr",
    maxWidth: 700,
    bgThreshold: 230, // More aggressive for NVR white background
  },
];

// ── Audit ──────────────────────────────────────────────────────────

interface AuditEntry {
  model: string;
  sourceDimensions: string;
  intermediateDimensions: string;
  outputDimensions: string;
  notes: string[];
  needsVisualReview: boolean;
}

// ── Pass 1: Background removal ────────────────────────────────────

async function removeBackground(spec: HeroImageSpec): Promise<string> {
  // Load source, ensure alpha channel, get raw pixel data
  const { data, info } = await sharp(spec.sourceFile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixelCount = width * height;
  const threshold = spec.bgThreshold;

  let removedCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (a === 0) continue; // Already transparent

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = (max - min) / (max || 1);

    // Near-white with low saturation → background
    if (max >= threshold && saturation < 0.12) {
      data[offset + 3] = 0; // Make transparent
      removedCount++;
    }
  }

  // Save as PNG with transparency
  await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 6 })
    .toFile(spec.intermediateFile);

  return `Removed ${removedCount} near-white pixels (threshold=${threshold})`;
}

// ── Pass 2: Trim, art-direct, and export ──────────────────────────

async function trimAndExport(spec: HeroImageSpec): Promise<{ width: number; height: number }> {
  let pipeline = sharp(spec.intermediateFile);

  // Trim exterior transparent margins
  const trimmedBuffer = await pipeline.trim({ threshold: 10 }).toBuffer();

  // For NVR: additional aggressive trim to remove any remaining thin transparent borders
  if (spec.mode === "nvr") {
    const secondTrimBuffer = await sharp(trimmedBuffer).trim({ threshold: 5 }).toBuffer();
    pipeline = sharp(secondTrimBuffer);
  } else {
    pipeline = sharp(trimmedBuffer);
  }

  // Get current dimensions after trimming
  const currentMeta = await pipeline.metadata();
  const currentWidth = currentMeta.width ?? 0;

  // Scale to maxWidth if needed (preserving aspect ratio — never force square)
  if (currentWidth > spec.maxWidth) {
    pipeline = pipeline.resize(spec.maxWidth, null, {
      withoutEnlargement: true,
      fit: "outside",
    });
  }

  // Export as transparent WebP
  await pipeline
    .webp({
      quality: 85,
      alphaQuality: 90,
      effort: 6,
    })
    .toFile(spec.outputFile);

  const outputMeta = await sharp(spec.outputFile).metadata();
  return { width: outputMeta.width ?? 0, height: outputMeta.height ?? 0 };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Hero Product Image Preparation");
  console.log("════════════════════════════════════════════════════════\n");

  // Create directories
  mkdirSync(HERO_OUTPUT_DIR, { recursive: true });
  mkdirSync(INTERMEDIATE_DIR, { recursive: true });

  const audits: AuditEntry[] = [];

  for (const spec of heroImageSpecs) {
    console.log(`\n── ${spec.model} (${spec.mode}) ──`);
    const audit: AuditEntry = {
      model: spec.model,
      sourceDimensions: "",
      intermediateDimensions: "",
      outputDimensions: "",
      notes: [],
      needsVisualReview: true,
    };

    if (!existsSync(spec.sourceFile)) {
      audit.notes.push(`❌ Source not found: ${spec.sourceFile}`);
      audits.push(audit);
      continue;
    }

    try {
      // Source dimensions
      const srcMeta = await sharp(spec.sourceFile).metadata();
      audit.sourceDimensions = `${srcMeta.width}×${srcMeta.height} ${srcMeta.format} ch=${srcMeta.channels}`;

      // Pass 1: Background removal
      console.log("  Pass 1: Background removal...");
      const bgNote = await removeBackground(spec);
      audit.notes.push(bgNote);

      // Intermediate dimensions
      const intMeta = await sharp(spec.intermediateFile).metadata();
      audit.intermediateDimensions = `${intMeta.width}×${intMeta.height}`;

      // Pass 2: Trim + export
      console.log("  Pass 2: Trim and export...");
      const outputDims = await trimAndExport(spec);
      audit.outputDimensions = `${outputDims.width}×${outputDims.height}`;
      audit.notes.push(`Output: ${outputDims.width}×${outputDims.height} WebP`);

      console.log(`  ✅ ${outputDims.width}×${outputDims.height}`);
    } catch (err) {
      audit.notes.push(`❌ Error: ${err}`);
      console.log(`  ❌ Failed: ${err}`);
    }

    // Specific review notes per product
    if (spec.mode === "nvr") {
      audit.notes.push("⚠️  Verify: no white rectangle visible around NVR body");
      audit.notes.push("⚠️  Verify: NVR preserves natural wide/thin aspect ratio");
      audit.notes.push("⚠️  Verify: red front detail and face details preserved");
    }
    if (spec.mode === "dome") {
      audit.notes.push("⚠️  Verify: complete dome housing preserved");
      audit.notes.push("⚠️  Verify: lens and CP PLUS logo intact");
      audit.notes.push("⚠️  Verify: no top or side crop");
    }
    if (spec.mode === "bullet") {
      audit.notes.push("⚠️  Verify: complete mounting arm preserved");
      audit.notes.push("⚠️  Verify: camera body fills most of asset bounds");
    }

    audits.push(audit);
  }

  // Write audit report
  writeFileSync(AUDIT_FILE, JSON.stringify(audits, null, 2));
  console.log(`\nAudit report: ${AUDIT_FILE}`);

  // Print dimensions for hero-media.ts update
  console.log("\n── hero-media.ts output dimensions ──");
  for (const a of audits) {
    if (a.outputDimensions) {
      const [w, h] = a.outputDimensions.split("×").map(Number);
      if (w && h) {
        console.log(`  ${a.model}: outputWidth=${w}, outputHeight=${h}`);
      }
    }
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  ⚠️  MANUAL VISUAL REVIEW REQUIRED");
  console.log("════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
