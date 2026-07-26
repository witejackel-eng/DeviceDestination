/**
 * Server-route catalogue cutover (M2B).
 *
 * Two kinds of test here:
 *
 *  - Route behaviour, driven through a mocked `@/data/catalogue-cache` so the
 *    real route modules can be imported and called without Next's request or
 *    cache scope.
 *  - Static audits of the import graph, which is the only way to prove a route
 *    no longer reaches the static catalogue.
 *
 * Persistence behaviour of `unstable_cache` itself cannot be exercised here —
 * it needs a real Next runtime. That was measured in a production build and is
 * recorded in `docs/adr/0001-catalogue-cache-architecture.md`; the sentinel
 * mechanism that makes it work is unit-tested below.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueSnapshot } from "@/data/catalogue-types";
import { getCatalogue } from "@/data/repository";
import { toCachePayload } from "@/data/catalogue-cache-payload";
import {
  fakeAdapter,
  productRow,
  queryResult,
  recordingLogger,
} from "@tests/helpers/catalogue-fixtures";
import { CatalogueDatabaseError } from "@/data/catalogue-db-adapter";

// ─── Mocked cache, so route modules can be imported directly ──────────────

const snapshotBox: { current: CatalogueSnapshot | null } = { current: null };
const cacheCalls = { count: 0 };

vi.mock("@/data/catalogue-cache", () => ({
  getCachedCatalogue: async () => {
    cacheCalls.count += 1;
    if (!snapshotBox.current) throw new Error("test snapshot not set");
    return snapshotBox.current;
  },
  isAuthoritativeEmpty: (snapshot: CatalogueSnapshot) =>
    snapshot.authority === "database" && snapshot.products.length === 0,
  isDegraded: (snapshot: CatalogueSnapshot) => snapshot.authority === "static_degraded",
}));

async function useSnapshot(snapshot: CatalogueSnapshot) {
  snapshotBox.current = snapshot;
  cacheCalls.count = 0;
}

async function databaseSnapshot(): Promise<CatalogueSnapshot> {
  return getCatalogue({
    adapter: fakeAdapter({
      result: queryResult({
        products: [
          productRow({
            slug: "route-dome",
            model: "ROUTE-DOME",
            categorySlug: "dome-cameras",
            categoryName: "Dome cameras",
            brandSlug: "cp-plus",
            brandName: "CP Plus",
          }),
          productRow({
            slug: "route-nvr",
            model: "ROUTE-NVR",
            categorySlug: "nvr-systems",
            categoryName: "NVR systems",
            brandSlug: "prama",
            brandName: "Prama",
          }),
        ],
      }),
    }),
    logger: recordingLogger(),
  });
}

beforeEach(() => {
  cacheCalls.count = 0;
});

// ─── Sitemap ──────────────────────────────────────────────────────────────

describe("sitemap", () => {
  it("lists canonical repository products, categories and brands", async () => {
    await useSnapshot(await databaseSnapshot());
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/products/route-dome"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/products/route-nvr"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/categories/dome-cameras"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/brands/prama"))).toBe(true);
    // No static product survives into an authoritative sitemap.
    expect(urls.some((url) => url.includes("cp-unc-da41l3c-d-q"))).toBe(false);
  });

  it("omits legacy slugs as separate pages", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [productRow({ slug: "canonical-one", legacySlugs: ["retired-one"] })],
        }),
      }),
      logger: recordingLogger(),
    });
    await useSnapshot(snapshot);
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/products/canonical-one"))).toBe(true);
    expect(urls.some((url) => url.includes("retired-one"))).toBe(false);
  });

  it("lists no catalogue entries for an authoritative empty database", async () => {
    await useSnapshot(
      await getCatalogue({
        adapter: fakeAdapter({ result: queryResult({ totalProductCount: 4 }) }),
        logger: recordingLogger(),
      }),
    );
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/products/"))).toBe(false);
    expect(urls.some((url) => url.includes("/categories/"))).toBe(false);
    // Static pages remain listed — the site still exists.
    expect(urls.some((url) => url.endsWith("/contact"))).toBe(true);
  });

  it("loads the catalogue once per generation", async () => {
    await useSnapshot(await databaseSnapshot());
    const { default: sitemap } = await import("@/app/sitemap");
    await sitemap();

    expect(cacheCalls.count).toBe(1);
  });
});

// ─── Degraded sentinel mechanism ──────────────────────────────────────────

describe("degraded snapshot handling", () => {
  it("produces a serialisable payload that still declares itself unverified", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ error: new CatalogueDatabaseError("query_failed", "NeonDbError") }),
      logger: recordingLogger(),
    });
    const payload = toCachePayload(snapshot);

    // What the sentinel carries: safe, serialisable, and still marked degraded.
    expect(payload.authority).toBe("static_degraded");
    expect(payload.pricingAuthority).toBe("unverified");
    expect(payload.productCount).toBeGreaterThan(0);
    expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
    const text = JSON.stringify(payload);
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("stack");
  });

  it("keeps a degraded catalogue browseable", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ error: new CatalogueDatabaseError("unavailable", "NeonDbError") }),
      logger: recordingLogger(),
    });

    expect(snapshot.authority).toBe("static_degraded");
    expect(snapshot.products.length).toBeGreaterThan(0);
    expect(snapshot.bySlug.size).toBeGreaterThan(0);
  });

  it("distinguishes bootstrap from degraded, so bootstrap shows no failure notice", async () => {
    const bootstrap = await getCatalogue({
      adapter: fakeAdapter({ configured: false }),
      logger: recordingLogger(),
    });

    expect(bootstrap.authority).toBe("static_bootstrap");
    // The notice is rendered on `static_degraded` only, so an unconfigured local
    // or demo environment shows nothing.
    expect(bootstrap.authority === "static_degraded").toBe(false);
    expect(bootstrap.products.length).toBeGreaterThan(0);
  });
});

// ─── Import-graph audits ──────────────────────────────────────────────────

const SRC = path.join(process.cwd(), "src");

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return walk(absolute);
    return /\.tsx?$/.test(absolute) ? [absolute] : [];
  });
}

const FILES = walk(SRC);

function relative(absolute: string): string {
  return path.relative(process.cwd(), absolute).replace(/\\/g, "/");
}

function directive(absolute: string): "use client" | "use server" | null {
  const header = readFileSync(absolute, "utf8").slice(0, 400);
  const match = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["'](use client|use server)["']/.exec(
    header,
  );
  return (match?.[1] as "use client" | "use server" | undefined) ?? null;
}

function importsStaticCatalogue(absolute: string): boolean {
  return /from\s+["']@\/data\/catalog["']/.test(readFileSync(absolute, "utf8"));
}

/**
 * The only server modules allowed to keep importing the static catalogue.
 * `catalogue-static` *is* the fallback source; the orchestrator's import is
 * confined to dev-only test-mode checkout.
 */
