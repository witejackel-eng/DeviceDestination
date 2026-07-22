import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrotliDecompress } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import serverlessChromium, { inflate } from "@sparticuz/chromium";
import { chromium } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3300";
const nextBin = join(process.cwd(), "node_modules/next/dist/bin/next");

async function extractBrotliTar(archive, destination, marker) {
  if (existsSync(marker)) return;
  mkdirSync(destination, { recursive: true });
  const tar = spawn("tar", ["-x", "--no-same-owner", "-C", destination, "-f", "-"]);
  createReadStream(archive).pipe(createBrotliDecompress()).pipe(tar.stdin);
  const code = await new Promise((resolve, reject) => {
    tar.once("error", reject);
    tar.once("exit", resolve);
  });
  assert.equal(code, 0, `Could not unpack ${archive}`);
}

async function prepareBrowser() {
  serverlessChromium.setGraphicsMode = false;
  process.env.FONTCONFIG_PATH = join(tmpdir(), "fonts");
  process.env.XDG_CACHE_HOME = join(tmpdir(), "playwright-cache");
  mkdirSync(process.env.XDG_CACHE_HOME, { recursive: true });
  const temporaryExecutable = join(tmpdir(), "chromium");
  if (existsSync(temporaryExecutable) && statSync(temporaryExecutable).size === 0)
    unlinkSync(temporaryExecutable);
  const bundleDirectory = join(
    dirname(fileURLToPath(import.meta.resolve("@sparticuz/chromium"))),
    "../bin",
  );
  await Promise.all([
    extractBrotliTar(
      join(bundleDirectory, "fonts.tar.br"),
      join(tmpdir(), "fonts"),
      join(tmpdir(), "fonts/fonts.conf"),
    ),
    extractBrotliTar(
      join(bundleDirectory, "swiftshader.tar.br"),
      tmpdir(),
      join(tmpdir(), "libGLESv2.so"),
    ),
  ]);
  return inflate(join(bundleDirectory, "chromium.br"));
}

