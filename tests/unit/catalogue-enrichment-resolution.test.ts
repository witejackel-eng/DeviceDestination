/**
 * Static enrichment identity resolution (M1.1).
 *
 * The real static catalogue deliberately contains no ambiguous identities —
 * `validateProductCatalogue` proves zero duplicate slugs and zero duplicate
 * normalised models. Precedence and ambiguity therefore cannot be exercised
 * against it, so this suite substitutes a small synthetic catalogue and tests
 * `resolveEnrichment` directly.
 *
 * End-to-end resolution against the real catalogue lives in
 * `catalogue-repository.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/products";

function syntheticProduct(overrides: Partial<Product> & Pick<Product, "slug" | "model">): Product {
  return {
    id: overrides.slug,
    legacySlugs: [],
    brand: "Synthetic",
    brandSlug: "synthetic",
    category: "Synthetic category",
    categorySlug: "synthetic-category",
    title: `Synthetic ${overrides.slug}`,
    shortDescription: "Synthetic short description.",
    longDescription: "Synthetic long description.",
    images: [`/images/products/${overrides.slug}.webp`],
    imageModel: overrides.model,
    documents: [],
    specs: {},
    highlights: [],
    useCases: [`${overrides.slug} use case`],
    stockStatus: "in_stock",
    sellingPriceInclGstPaise: 100_000,
    mrpInclGstPaise: null,
    compareAtPriceInclGstPaise: null,
    compareAtLabel: null,
    gstRateBasisPoints: 1800,
    gstIncluded: true,
    priceVerifiedAt: "2026-07-22T00:00:00.000Z",
    priceSourceStatus: "verified",
    officialSourceUrl: "https://example.com/synthetic",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    warrantySummary: "Synthetic warranty",
    relatedProductIds: [],
    builderCompatibleIds: [],
    builderExclusions: [],
    ...overrides,
  };
}

vi.mock("@/data/catalog", () => ({
  catalogue: [
    syntheticProduct({ slug: "alpha", model: "ALPHA-1", legacySlugs: ["alpha-old"] }),
    syntheticProduct({ slug: "beta", model: "BETA-1", legacySlugs: ["beta-old"] }),
    // These two collide on both a legacy slug and a normalised model.
    syntheticProduct({ slug: "gamma", model: "DUPLICATE-MODEL", legacySlugs: ["shared-legacy"] }),
    syntheticProduct({ slug: "delta", model: "duplicate model", legacySlugs: ["shared-legacy"] }),
  ],
}));

const { resolveEnrichment, resetStaticCatalogueCaches } = await import("@/data/catalogue-static");

function resolve(slug: string, legacySlugs: string[] = [], model = "UNMATCHED-MODEL") {
  return resolveEnrichment({ slug, legacySlugs, model });
}

beforeEach(() => {
  resetStaticCatalogueCaches();
});

describe("enrichment identity resolution", () => {
  it("matches on the canonical slug", () => {
    const result = resolve("alpha");

    expect(result.source).toBe("canonical_slug");
    expect(result.enrichment.useCases).toEqual(["alpha use case"]);
    expect(result.ambiguousVia).toBeNull();
  });

  it("matches on a legacy slug from either side", () => {
    // The database slug is recorded as a legacy slug on a static product.
    expect(resolve("alpha-old").source).toBe("legacy_slug");
    // The database product retired a slug that is still a static canonical slug.
    expect(resolve("renamed-in-admin", ["alpha"]).source).toBe("legacy_slug");
    // Both sides retired the same slug.
    expect(resolve("renamed-in-admin", ["alpha-old"]).source).toBe("legacy_slug");

    expect(resolve("alpha-old").enrichment.useCases).toEqual(["alpha use case"]);
    expect(resolve("renamed-in-admin", ["alpha"]).enrichment.useCases).toEqual(["alpha use case"]);
  });

  it("matches on the exact model under the project's model normalisation", () => {
    const exact = resolve("unknown-slug", [], "BETA-1");
    const normalised = resolve("unknown-slug", [], "beta 1");

    expect(exact.source).toBe("model");
    expect(exact.enrichment.useCases).toEqual(["beta use case"]);
    expect(normalised.source).toBe("model");
    expect(normalised.enrichment.useCases).toEqual(["beta use case"]);
  });

  it("prefers the canonical slug over legacy and model candidates", () => {
    const result = resolve("alpha", ["beta"], "BETA-1");

    expect(result.source).toBe("canonical_slug");
    expect(result.enrichment.useCases).toEqual(["alpha use case"]);
  });

  it("prefers a legacy slug over a model candidate", () => {
    const result = resolve("unknown-slug", ["beta"], "ALPHA-1");

    expect(result.source).toBe("legacy_slug");
    expect(result.enrichment.useCases).toEqual(["beta use case"]);
  });

  it("applies no enrichment when a legacy slug is ambiguous", () => {
    const result = resolve("shared-legacy");

    expect(result.source).toBe("ambiguous");
    expect(result.ambiguousVia).toBe("legacy_slug");
    expect(result.enrichment.useCases).toEqual([]);
    expect(result.enrichment.relatedProductIds).toEqual([]);
    expect(result.enrichment.builderExclusions).toEqual([]);
    expect(result.enrichment.images).toEqual([]);
  });

  it("applies no enrichment when a model is ambiguous", () => {
    const result = resolve("unknown-slug", [], "DUPLICATE-MODEL");

    expect(result.source).toBe("ambiguous");
    expect(result.ambiguousVia).toBe("model");
    expect(result.enrichment.useCases).toEqual([]);
  });

  it("does not treat one product reached by two routes as ambiguous", () => {
    // "alpha-old" is a static legacy slug and "alpha" is its canonical slug —
    // both point at the same product, so this is a match, not a collision.
    const result = resolve("alpha-old", ["alpha"], "ALPHA-1");

    expect(result.source).toBe("legacy_slug");
    expect(result.enrichment.useCases).toEqual(["alpha use case"]);
  });

  it("applies no enrichment when nothing matches", () => {
    const result = resolve("admin-created", ["never-existed"], "ADMIN-MODEL-1");

    expect(result.source).toBe("none");
    expect(result.ambiguousVia).toBeNull();
    expect(result.enrichment.useCases).toEqual([]);
    expect(result.enrichment.relatedProductIds).toEqual([]);
    expect(result.enrichment.builderExclusions).toEqual([]);
    expect(result.enrichment.builderCompatibleIds).toEqual([]);
    expect(result.enrichment.images).toEqual([]);
  });

  it("never matches on product name or description", () => {
    // The synthetic titles are "Synthetic alpha" etc. Nothing in the resolver
    // may reach them.
    expect(resolve("Synthetic alpha").source).toBe("none");
    expect(resolve("unknown", [], "Synthetic alpha").source).toBe("none");
    expect(resolve("unknown", [], "Synthetic short description.").source).toBe("none");
  });
});
