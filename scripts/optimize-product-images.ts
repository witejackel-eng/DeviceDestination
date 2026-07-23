/**
 * Product Image Normalisation Script
 *
 * Reads product-image paths from catalogue data (catalog.ts →
 * seed-products-source.ts + catalogue-expansion.ts), preserves
 * product-to-model associations, records original dimensions, trims
 * transparent/uniform margins, removes white backgrounds where safe,
 * preserves aspect ratio, places products on a consistent 1600 × 1600
 * canvas, exports as high-quality WebP (with alpha support for
 * transparent images), generates deterministic filenames, and produces
 * a detailed JSON audit report.
 *
 * Target occupancy:
 *   Cameras (dome/bullet) → 68–74%
 *   NVRs                  → 78–86% horizontal
 *   PoE switches          → 76–84% horizontal
 *   Biometrics            → 66–74%
 *
 * DO NOT crop mounts/antennas, distort proportions, destructively
 * remove backgrounds, damage logos, or upscale tiny assets into blur.
 *
 * Usage: npm run products:images
 */
import sharp from "sharp";
import { catalogue } from "../src/data/catalog";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ─── Constants ─────────────────────────────────────────────────── */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const SOURCE_DIR = path.join(PUBLIC_DIR, "images", "products");
const OUTPUT_DIR = path.join(PUBLIC_DIR, "images", "products", "optimized");
const REPORT_DIR = path.join(PROJECT_ROOT, "reports");
const CANVAS = 1600;
const MAX_UPSCALE = 2.5;
const LOW_RES_THRESHOLD = 400;
const VERY_LOW_RES_THRESHOLD = 250;

/* ─── Occupancy targets per category ────────────────────────────── */

interface OccupancyRange {
  min: number;
  target: number;
  max: number;
  mode: "max-dimension" | "horizontal";
}

const OCCUPANCY: Record<string, OccupancyRange> = {
  /* Cameras: dome & bullet → unified 68–74% */
  "dome-cameras":         { min: 0.68, target: 0.71, max: 0.74, mode: "max-dimension" },
  "color-dome-cameras":   { min: 0.68, target: 0.71, max: 0.74, mode: "max-dimension" },
  "bullet-cameras":       { min: 0.68, target: 0.71, max: 0.74, mode: "max-dimension" },
  "color-bullet-cameras": { min: 0.68, target: 0.71, max: 0.74, mode: "max-dimension" },
  /* NVRs → 78–86% horizontal */
  "nvr-systems":          { min: 0.78, target: 0.82, max: 0.86, mode: "horizontal" },
  /* PoE switches → 76–84% horizontal */
  "poe-switches":         { min: 0.76, target: 0.80, max: 0.84, mode: "horizontal" },
  /* Biometrics → 66–74% */
  "biometric-devices":    { min: 0.66, target: 0.71, max: 0.74, mode: "max-dimension" },
};

const DEFAULT_OCCUPANCY: OccupancyRange = {
  min: 0.68, target: 0.71, max: 0.74, mode: "max-dimension",
};

/* Categories where the product body is typically WHITE/light-coloured
   → white background removal is NOT safe (would erase the product). */
const WHITE_BODY_CATEGORIES = new Set([
  "dome-cameras",
  "color-dome-cameras",
]);

/* ─── Types ──────────────────────────────────────────────────────── */