async function waitForServer(logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production server did not start.\n${logs.value}`);
}

async function assertVisible(locator, message) {
  await locator.waitFor({ state: "visible" });
  assert.equal(await locator.isVisible(), true, message);
}

async function exerciseViewport(executablePath, viewport, label) {
  const browser = await chromium.launch({
    executablePath,
    args: serverlessChromium.args,
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport });
    const mobile = viewport.width < 1024;
    const filterPrefix = mobile ? "mobile" : "desktop";
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.goto(`${baseUrl}/`);
    await assertVisible(page.getByRole("heading", { level: 1 }), `${label}: homepage heading`);
    if (process.env.CAPTURE_SCREENSHOTS === "1") {
      await page.waitForTimeout(1_200);
      mkdirSync(join(process.cwd(), "docs/screenshots"), { recursive: true });
      await page.screenshot({
        path: join(process.cwd(), `docs/screenshots/storefront-${label}.png`),
        fullPage: false,
      });
    }
    console.log(`PASS ${label}: homepage render`);
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator('a[href="#main-content"]')
        .evaluate((element) => element === document.activeElement),
      true,
      `${label}: skip link receives keyboard focus`,
    );
    if (mobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await assertVisible(
        page.getByRole("heading", { name: "Shop DeviceDestination" }),
        "mobile menu opens",
      );
      await page.getByRole("button", { name: "Close menu" }).click();
    }
    await page.getByRole("button", { name: "Search products by exact model" }).first().click();
    await page.getByLabel("Search exact models").fill("cp unc da41l3c d q");
    await assertVisible(
      page.getByText("CP-UNC-DA41L3C-D-Q").first(),
      `${label}: search overlay normalizes model punctuation`,
    );
    await page.getByLabel("Search exact models").press("ArrowDown");
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      "A",
      `${label}: search results support arrow-key focus`,
    );
    await page.getByRole("button", { name: "Close search" }).click();
    await Promise.all([
      page.waitForURL(/\/products/),
      page
        .getByRole("link", { name: /Shop all products/i })
        .first()
        .click(),
    ]);
    assert.match(page.url(), /\/products/, `${label}: homepage navigation`);
    await assertVisible(
      page.getByRole("heading", { name: /Find the right hardware/i }),
      `${label}: catalogue heading`,
    );
    console.log(`PASS ${label}: catalogue navigation`);

    if (mobile) await page.getByText("Filters", { exact: true }).click();
    const productFilters = page.getByRole("form", { name: `${filterPrefix} product filters` });
    await productFilters.getByLabel("Search exact model").fill("CP-UNR-108F1");
    await Promise.all([
      page.waitForURL(/q=CP-UNR-108F1/),
      productFilters.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    assert.match(page.url(), /q=CP-UNR-108F1/, `${label}: search query persists`);
    await assertVisible(page.getByText("CP-UNR-108F1").first(), `${label}: exact model result`);
    console.log(`PASS ${label}: exact-model search`);

    await page.goto(`${baseUrl}/products`);
    const catalogueUrl = page.url();
    await page
      .getByRole("button", { name: /Add to cart:/ })
      .first()
      .click();
    assert.equal(page.url(), catalogueUrl, `${label}: add to cart does not navigate`);
    await page.getByRole("button", { name: /Increase .* quantity/ }).click();
    await assertVisible(page.getByLabel("Quantity 2"), `${label}: quantity update`);
    await page.getByRole("button", { name: "Close cart" }).click();
    await page.reload();
    await page.getByRole("button", { name: /Open cart with 2 items/ }).click();
    await assertVisible(page.getByLabel("Quantity 2"), `${label}: cart persistence`);
    await Promise.all([
      page.waitForURL(/\/checkout/),
      page.getByRole("link", { name: "Continue to checkout" }).click(),
    ]);
    await assertVisible(
      page.getByRole("heading", { name: "Delivery and invoice" }),
      `${label}: guest checkout`,
    );
    console.log(`PASS ${label}: persistent cart and checkout`);

    await page.goto(`${baseUrl}/products`);
    await page.getByRole("button", { name: "Add to compare" }).first().click();
    await assertVisible(
      page.getByRole("complementary", { name: "Product comparison tray" }),
      `${label}: comparison tray`,
    );
    await Promise.all([
      page.waitForURL(/\/compare\?ids=/),
      page
        .getByRole("link", { name: /Compare/ })
        .last()
        .click(),
    ]);
    await assertVisible(
      page.getByRole("heading", { name: "Compare exact models." }),
      `${label}: shareable comparison`,
    );
    console.log(`PASS ${label}: persistent comparison tray`);

    await page.goto(`${baseUrl}/products/cp-unc-da41l3c-d-q`);
    const datasheet = page.getByRole("link", { name: /Datasheet/ });
    await assertVisible(datasheet, `${label}: exact datasheet link`);
    const documentUrl = await datasheet.getAttribute("href");
    assert.ok(documentUrl, `${label}: datasheet URL`);
    assert.equal((await context.request.get(`${baseUrl}${documentUrl}`)).ok(), true);
    await assertVisible(
      page.getByText("Inclusive of all taxes", { exact: true }).first(),
      `${label}: GST copy`,
    );
    const imageUrls = await page
      .locator("img")
      .evaluateAll((images) => images.map((image) => image.currentSrc || image.src));
    for (const imageUrl of imageUrls) {
      assert.equal(
        (await context.request.get(imageUrl)).ok(),
        true,
        `${label}: product image responds successfully: ${imageUrl}`,
      );
    }
    await page.locator("main img").first().waitFor({ state: "visible" });
    assert.ok(
      await page
        .locator("main img")
        .first()
        .evaluate((image) => image.naturalWidth > 0),
      `${label}: primary product image renders`,
    );
    console.log(`PASS ${label}: product documents`);

    await page.route("**/api/enquiries", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reference: "TEST-CONTACT-001", mode: "local-test" }),
      });
    });
    await page.goto(`${baseUrl}/contact`);
    await page.getByLabel("Name").fill("Test Buyer");
    await page.getByLabel("Email").fill("buyer@example.com");
    await page.getByLabel("Mobile").fill("9876543210");
    await page.getByLabel("What do you need?").fill("Help selecting cameras for a small office.");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await assertVisible(page.getByText("TEST-CONTACT-001"), `${label}: confirmed enquiry`);
    await page.unroute("**/api/enquiries");
    console.log(`PASS ${label}: contact workflow`);

    for (const route of ["/", "/products", "/contact"]) {
      await page.goto(`${baseUrl}${route}`);
      // Audit the settled visual state, not partially transparent route/hero entrance frames.
      await page.waitForTimeout(850);
      const overflow = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: element.className,
              left: rect.left,
              right: rect.right,
              width: rect.width,
            };
          })
          .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
          .slice(0, 8),
      }));
      assert.ok(
        overflow.documentWidth <= overflow.viewport,
        `${label}: ${route} overflows horizontally: ${JSON.stringify(overflow)}`,
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      assert.equal(
        serious.length,
        0,
        `${label}: ${route} accessibility: ${serious
          .map(
            (item) =>
              `${item.id} (${item.nodes
                .slice(0, 3)
                .map((node) => `${node.target.join(" ")}: ${node.failureSummary}`)
                .join(" | ")})`,
          )
          .join(", ")}`,
      );
    }

    await page.goto(`${baseUrl}/`);
    const internalPaths = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) =>
        Array.from(new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))),
      );
    for (const path of internalPaths) {
      const response = await context.request.get(`${baseUrl}${path}`);
      assert.ok(
        response.status() < 400,
        `${label}: internal link ${path} returned ${response.status()}`,
      );
    }
    assert.deepEqual(browserErrors, [], `${label}: no console errors or hydration failures`);

    console.log(`PASS ${label}: navigation, search, cart, checkout, documents, contact and Axe`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function exerciseResponsiveWidths(executablePath, widths) {
  const browser = await chromium.launch({
    executablePath,
    args: serverlessChromium.args,
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: widths[0], height: 900 } });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    for (const width of widths) {
      browserErrors.length = 0;
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/",
        "/products",
        "/products/netgear-gs108pp",
        "/categories/dome-cameras",
        "/brands/cp-plus",
        "/compare",
        "/system-builder",
        "/cart",
        "/checkout",
        "/contact",
        "/support",
        "/account",
        "/downloads",
      ]) {
        await page.goto(`${baseUrl}${route}`);
        await page.locator("main").waitFor({ state: "visible" });
        const overflow = await page.evaluate(() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          offenders: Array.from(document.querySelectorAll("body *"))
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                className: element.className,
                left: rect.left,
                right: rect.right,
                width: rect.width,
              };
            })
            .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
            .slice(0, 8),
        }));
        assert.ok(
          overflow.documentWidth <= overflow.viewport,
          `${width}px: ${route} horizontally overflows (${JSON.stringify(overflow)})`,
        );
      }
      assert.deepEqual(browserErrors, [], `${width}px: no render or hydration errors`);
      console.log(`PASS ${width}px: responsive storefront route matrix`);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function exerciseReducedMotion(executablePath) {
  const browser = await chromium.launch({
    executablePath,
    args: serverlessChromium.args,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.goto(`${baseUrl}/`);
    assert.equal(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      true,
      "reduced-motion media preference is active",
    );
    await assertVisible(page.getByRole("heading", { level: 1 }), "reduced-motion homepage");
    assert.deepEqual(browserErrors, [], "reduced-motion mode has no render errors");
    console.log("PASS reduced-motion: content remains visible and error-free");
  } finally {
    await browser.close().catch(() => undefined);
  }
}

if (process.env.SKIP_BUILD !== "1") {
  const build = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit" });
  assert.equal(build.status, 0, "Production build failed before browser checks");
}

const logs = { value: "" };
const server = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3300"],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production" } },
);
server.stdout.on("data", (chunk) => (logs.value += chunk.toString()));
server.stderr.on("data", (chunk) => (logs.value += chunk.toString()));

try {
  await waitForServer(logs);
  const executablePath = await prepareBrowser();
  await exerciseViewport(executablePath, { width: 1440, height: 960 }, "1440px");
  await exerciseViewport(executablePath, { width: 375, height: 844 }, "375px");
  await exerciseResponsiveWidths(executablePath, [320, 430, 768, 1024, 1280]);
  await exerciseReducedMotion(executablePath);
  console.log(
    "E2E PASS: 7 required widths, 13 storefront routes, reduced motion, full flows and accessibility",
  );
} finally {
  server.kill("SIGTERM");
}
