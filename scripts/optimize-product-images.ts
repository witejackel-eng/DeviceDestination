/**
 * Product Image Normalisation Script (Section 4)
 *
 * Reads existing product-image paths from catalogue data,
 * trims whitespace, corrects orientation, resizes proportionally,
 * places products on a consistent square canvas,
 * exports high-quality WebP, and produces a detailed report.
 *
 * Usage: npm run products:images
 */
import sharp from "sharp";
import { catalogue } from "../src/data/catalog";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "public/images/products/optimized";
const MASTER_SIZE = 1600;
const TARGET_OCCUPANCY = 0.72; // 68–76% visual occupancy

interface ImageReportEntry {
  sourceImage: string;
  outputImage: string;
  originalDimensions: string;
  outputDimensions: string;
  processingStatus: "success" | "skipped" | "error" | "needs-review";
  notes: string;
}

async function processImage(
  sourcePath: string,
  outputPath: string,
  productCategory: string
): Promise<ImageReportEntry> {
  const fullSourcePath = path.join("public", sourcePath);
  const fullOutputPath = path.join("public", outputPath);

  if (!fs.existsSync(fullSourcePath)) {
    return {
      sourceImage: sourcePath,
      outputImage: outputPath,
      originalDimensions: "N/A",
      outputDimensions: "N/A",
      processingStatus: "error",
      notes: "Source file not found",
    };
  }

  try {
    const metadata = await sharp(fullSourcePath).metadata();
    const origW = metadata.width ?? 0;
    const origH = metadata.height ?? 0;
    const origDims = `${origW} × ${origH}`;

    if (origW === 0 || origH === 0) {
      return {
        sourceImage: sourcePath,
        outputImage: outputPath,
        originalDimensions: origDims,
        outputDimensions: "N/A",
        processingStatus: "error",
        notes: "Could not read image dimensions",
      };
    }

    /* Step 1: Trim unnecessary whitespace */
    let pipeline = sharp(fullSourcePath).rotate(); // correct orientation from metadata

    try {
      const trimmed = await pipeline.trim({ threshold: 10 }).toBuffer();
      pipeline = sharp(trimmed);
    } catch {
      /* trim may fail on images without enough uniform border; skip */
      pipeline = sharp(fullSourcePath).rotate();
    }

    /* Get trimmed dimensions */
    const trimmedMeta = await pipeline.metadata();
    const tW = trimmedMeta.width ?? origW;
    const tH = trimmedMeta.height ?? origH;

    /* Step 2: Calculate product size on canvas for target occupancy */
    /* For NVRs and switches, use higher visual size relative to canvas */
    let occupancy = TARGET_OCCUPANCY;
    if (productCategory.includes("nvr") || productCategory.includes("switch")) {
      occupancy = 0.85; // NVRs and switches should appear more substantial
    }

    /* Calculate the product size to fill the target occupancy of the canvas */
    const productMaxDim = Math.min(tW, tH);
    const canvasProductArea = MASTER_SIZE * occupancy;
    const scale = canvasProductArea / productMaxDim;

    /* Don't enlarge severely low-resolution assets */
    const maxScale = 2.5;
    const finalScale = Math.min(scale, maxScale);

    const scaledW = Math.round(tW * finalScale);
    const scaledH = Math.round(tH * finalScale);

    /* Step 3: Resize the product */
    const resized = await pipeline
      .resize(scaledW, scaledH, {
        fit: "inside",
        withoutEnlargement: finalScale <= 1,
        kernel: "lanczos3",
      })
      .png({ quality: 100 })
      .toBuffer();

    /* Step 4: Place on consistent square canvas with transparent center area */
    /* Padding calculation: centre the product on the 1600×1600 canvas */
    const offsetX = Math.round((MASTER_SIZE - scaledW) / 2);
    const offsetY = Math.round((MASTER_SIZE - scaledH) / 2);

    /* NVRs and switches get a slightly lower baseline */
    let offsetYFinal = offsetY;
    if (productCategory.includes("nvr") || productCategory.includes("switch")) {
      offsetYFinal = Math.round(offsetY * 1.2); // push down slightly for grounding
    }

    const compositeOps: { input: Buffer; left: number; top: number }[] = [
      { input: resized, left: offsetX, top: offsetYFinal },
    ];

    /* Add subtle grounding shadow for NVRs/switches */
    if (productCategory.includes("nvr") || productCategory.includes("switch")) {
      const shadowHeight = Math.round(scaledH * 0.08);
      const shadowBlur = Math.round(scaledW * 0.15);
      try {
        const shadow = await sharp({
          create: {
            width: scaledW,
            height: shadowHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0.06 },
          },
        })
          .blur(shadowBlur)
          .toBuffer();
        compositeOps.push({
          input: shadow,
          left: offsetX,
          top: offsetYFinal + scaledH - Math.round(shadowHeight * 0.5),
        });
      } catch {
        /* Shadow creation is optional */
      }
    }

    /* Create the canvas and composite */
    await sharp({
      create: {
        width: MASTER_SIZE,
        height: MASTER_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent
      },
    })
      .composite(compositeOps)
      .webp({ quality: 92, effort: 6 })
      .toFile(fullOutputPath);

    const needsReview = origW < 300 || origH < 300;

    return {
      sourceImage: sourcePath,
      outputImage: outputPath,
      originalDimensions: origDims,
      outputDimensions: `${MASTER_SIZE} × ${MASTER_SIZE}`,
      processingStatus: needsReview ? "needs-review" : "success",
      notes: needsReview
        ? `Low-resolution source (${origW}×${origH}); consider sourcing a higher-quality image`
        : finalScale > 1.5
          ? `Upscaled from ${origW}×${origH} by ${finalScale.toFixed(1)}x`
          : "OK",
    };
  } catch (err) {
    return {
      sourceImage: sourcePath,
      outputImage: outputPath,
      originalDimensions: "N/A",
      outputDimensions: "N/A",
      processingStatus: "error",
      notes: `Processing error: ${(err as Error).message}`,
    };
  }
}

