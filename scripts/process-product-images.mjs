// Normalises product photos that carry excessive embedded white margins onto a
// consistent square canvas, matching the scale/spacing of the existing CCTV
// camera photography. Source files are never modified; output goes to
// public/images/products/processed/.
//
// Usage:
//   node scripts/process-product-images.mjs                # process the default manifest
//   node scripts/process-product-images.mjs "F22.png" "K30 pro.png"   # process specific files

import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

const SOURCE_DIR = path.resolve("public/images/products");
const OUTPUT_DIR = path.join(SOURCE_DIR, "processed");

const CANVAS_SIZE = 1600;
const TARGET_FILL = 0.76; // product should occupy ~70-82% of the canvas
const MIN_FILL = 0.55; // floor we'll accept before warning about a low-res source
const MAX_UPSCALE = 2.2; // never enlarge a source more aggressively than this
const TRIM_THRESHOLD = 24; // tolerance for off-white catalogue backgrounds

// Images with embedded white/near-white margins that make the product look
// smaller than the CP Plus / Prama camera photography. Camera images are
// intentionally excluded — they're already the visual reference.
const DEFAULT_MANIFEST = [
  "X-990.png",
  "F22.png",
  "F18.png",
  "Sf100.png",
  "K30 pro.png",
  "FR1200.png",
  "K90 pro.png",
  "AiFace-Mars.png",
  "ESSL-VEGA-W-POE.png",
  "ESSL-MB160.png",
  "ESSL-MB20.png",
  "ESSL-AIFACE-MERCURY.png",
  "ESSL-AIFACE-NEPTUNE.png",
  "NETGEAR-GS108PP.png",
  "NETGEAR-GS116PP.png",
  "CP-UNR-108F1 1st.jpg",
  "CP-UNR-4K2161-V2 1st.jpg",
];

async function trimToContent(filePath) {
  const base = sharp(filePath);
  const meta = await base.metadata();
  const raw = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const topLeftAlpha = raw.data[3];

  const trimOptions =
    topLeftAlpha === 0
      ? { threshold: TRIM_THRESHOLD } // already transparent — trim by alpha
      : { background: "#ffffff", threshold: TRIM_THRESHOLD }; // opaque catalogue bg — trim by colour

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .trim(trimOptions)
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    originalWidth: meta.width,
    originalHeight: meta.height,
    trimmedBuffer: data,
    trimmedWidth: info.width,
    trimmedHeight: info.height,
  };
}

async function processImage(filename) {
  const sourcePath = path.join(SOURCE_DIR, filename);
  try {
    await fs.access(sourcePath);
  } catch {
    console.error(`[skip] ${filename} — source file not found`);
    return;
  }

  const { originalWidth, originalHeight, trimmedBuffer, trimmedWidth, trimmedHeight } =
    await trimToContent(sourcePath);

  const targetBox = Math.round(CANVAS_SIZE * TARGET_FILL);
  const idealScale = Math.min(targetBox / trimmedWidth, targetBox / trimmedHeight);
  const scale = Math.min(idealScale, MAX_UPSCALE);

  const finalWidth = Math.max(1, Math.round(trimmedWidth * scale));
  const finalHeight = Math.max(1, Math.round(trimmedHeight * scale));
  const achievedFill = Math.max(finalWidth, finalHeight) / CANVAS_SIZE;

  const resized = await sharp(trimmedBuffer)
    .resize(finalWidth, finalHeight, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: resized, gravity: "center" }]);

  const outBase = filename.replace(/\.(png|jpe?g|webp)$/i, "");
  const outputPath = path.join(OUTPUT_DIR, `${outBase}.webp`);
  await canvas.webp({ quality: 92, effort: 6 }).toFile(outputPath);

  const scaleNote = idealScale > MAX_UPSCALE ? ` (capped upscale, fill ${(achievedFill * 100).toFixed(0)}%)` : "";
  const warn = achievedFill < MIN_FILL ? " ⚠ low resolution source — consider a manual re-crop or higher-res source" : "";

  console.log(
    `[ok] ${filename}\n` +
      `     original ${originalWidth}x${originalHeight} -> trimmed content ${trimmedWidth}x${trimmedHeight} -> ` +
      `placed ${finalWidth}x${finalHeight} on ${CANVAS_SIZE}x${CANVAS_SIZE} canvas${scaleNote}${warn}\n` +
      `     -> ${path.relative(process.cwd(), outputPath)}`,
  );
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const manifest = args.length > 0 ? args : DEFAULT_MANIFEST;

  console.log(`Processing ${manifest.length} image(s) -> ${path.relative(process.cwd(), OUTPUT_DIR)}\n`);
  for (const filename of manifest) {
    await processImage(filename);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