interface AuditEntry {
  sourcePath: string;
  outputPath: string;
  format: string;
  productModels: string[];
  productSlugs: string[];
  productCategory: string;
  categorySlug: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  originalHasAlpha: boolean;
  trimmedWidth: number | null;
  trimmedHeight: number | null;
  productWidthOnCanvas: number;
  productHeightOnCanvas: number;
  outputWidth: number;
  outputHeight: number;
  outputSizeBytes: number;
  occupancyPercent: number;
  occupancyTargetPercent: number;
  occupancyMode: string;
  upscaleFactor: number;
  hasTransparency: boolean;
  backgroundRemoved: boolean;
  innerWhiteRectsRemoved: boolean;
  status: "success" | "needs-review" | "error";
  flags: string[];
  notes: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function occupancyFor(slug: string): OccupancyRange {
  return OCCUPANCY[slug] ?? DEFAULT_OCCUPANCY;
}

function normalizeModelForFilename(model: string): string {
  return model
    .trim()
    .toUpperCase()
    .replace(/\+/g, "PLUS")
    .replace(/[\s_]+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Detect whether a PNG image has *meaningful* transparency
 * (i.e. some alpha values < 250, not just a fully-opaque channel).
 */
async function hasMeaningfulAlpha(absPath: string): Promise<boolean> {
  const meta = await sharp(absPath).metadata();
  if (!(meta.hasAlpha)) return false;
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w === 0 || h === 0) return false;

  const buf = await sharp(absPath).ensureAlpha().raw().toBuffer();
  const ch = meta.channels ?? 4;
  /* Sample up to 20 000 pixels across the image */
  const total = w * h;
  const step = Math.max(1, Math.floor(total / 20_000));
  for (let i = 0; i < total; i += step) {
    if (buf[i * ch + (ch - 1)] < 250) return true;
  }
  return false;
}

/**
 * Flood-fill from image borders to remove near-white background.
 * Only pixels reachable from a border pixel through a chain of
 * near-white pixels are made transparent.  This preserves product
 * features, logos, and text in the interior even if they are light.
 *
 * @param raw     RGBA interleaved buffer
 * @param w       width
 * @param h       height
 * @param ch      channels (must be 4)
 * @param thresh  per-channel threshold (pixels with R,G,B ≥ thresh are "near-white")
 */
function floodFillWhiteFromBorders(
  raw: Buffer,
  w: number,
  h: number,
  ch: number,
  thresh: number = 240,
): { buffer: Buffer; pixelsRemoved: number } {
  const out = Buffer.from(raw);
  const visited = new Uint8Array(w * h);
  let removed = 0;

  function isNearWhite(idx: number): boolean {
    const off = idx * ch;
    return raw[off] >= thresh && raw[off + 1] >= thresh && raw[off + 2] >= thresh;
  }

  /* Seed: all border pixels that are near-white */
  const queue: number[] = [];
  for (let x = 0; x < w; x++) {
    const t = x;
    const b = (h - 1) * w + x;
    if (isNearWhite(t) && !visited[t]) { visited[t] = 1; queue.push(t); }
    if (isNearWhite(b) && !visited[b]) { visited[b] = 1; queue.push(b); }
  }
  for (let y = 1; y < h - 1; y++) {
    const l = y * w;
    const r = y * w + (w - 1);
    if (isNearWhite(l) && !visited[l]) { visited[l] = 1; queue.push(l); }
    if (isNearWhite(r) && !visited[r]) { visited[r] = 1; queue.push(r); }
  }

  /* BFS */
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    out[idx * ch + 3] = 0; // alpha = 0 (transparent)
    removed++;

    const px = idx % w;
    const py = Math.floor(idx / w);
    const neighbours: number[] = [];
    if (py > 0)     neighbours.push(idx - w);
    if (py < h - 1) neighbours.push(idx + w);
    if (px > 0)     neighbours.push(idx - 1);
    if (px < w - 1) neighbours.push(idx + 1);

    for (const n of neighbours) {
      if (!visited[n] && isNearWhite(n)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  return { buffer: out, pixelsRemoved: removed };
}

/**
 * After border flood-fill, find enclosed near-white interior rectangles
 * and remove them if they are small and likely decorative overlays.
 *
 * An "enclosed" region is one where every border pixel of that region
 * touches either a transparent pixel or another near-white pixel (i.e.
 * the region is not adjacent to any opaque product pixel).
 */
function removeEnclosedWhiteRects(
  raw: Buffer,
  w: number,
  h: number,
  ch: number,
  thresh: number = 245,
  maxAreaRatio: number = 0.08,
): { buffer: Buffer; rectsRemoved: number } {
  const out = Buffer.from(raw);
  const visited = new Uint8Array(w * h);
  let rectsRemoved = 0;

  /* Count total opaque (non-transparent) pixels for area ratio */
  let opaqueTotal = 0;
  for (let i = 0; i < w * h; i++) {
    if (raw[i * ch + 3] > 10) opaqueTotal++;
  }
  if (opaqueTotal === 0) return { buffer: out, rectsRemoved: 0 };

  const maxRegionSize = Math.round(opaqueTotal * maxAreaRatio);

  function isNearWhite(idx: number): boolean {
    const off = idx * ch;
    /* Only consider "near-white" if the pixel is currently opaque (alpha > 0)
       AND the RGB values are very close to white */
    return raw[off + 3] > 200
      && raw[off] >= thresh
      && raw[off + 1] >= thresh
      && raw[off + 2] >= thresh;
  }

  function isTransparent(idx: number): boolean {
    return out[idx * ch + 3] < 10;
  }

  /* Scan for unvisited near-white interior pixels */
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || !isNearWhite(start)) continue;

    /* BFS to find connected component */
    const component: number[] = [];
    const localVisited = new Uint8Array(w * h);
    const q: number[] = [start];
    localVisited[start] = 1;
    let touchesOpaqueProduct = false;
    let head = 0;

    while (head < q.length) {
      const idx = q[head++];
      component.push(idx);
      visited[idx] = 1;

      const px = idx % w;
      const py = Math.floor(idx / w);
      const neighbours: number[] = [];
      if (py > 0)     neighbours.push(idx - w);
      if (py < h - 1) neighbours.push(idx + w);
      if (px > 0)     neighbours.push(idx - 1);
      if (px < w - 1) neighbours.push(idx + 1);

      for (const n of neighbours) {
        if (localVisited[n]) continue;
        localVisited[n] = 1;

        if (isNearWhite(n)) {
          q.push(n);
        } else if (!isTransparent(n)) {
          /* This white region touches a non-white, non-transparent pixel
             → it is part of the product (e.g. white text on dark body).
             Do NOT remove. */
          touchesOpaqueProduct = true;
        }
      }
    }

    /* Only remove if:
       1. Does NOT touch any opaque product pixel
       2. Small enough relative to total product area */
    if (!touchesOpaqueProduct && component.length <= maxRegionSize) {
      for (const idx of component) {
        out[idx * ch + 3] = 0;
      }
      rectsRemoved++;
    }
  }

  return { buffer: out, rectsRemoved };
}

/* ─── Main image processing ──────────────────────────────────────── */

async function processImage(
  sourceRelPath: string,
  products: Array<{ model: string; slug: string; category: string; categorySlug: string }>,
  sequenceNumber: number,
): Promise<AuditEntry> {
  const sourceAbs = path.join(PUBLIC_DIR, sourceRelPath);
  const primary = products[0];
  const catSlug = primary.categorySlug;
  const occ = occupancyFor(catSlug);

  const flags: string[] = [];
  const notes: string[] = [];
  const modelSlug = normalizeModelForFilename(primary.model);
  const seq = String(sequenceNumber).padStart(2, "0");

  /* ── Check source exists ──────────────────────────────── */
  if (!fs.existsSync(sourceAbs)) {
    return {
      sourcePath: sourceRelPath,
      outputPath: "",
      format: "",
      productModels: products.map(p => p.model),
      productSlugs: products.map(p => p.slug),
      productCategory: primary.category,
      categorySlug: catSlug,
      originalWidth: 0, originalHeight: 0,
      originalSizeBytes: 0,
      originalFormat: "", originalHasAlpha: false,
      trimmedWidth: null, trimmedHeight: null,
      productWidthOnCanvas: 0, productHeightOnCanvas: 0,
      outputWidth: 0, outputHeight: 0,
      outputSizeBytes: 0,
      occupancyPercent: 0,
      occupancyTargetPercent: Math.round(occ.target * 100),
      occupancyMode: occ.mode,
      upscaleFactor: 0,
      hasTransparency: false,
      backgroundRemoved: false,
      innerWhiteRectsRemoved: false,
      status: "error",
      flags: ["source-not-found"],
      notes: "Source file not found on disk",
    };
  }

  try {
    /* ── Read metadata ───────────────────────────────────── */
    const meta = await sharp(sourceAbs).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;
    const origSize = fs.statSync(sourceAbs).size;
    const srcFormat = meta.format ?? "unknown";
    const srcHasAlpha = meta.hasAlpha ?? false;
    const srcChannels = meta.channels ?? (srcHasAlpha ? 4 : 3);

    if (origW === 0 || origH === 0) {
      return {
        ...emptyEntry(sourceRelPath, products, catSlug, occ),
        originalSizeBytes: origSize,
        originalFormat: srcFormat,
        status: "error",
        flags: ["zero-dimensions"],
        notes: "Could not read image dimensions",
      };
    }

    /* ── Flag issues ─────────────────────────────────────── */
    if (origW < VERY_LOW_RES_THRESHOLD || origH < VERY_LOW_RES_THRESHOLD) {
      flags.push("very-low-resolution");
      notes.push(`Very low resolution (${origW}×${origH}); strongly recommend sourcing a higher-quality asset`);
    } else if (origW < LOW_RES_THRESHOLD || origH < LOW_RES_THRESHOLD) {
      flags.push("low-resolution");
      notes.push(`Low resolution (${origW}×${origH}); consider sourcing a better image`);
    }

    if (sourceRelPath.toLowerCase().includes("screenshot")) {
      flags.push("ambiguous-filename");
      notes.push("Filename suggests a screenshot rather than a proper product asset; verify content manually");
    }

    /* ── Step 1: Correct EXIF orientation ─────────────────── */
    let pipeline = sharp(sourceAbs).rotate();

    /* ── Step 2: Trim transparent / uniform margins ──────── */
    let trimmedW = origW;
    let trimmedH = origH;

    try {
      const trimmedBuf = await pipeline.trim({ threshold: 10 }).toBuffer();
      const trimmedMeta = await sharp(trimmedBuf).metadata();
      trimmedW = trimmedMeta.width ?? origW;
      trimmedH = trimmedMeta.height ?? origH;

      /* Safety: if trim removed >60% of the image, it may have cropped
         important content (mount, antenna).  Revert. */
      const areaBefore = origW * origH;
      const areaAfter = trimmedW * trimmedH;
      if (areaAfter < areaBefore * 0.40) {
        notes.push("Trim removed >60% of image area; reverted to prevent cropping mounts/antennas");
        pipeline = sharp(sourceAbs).rotate();
        trimmedW = origW;
        trimmedH = origH;
      } else {
        pipeline = sharp(trimmedBuf);
      }
    } catch {
      /* trim() fails when there is no uniform border; skip */
      pipeline = sharp(sourceAbs).rotate();
      notes.push("Trim skipped (no uniform border detected)");
    }

    /* ── Step 3: White background removal ────────────────── */
    let hasTransparency = srcHasAlpha;
    let bgRemoved = false;
    let innerRectsRemoved = false;

    /* Check for meaningful alpha in source */
    if (srcHasAlpha) {
      const meaningful = await hasMeaningfulAlpha(sourceAbs);
      if (meaningful) {
        hasTransparency = true;
      } else {
        /* Alpha channel exists but is fully opaque → treat as opaque */
        hasTransparency = false;
        notes.push("Alpha channel present but fully opaque; treating as opaque image");
      }
    }

    /* For truly opaque images, attempt white-background removal
       only if the product category does NOT have white bodies */
    if (!hasTransparency && !WHITE_BODY_CATEGORIES.has(catSlug)) {
      try {
        const rawPipeline = sharp(await pipeline.toBuffer()).ensureAlpha();
        const rawMeta = await rawPipeline.metadata();
        const rW = rawMeta.width ?? trimmedW;
        const rH = rawMeta.height ?? trimmedH;
        const rCh = 4; // ensureAlpha guarantees 4 channels

        const rawBuf = await rawPipeline.raw().toBuffer();

        /* Flood-fill from borders */
        const { buffer: floodBuf, pixelsRemoved: borderRemoved } =
          floodFillWhiteFromBorders(rawBuf, rW, rH, rCh, 240);

        /* Remove enclosed interior white rectangles */
        const { buffer: finalBuf, rectsRemoved: interiorRects } =
          removeEnclosedWhiteRects(floodBuf, rW, rH, rCh, 245, 0.08);

        const totalPixels = rW * rH;
        const removalRatio = borderRemoved / totalPixels;

        if (removalRatio > 0.60) {
          /* Removal was too aggressive — likely removed product content.
             Revert to original and use white canvas. */
          notes.push(
            `White-bg removal too aggressive (${Math.round(removalRatio * 100)}% of pixels); reverted to white stage`,
          );
          pipeline = sharp(sourceAbs).rotate();
          /* Re-trim if possible */
          try {
            const reTrimmed = await pipeline.trim({ threshold: 10 }).toBuffer();
            const reMeta = await sharp(reTrimmed).metadata();
            const reArea = (reMeta.width ?? origW) * (reMeta.height ?? origH);
            if (reArea >= origW * origH * 0.40) {
              pipeline = sharp(reTrimmed);
              trimmedW = reMeta.width ?? origW;
              trimmedH = reMeta.height ?? origH;
            } else {
              pipeline = sharp(sourceAbs).rotate();
              trimmedW = origW;
              trimmedH = origH;
            }
          } catch {
            pipeline = sharp(sourceAbs).rotate();
            trimmedW = origW;
            trimmedH = origH;
          }
          hasTransparency = false;
        } else if (borderRemoved > 0) {
          pipeline = sharp(finalBuf, { raw: { width: rW, height: rH, channels: rCh } });
          hasTransparency = true;
          bgRemoved = true;
          innerRectsRemoved = interiorRects > 0;
          if (interiorRects > 0) {
            notes.push(`Removed ${interiorRects} enclosed interior white rectangle(s)`);
          }
          notes.push(`White background removed (flood-fill from borders, ${Math.round(removalRatio * 100)}% of pixels)`);
        } else {
          /* No white border detected → likely transparent-ish or coloured border */
          notes.push("No white border detected for removal; using white stage");
          hasTransparency = false;
        }
      } catch (err) {
        notes.push(`White-bg removal failed: ${(err as Error).message}; using white stage`);
        pipeline = sharp(sourceAbs).rotate();
        try {
          const t = await pipeline.trim({ threshold: 10 }).toBuffer();
          const tm = await sharp(t).metadata();
          if ((tm.width ?? origW) * (tm.height ?? origH) >= origW * origH * 0.40) {
            pipeline = sharp(t);
            trimmedW = tm.width ?? origW;
            trimmedH = tm.height ?? origH;
          } else {
            pipeline = sharp(sourceAbs).rotate();
            trimmedW = origW;
            trimmedH = origH;
          }
        } catch {
          pipeline = sharp(sourceAbs).rotate();
          trimmedW = origW;
          trimmedH = origH;
        }
        hasTransparency = false;
      }
    } else if (!hasTransparency && WHITE_BODY_CATEGORIES.has(catSlug)) {
      notes.push("White-body category — background removal skipped to preserve product body colour");
    }

    /* ── Step 4: Calculate target product size ────────────── */
    const aspectRatio = trimmedW / trimmedH;
    let targetW: number;
    let targetH: number;
    let upscale: number;

    if (occ.mode === "horizontal") {
      /* Landscape products (NVRs, switches): fill horizontally */
      targetW = Math.round(CANVAS * occ.target);
      targetH = Math.round(targetW / aspectRatio);
      /* Ensure product doesn't exceed canvas vertically */
      if (targetH > CANVAS * 0.92) {
        targetH = Math.round(CANVAS * 0.92);
        targetW = Math.round(targetH * aspectRatio);
      }
      upscale = targetW / trimmedW;
    } else {
      /* Portrait / square products: fill max dimension */
      const maxDim = Math.max(trimmedW, trimmedH);
      const targetMax = Math.round(CANVAS * occ.target);
      const scale = targetMax / maxDim;
      targetW = Math.round(trimmedW * scale);
      targetH = Math.round(trimmedH * scale);
      upscale = scale;
    }

    /* Clamp upscale */
    if (upscale > MAX_UPSCALE) {
      const clamped = MAX_UPSCALE;
      targetW = Math.round(trimmedW * clamped);
      targetH = Math.round(trimmedH * clamped);
      upscale = clamped;
      flags.push("upscale-clamped");
      notes.push(
        `Upscale limited to ${MAX_UPSCALE}× (original ${trimmedW}×${trimmedH}); occupancy will be below target`,
      );
    }

    /* If source is already larger than target, we're downscaling → no issues */
    if (upscale <= 1) {
      upscale = 1; // actual scale will be determined by Sharp
    }

    /* ── Step 5: Resize (preserve aspect ratio) ──────────── */
    /*  Always output as WebP. WebP supports alpha transparency.
        Specify format explicitly — pipelines from raw pixel data
        have no implicit output format. */
    const resizeStep = pipeline
      .resize(targetW, targetH, { fit: "inside", kernel: "lanczos3" })
      .webp({ quality: 90, effort: 6, alphaQuality: 100 });

    const resizedBuf = await resizeStep.toBuffer();

    /* Verify actual dimensions after resize (Sharp may adjust slightly) */
    const resizedMeta = await sharp(resizedBuf).metadata();
    const actualW = resizedMeta.width ?? targetW;
    const actualH = resizedMeta.height ?? targetH;
    const outFilename = `${modelSlug}-${seq}.webp`;
    const outRelPath = `/images/products/optimized/${outFilename}`;
    const outAbsPath = path.join(OUTPUT_DIR, outFilename);

    /* ── Step 6: Composite onto canvas ────────────────────── */
    const offsetX = Math.round((CANVAS - actualW) / 2);
    let offsetY = Math.round((CANVAS - actualH) / 2);

    /* NVRs and switches: push down ~8% for visual grounding */
    if (occ.mode === "horizontal") {
      offsetY = Math.round(offsetY + actualH * 0.08);
      /* Ensure product doesn't go below canvas */
      if (offsetY + actualH > CANVAS) {
        offsetY = CANVAS - actualH - 10;
      }
    }

    const canvasBackground = hasTransparency
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 };

    const compositeOps: sharp.CompositeOperation[] = [
      { input: resizedBuf, left: offsetX, top: offsetY },
    ];

    /* Add subtle grounding shadow for horizontal products */
    if (occ.mode === "horizontal") {
      try {
        const shadowH = Math.round(actualH * 0.06);
        const shadowBlur = Math.round(actualW * 0.12);
        const shadow = await sharp({
          create: {
            width: actualW,
            height: shadowH,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0.05 },
          },
        })
          .blur(shadowBlur)
          .webp({ quality: 90 })
          .toBuffer();
        compositeOps.push({
          input: shadow,
          left: offsetX,
          top: offsetY + actualH - Math.round(shadowH * 0.4),
        });
      } catch {
        /* Shadow is optional */
      }
    }

    /* Write composite as high-quality WebP */
    const compositePipeline = sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: canvasBackground,
      },
    })
      .composite(compositeOps)
      .webp({ quality: 90, effort: 6, alphaQuality: 100 });

    const outputBuf = await compositePipeline.toBuffer();
    fs.writeFileSync(outAbsPath, outputBuf);

    const outputSize = outputBuf.length;

    /* ── Calculate occupancy ──────────────────────────────── */
    let occupancy: number;
    if (occ.mode === "horizontal") {
      occupancy = actualW / CANVAS;
    } else {
      occupancy = Math.max(actualW, actualH) / CANVAS;
    }

    /* ── Determine status ─────────────────────────────────── */
    let status: "success" | "needs-review" | "error" = "success";
    if (flags.length > 0) status = "needs-review";

    /* Check if occupancy is outside target range */
    if (occupancy < occ.min || occupancy > occ.max) {
      flags.push("occupancy-out-of-range");
      notes.push(
        `Occupancy ${Math.round(occupancy * 100)}% outside target range ${Math.round(occ.min * 100)}–${Math.round(occ.max * 100)}%`,
      );
      if (status === "success") status = "needs-review";
    }

    return {
      sourcePath: sourceRelPath,
      outputPath: outRelPath,
      format: "webp",
      productModels: products.map(p => p.model),
      productSlugs: products.map(p => p.slug),
      productCategory: primary.category,
      categorySlug: catSlug,
      originalWidth: origW,
      originalHeight: origH,
      originalSizeBytes: origSize,
      originalFormat: srcFormat,
      originalHasAlpha: srcHasAlpha,
      trimmedWidth: trimmedW !== origW ? trimmedW : null,
      trimmedHeight: trimmedH !== origH ? trimmedH : null,
      productWidthOnCanvas: actualW,
      productHeightOnCanvas: actualH,
      outputWidth: CANVAS,
      outputHeight: CANVAS,
      outputSizeBytes: outputSize,
      occupancyPercent: Math.round(occupancy * 100),
      occupancyTargetPercent: Math.round(occ.target * 100),
      occupancyMode: occ.mode,
      upscaleFactor: Math.round(upscale * 100) / 100,
      hasTransparency,
      backgroundRemoved: bgRemoved,
      innerWhiteRectsRemoved: innerRectsRemoved,
      status,
      flags,
      notes: notes.join("; "),
    };
  } catch (err) {
    return {
      ...emptyEntry(sourceRelPath, products, catSlug, occ),
      status: "error",
      flags: ["processing-error"],
      notes: `Processing error: ${(err as Error).message}`,
    };
  }
}