const ALLOWED_SERVER_STATIC_IMPORTERS = [
  "src/data/catalogue-static.ts",
  "src/lib/checkout-orchestrator.ts",
];

describe("import graph after cutover", () => {
  it("leaves no server route or server helper importing the static catalogue", () => {
    const offenders = FILES.filter(
      (file) =>
        directive(file) !== "use client" &&
        importsStaticCatalogue(file) &&
        !ALLOWED_SERVER_STATIC_IMPORTERS.includes(relative(file)),
    ).map(relative);

    expect(offenders).toEqual([]);
  });

  it("has every cut-over route reading the canonical cache", () => {
    const expected = [
      "src/app/page.tsx",
      "src/app/products/page.tsx",
      "src/app/products/[slug]/page.tsx",
      "src/app/categories/[slug]/page.tsx",
      "src/app/brands/page.tsx",
      "src/app/brands/[slug]/page.tsx",
      "src/app/downloads/page.tsx",
      "src/app/sitemap.ts",
    ];

    for (const route of expected) {
      const source = readFileSync(path.join(process.cwd(), route), "utf8");
      expect(source, route).toMatch(/from\s+["']@\/data\/catalogue-cache["']/);
      expect(source, route).not.toMatch(/from\s+["']@\/data\/catalog["']/);
    }
  });

  it("keeps database and repository modules out of every client component", () => {
    const forbidden = /from\s+["']@\/(db\/|data\/repository|data\/catalogue-cache|data\/catalogue-db-adapter|lib\/env)/;
    const offenders = FILES.filter(
      (file) => directive(file) === "use client" && forbidden.test(readFileSync(file, "utf8")),
    ).map(relative);

    expect(offenders).toEqual([]);
  });

  it("records the client components still reading the static catalogue for M3", () => {
    const remaining = FILES.filter(
      (file) => directive(file) === "use client" && importsStaticCatalogue(file),
    ).map(relative);

    // Pinned deliberately: M3 migrates these, and this list must shrink to [].
    expect(remaining.sort()).toEqual([
      "src/app/cart/page.tsx",
      "src/components/add-to-cart.tsx",
      "src/components/cart-drawer.tsx",
      "src/components/checkout-form.tsx",
      "src/components/compare-toggle.tsx",
      "src/components/compare-tray.tsx",
      "src/components/comparison-page.tsx",
      "src/components/mobile-product-bar.tsx",
      "src/components/product-actions.tsx",
      "src/components/product-card.tsx",
      "src/components/product-search.tsx",
      "src/components/recently-viewed.tsx",
      "src/components/system-builder.tsx",
      "src/lib/cart-store.ts",
      "src/lib/compare-store.ts",
    ]);
  });
});

// ─── Rendering strategy audit ─────────────────────────────────────────────

describe("rendering strategy", () => {
  it("enumerates no catalogue routes at build time", () => {
    for (const route of [
      "src/app/products/[slug]/page.tsx",
      "src/app/categories/[slug]/page.tsx",
      "src/app/brands/[slug]/page.tsx",
    ]) {
      const source = readFileSync(path.join(process.cwd(), route), "utf8");
      // An exported `generateStaticParams` would freeze the static fallback into
      // the build and 404 any product created afterwards. Matched as an export
      // so a comment explaining its absence does not trip the check.
      expect(source, route).not.toMatch(/export\s+(async\s+)?function\s+generateStaticParams/);
      expect(source, route).not.toMatch(/export\s+const\s+generateStaticParams/);
      expect(source, route).toMatch(/export const dynamic = "force-dynamic"/);
    }
  });

  it("leaves auth, admin, checkout, order and API routes untouched", () => {
    const untouched = FILES.filter((file) => {
      const rel = relative(file);
      return (
        /^src\/app\/(login|signup|account|admin|api|checkout|order|cart|quote)\//.test(rel) ||
        rel === "src/app/admin/layout.tsx"
      );
    });

    for (const file of untouched) {
      expect(readFileSync(file, "utf8"), relative(file)).not.toMatch(
        /from\s+["']@\/data\/catalogue-cache["']/,
      );
    }
    expect(untouched.length).toBeGreaterThan(0);
  });
});
