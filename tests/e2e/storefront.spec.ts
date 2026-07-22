import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("storefront purchase journey and accessibility", async ({ page }) => {
  await test.step("homepage and catalogue navigation", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Security");
    await page
      .getByRole("link", { name: /Shop all products/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByRole("heading", { name: /Find the right hardware/i })).toBeVisible();
  });

  await test.step("model search persists in the URL", async () => {
    const viewport = page.viewportSize();
    const mode = (viewport?.width ?? 0) < 1024 ? "mobile" : "desktop";
    if (mode === "mobile") await page.getByText("Filters", { exact: true }).click();
    const productFilters = page.getByRole("form", { name: `${mode} product filters` });
    await productFilters.getByLabel("Search exact model").fill("CP-UNR-108F1");
    await productFilters.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=CP-UNR-108F1/);
    await expect(page.getByText("CP-UNR-108F1").first()).toBeVisible();
  });

  await test.step("cart addition, quantity, persistence and checkout", async () => {
    await page.goto("/products");
    const catalogueUrl = page.url();
    await page
      .getByRole("button", { name: /Add to cart:/ })
      .first()
      .click();
    await expect(page).toHaveURL(catalogueUrl);
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await page.getByRole("button", { name: /Increase .* quantity/ }).click();
    await expect(page.getByLabel("Quantity 2")).toBeVisible();
    await page.getByRole("button", { name: "Close cart" }).click();
    await page.reload();
    await page.getByRole("button", { name: /Open cart with 2 items/ }).click();
    await expect(page.getByLabel("Quantity 2")).toBeVisible();
    await page.getByRole("link", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Delivery and invoice" })).toBeVisible();
  });

  await test.step("exact documentation is downloadable", async () => {
    await page.goto("/products/cp-unc-da41l3c-q");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const datasheet = page.getByRole("link", { name: /Datasheet/ });
    await expect(datasheet).toBeVisible();
    const href = await datasheet.getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    await expect(page.getByText("Inclusive of all taxes", { exact: true })).toBeVisible();
  });

  await test.step("server-confirmed contact submission", async () => {
    await page.route("**/api/enquiries", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reference: "TEST-CONTACT-001", mode: "local-test" }),
      });
    });
    await page.goto("/contact");
    await page.getByLabel("Name").fill("Test Buyer");
    await page.getByLabel("Email").fill("buyer@example.com");
    await page.getByLabel("Mobile").fill("9876543210");
    await page.getByLabel("What do you need?").fill("Help selecting cameras for a small office.");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("TEST-CONTACT-001")).toBeVisible();
  });

  await test.step("core pages have no serious Axe violations", async () => {
    await page.unroute("**/api/enquiries");
    for (const route of ["/", "/products", "/contact"]) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
    }
  });
});