/* ─── Empty entry template ───────────────────────────────────────── */

function emptyEntry(
  sourceRelPath: string,
  products: Array<{ model: string; slug: string; category: string; categorySlug: string }>,
  catSlug: string,
  occ: OccupancyRange,
): AuditEntry {
  const primary = products[0];
  return {
    sourcePath: sourceRelPath,
    outputPath: "",
    format: "",
    productModels: products.map(p => p.model),
    productSlugs: products.map(p => p.slug),
    productCategory: primary.category,
    categorySlug: catSlug,
    originalWidth: 0, originalHeight: 0,
    originalSizeBytes: 0,
    originalFormat: "", originalHasAlpha: false,
    trimmedWidth: null, trimmedHeight: null,
    productWidthOnCanvas: 0, productHeightOnCanvas: 0,
    outputWidth: 0, outputHeight: 0,
    outputSizeBytes: 0,
    occupancyPercent: 0,
    occupancyTargetPercent: Math.round(occ.target * 100),
    occupancyMode: occ.mode,
    upscaleFactor: 0,
    hasTransparency: false,
    backgroundRemoved: false,
    innerWhiteRectsRemoved: false,
    status: "error",
    flags: [],
    notes: "",
  };
}

/* ─── Orphan detection ───────────────────────────────────────────── */