async function main() {
  /* Ensure output directory exists */
  fs.mkdirSync(path.join("public", OUTPUT_DIR.replace("public/", "")), { recursive: true });

  const report: ImageReportEntry[] = [];

  /* Deduplicate images — each unique source path is processed once */
  const seen = new Set<string>();

  for (const product of catalogue) {
    for (const imgPath of product.images) {
      if (seen.has(imgPath)) continue;
      seen.add(imgPath);

      /* Generate deterministic filename */
      const ext = path.extname(imgPath);
      const baseName = path.basename(imgPath, ext).replace(/\s+/g, "-");
      const outputPath = `${OUTPUT_DIR}/${baseName}.webp`;

      const entry = await processImage(imgPath, outputPath, product.categorySlug);
      report.push(entry);
    }
  }

  /* Print report */
  console.log("\n==================================================");
  console.log("PRODUCT IMAGE NORMALISATION REPORT");
  console.log("==================================================\n");

  const successCount = report.filter((e) => e.processingStatus === "success").length;
  const needsReviewCount = report.filter((e) => e.processingStatus === "needs-review").length;
  const errorCount = report.filter((e) => e.processingStatus === "error").length;
  const skippedCount = report.filter((e) => e.processingStatus === "skipped").length;

  console.log(`Total images processed: ${report.length}`);
  console.log(`  Success:    ${successCount}`);
  console.log(`  Needs review: ${needsReviewCount}`);
  console.log(`  Errors:     ${errorCount}`);
  console.log(`  Skipped:    ${skippedCount}`);

  if (needsReviewCount > 0 || errorCount > 0) {
    console.log("\n⚠️  Items requiring attention:");
    for (const entry of report) {
      if (entry.processingStatus === "needs-review" || entry.processingStatus === "error") {
        console.log(`  ${entry.sourceImage}: ${entry.notes}`);
      }
    }
  }

  /* Save report JSON */
  const reportPath = path.join("reports", "image-normalisation-report.json");
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  /* Also generate an image map for easy lookup in components */
  const imageMap: Record<string, string> = {};
  for (const entry of report) {
    if (entry.processingStatus === "success" || entry.processingStatus === "needs-review") {
      imageMap[entry.sourceImage] = entry.outputImage;
    }
  }
  const mapPath = path.join("src", "data", "optimized-image-map.ts");
  fs.writeFileSync(
    mapPath,
    `// Auto-generated by scripts/optimize-product-images.ts\n// Maps original image paths to optimized versions\nexport const optimizedImageMap: Record<string, string> = ${JSON.stringify(imageMap, null, 2)};\n`
  );
  console.log(`Image map saved to ${mapPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
