// Captures the review screenshot set against an already-running server.
//
//   node scripts/capture-screenshots.mjs [baseUrl] [outputDir]
//
// Defaults to http://127.0.0.1:3100 and docs/screenshots/review.

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3100";
const outputDir = process.argv[3] ?? join("docs", "screenshots", "review");

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const shots = [
  { name: "homepage", path: "/", viewports: ["desktop", "tablet", "mobile"], fullPage: true },
  { name: "product-listing", path: "/products", viewports: ["desktop", "mobile"], fullPage: true },
  {
    name: "product-camera",
    path: "/products/cp-unc-da41l3c-d-q",
    viewports: ["desktop"],
    fullPage: true,
  },
  { name: "product-recorder", path: "/products/cp-unr-4k2161-v2", viewports: ["desktop"], fullPage: true },
  { name: "product-biometric", path: "/products/x-990", viewports: ["desktop"], fullPage: true },
  { name: "product-switch", path: "/products/netgear-gs108pp", viewports: ["desktop"], fullPage: true },
  {
    name: "authentication",
    path: "/login?next=%2Fcheckout",
    viewports: ["desktop", "mobile"],
    fullPage: true,
  },
  { name: "checkout", path: "/checkout", viewports: ["desktop", "mobile"], fullPage: true },
  { name: "cart", path: "/cart", viewports: ["desktop"], fullPage: true },
  { name: "compare", path: "/compare", viewports: ["desktop"], fullPage: true },
  { name: "admin-overview", path: "/admin", viewports: ["desktop"], fullPage: true },
  { name: "admin-products", path: "/admin/products", viewports: ["desktop"], fullPage: true },
  { name: "admin-orders", path: "/admin/orders", viewports: ["desktop"], fullPage: true },
  { name: "account", path: "/account", viewports: ["desktop"], fullPage: true },
];

const browser = await chromium.launch();
await mkdir(outputDir, { recursive: true });

let captured = 0;
for (const shot of shots) {
  for (const viewportName of shot.viewports) {
    const context = await browser.newContext({
      viewport: viewports[viewportName],
      // Motion is decorative here; disabling it keeps the captures deterministic.
      reducedMotion: "reduce",
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;
    const file = join(outputDir, `${shot.name}-${viewportName}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage });
    console.log(`[${status}] ${shot.path} @ ${viewportName} -> ${file}`);
    if (status >= 400) process.exitCode = 1;
    captured += 1;
    await context.close();
  }
}

await browser.close();
console.log(`\nCaptured ${captured} screenshots into ${outputDir}`);