function findOrphanFiles(cataloguePaths: Set<string>): string[] {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  const diskFiles = fs.readdirSync(SOURCE_DIR);
  const orphans: string[] = [];
  for (const f of diskFiles) {
    const rel = `/images/products/${f}`;
    if (!cataloguePaths.has(rel)) {
      orphans.push(rel);
    }
  }
  return orphans;
}

/* ─── Main ───────────────────────────────────────────────────────── */

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   PRODUCT IMAGE NORMALISATION — DeviceDestination   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  /* Ensure output directories exist */
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  /* ── Build deduplicated image → products map ──────────── */
  const imageToProducts = new Map<string, Array<{
    model: string; slug: string; category: string; categorySlug: string;
  }>>();

  /* Also track each product's image sequence for deterministic naming */
  const productImageIndex = new Map<string, number>();

  for (const product of catalogue) {
    for (let i = 0; i < product.images.length; i++) {
      const imgPath = product.images[i];
      if (!imageToProducts.has(imgPath)) {
        imageToProducts.set(imgPath, []);
        /* Sequence number = position in first product's images array */
        productImageIndex.set(imgPath, i + 1);
      }
      imageToProducts.get(imgPath)!.push({
        model: product.model,
        slug: product.slug,
        category: product.category,
        categorySlug: product.categorySlug,
      });
    }
  }

  /* Set of all catalogue-referenced paths (for orphan detection) */
  const cataloguePaths = new Set(catalogue.flatMap(p => p.images));

  /* ── Process each unique image ─────────────────────────── */
  const report: AuditEntry[] = [];
  const imageMap: Record<string, string> = {};

  const total = imageToProducts.size;
  let processed = 0;

  for (const [sourceRelPath, products] of imageToProducts) {
    processed++;
    const seq = productImageIndex.get(sourceRelPath)!;
    console.log(
      `[${processed}/${total}] ${sourceRelPath} → ${normalizeModelForFilename(products[0].model)}-${String(seq).padStart(2, "0")}.webp`,
    );

    const entry = await processImage(sourceRelPath, products, seq);
    report.push(entry);

    if (entry.status === "success" || entry.status === "needs-review") {
      imageMap[entry.sourcePath] = entry.outputPath;
    }
  }

  /* ── Orphan files ──────────────────────────────────────── */
  const orphans = findOrphanFiles(cataloguePaths);
  if (orphans.length > 0) {
    console.log(`\n⚠  Orphan files (in directory but not in catalogue):`);
    for (const o of orphans) {
      console.log(`   ${o}`);
    }
  }

  /* ── Summary ───────────────────────────────────────────── */
  const successCount = report.filter(e => e.status === "success").length;
  const reviewCount = report.filter(e => e.status === "needs-review").length;
  const errorCount = report.filter(e => e.status === "error").length;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                PROCESSING SUMMARY                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Total images:       ${total}`);
  console.log(`  Success:            ${successCount}`);
  console.log(`  Needs review:       ${reviewCount}`);
  console.log(`  Errors:             ${errorCount}`);
  console.log(`  Orphan files:       ${orphans.length}`);

  if (reviewCount > 0 || errorCount > 0) {
    console.log("\n── Items requiring attention ──────────────────────────");
    for (const entry of report) {
      if (entry.status !== "success") {
        console.log(`  ${entry.sourcePath}`);
        console.log(`    Status:  ${entry.status}`);
        console.log(`    Flags:   ${entry.flags.join(", ")}`);
        console.log(`    Notes:   ${entry.notes}`);
        if (entry.occupancyPercent > 0) {
          console.log(
            `    Occupancy: ${entry.occupancyPercent}% (target: ${entry.occupancyTargetPercent}% range, mode: ${entry.occupancyMode})`,
          );
        }
      }
    }
  }

  /* ── Occupancy distribution ────────────────────────────── */
  const byCategory = new Map<string, AuditEntry[]>();
  for (const entry of report) {
    const cat = entry.categorySlug;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  console.log("\n── Occupancy by category ─────────────────────────────");
  for (const [cat, entries] of byCategory) {
    const occ = occupancyFor(cat);
    const occs = entries.filter(e => e.occupancyPercent > 0).map(e => e.occupancyPercent);
    if (occs.length === 0) continue;
    const avg = Math.round(occs.reduce((a, b) => a + b, 0) / occs.length);
    const minOcc = Math.min(...occs);
    const maxOcc = Math.max(...occs);
    console.log(
      `  ${cat}: avg ${avg}% | range ${minOcc}–${maxOcc}% | target ${Math.round(occ.min * 100)}–${Math.round(occ.max * 100)}% (${occ.mode})`,
    );
  }

  /* ── Save audit report JSON ────────────────────────────── */
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportFile = path.join(REPORT_DIR, `image-audit-${timestamp}.json`);
  const fullReport = {
    timestamp: new Date().toISOString(),
    canvasSize: CANVAS,
    maxUpscale: MAX_UPSCALE,
    totalImages: total,
    successCount,
    needsReviewCount: reviewCount,
    errorCount,
    orphanFiles: orphans,
    occupancyTargets: Object.fromEntries(
      Object.entries(OCCUPANCY).map(([k, v]) => [k, {
        min: Math.round(v.min * 100),
        target: Math.round(v.target * 100),
        max: Math.round(v.max * 100),
        mode: v.mode,
      }]),
    ),
    entries: report,
  };

  fs.writeFileSync(reportFile, JSON.stringify(fullReport, null, 2));
  console.log(`\n  Audit report → ${reportFile}`);

  /* ── Save latest report (always at fixed path) ── */
  const latestReport = path.join(REPORT_DIR, "image-audit-latest.json");
  fs.writeFileSync(latestReport, JSON.stringify(fullReport, null, 2));

  /* ── Save optimized image map ──────────────────────────── */
  const mapPath = path.join(PROJECT_ROOT, "src", "data", "optimized-image-map.ts");
  fs.writeFileSync(
    mapPath,
    `// Auto-generated by scripts/optimize-product-images.ts\n// Do not edit manually — run npm run products:images to regenerate\n// Maps original image paths to optimized versions\nexport const optimizedImageMap: Record<string, string> = ${JSON.stringify(imageMap, null, 2)} as const;\n`,
  );
  console.log(`  Image map    → ${mapPath}`);

  /* ── Size savings summary ──────────────────────────────── */
  const totalOrigSize = report.reduce((sum, e) => sum + e.originalSizeBytes, 0);
  const totalOutSize = report
    .filter(e => e.outputSizeBytes > 0)
    .reduce((sum, e) => sum + e.outputSizeBytes, 0);
  if (totalOrigSize > 0) {
    const savings = Math.round(((totalOrigSize - totalOutSize) / totalOrigSize) * 100);
    console.log(
      `\n  Size: ${formatBytes(totalOrigSize)} → ${formatBytes(totalOutSize)} (${savings > 0 ? `${savings}% smaller` : `${Math.abs(savings)}% larger`})`,
    );
  }

  console.log("\n✓ Done.\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
