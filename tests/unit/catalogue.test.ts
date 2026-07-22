import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogue, searchProducts } from "@/data/catalog";
import { validateProductCatalogue } from "@/lib/catalogue-validation";
import { publicPageMetadata } from "@/lib/seo";

describe("catalogue integrity", () => {
  it("passes all critical exact-model checks", () => {
    const report = validateProductCatalogue(catalogue, {
      publicRoot: path.join(process.cwd(), "public"),
    });
    expect(report.errors).toEqual([]);
    expect(report.productCount).toBe(19);
    expect(report.modelMismatches).toEqual([]);
    expect(report.missingAssets).toEqual([]);
  });
  it("uses the corrected D-Q canonical route and keeps the old route as a redirect alias", () => {
    const product = catalogue.find((item) => item.model === "CP-UNC-DA41L3C-D-Q");
    expect(product?.slug).toBe("cp-unc-da41l3c-d-q");
    expect(product?.legacySlugs).toContain("cp-unc-da41l3c-q");
    expect(product?.images.every((image) => image.includes("DA41L3C-D-Q"))).toBe(true);
  });
  it("finds models with dashes, spaces or no separators", () => {
    for (const query of ["CP-UNC-DA41L3C-D-Q", "cp unc da41l3c d q", "cpuncda41l3cdq"])
      expect(searchProducts(query)[0]?.model).toBe("CP-UNC-DA41L3C-D-Q");
  });
});

describe("metadata", () => {
  it("emits the correct system-builder canonical", () => {
    const metadata = publicPageMetadata({
      title: "Builder",
      description: "Builder",
      path: "/system-builder",
    });
    expect(metadata.alternates).toEqual({ canonical: "/system-builder" });
  });
  it("marks private transactional pages noindex", () => {
    const metadata = publicPageMetadata({
      title: "Checkout",
      description: "Checkout",
      path: "/checkout",
      noIndex: true,
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
