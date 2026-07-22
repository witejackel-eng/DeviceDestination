import { products as sourceProducts } from "./seed-products-source";
import { exactCatalogueExpansion } from "./catalogue-expansion";
import {
  normaliseSearchTerm,
  normalizeModel,
  slugify,
  type Product,
  type ProductDocument,
} from "@/lib/products";

const verifiedAt = "2026-07-22T00:00:00.000Z";

const modelCorrections: Record<string, { model: string; slug: string }> = {
  "CP-UNC-DA41L3C-D-Q": { model: "CP-UNC-DA41L3C-D-Q", slug: "cp-unc-da41l3c-d-q" },
  "CP-UNC-108F1": { model: "CP-UNR-108F1", slug: "cp-unr-108f1" },
  "CP-UNC-4K2161": { model: "CP-UNR-4K2161-V2", slug: "cp-unr-4k2161-v2" },
  "X-990": { model: "X990", slug: "x-990" },
  F22: { model: "F22+ID+WIFI", slug: "essl-f22-id-wifi" },
};

const officialSources: Record<string, string> = {
  "CP-UNC-DA41L3C-D-Q": "https://cpplusworld.com/cp-unc-da41l3c-d-q",
  "CP-UNC-TA41L3C-Q": "https://cpplusworld.com/cp-unc-ta41l3c-q",
  "CP-UNC-DA41L3C-LQ": "https://cpplusworld.com/cp-unc-da41l3c-lq",
  "CP-UNC-TA41L3C-LQ": "https://cpplusworld.com/cp-unc-ta41l3c-lq",
  "CP-UNC-DA21L3C-Q": "https://cpplusworld.com/cp-unc-da21l3c-q",
  "CP-UNC-TA21L3C-Q": "https://cpplusworld.com/cp-unc-ta21l3c-q",
  "CP-UNC-DA21L3C-LQ": "https://cpplusworld.com/cp-unc-da21l3c-lq",
  "CP-UNC-TA21L3C-LQ": "https://cpplusworld.com/cp-unc-ta21l3c-lq",
  "CP-UNR-108F1": "https://cpplusworld.com/cp-unr-108f1",
  "CP-UNR-4K2161-V2": "https://cpplusworld.com/cp-unr-4k2161-v2",
  X990: "https://esslsecurity.com/fingerprint/x990",
  "F22+ID+WIFI": "https://esslsecurity.com/fingerprint/f22",
  F18: "https://esslsecurity.com/fingerprint/f18",
  SF100: "https://esslsecurity.com/fingerprint/sf100",
  "K30-PRO": "https://esslsecurity.com/fingerprint/k30",
  FR1200: "https://esslsecurity.com/fingerprint/fr1200",
  "K90-PRO": "https://esslsecurity.com/fingerprint/k90-pro",
  "AIFACE-MARS": "https://esslsecurity.com/face/aiface-mars",
  "AIFACE-MARS-+-HID": "https://esslsecurity.com/face/aiface-mars-hid",
};

const documents: Record<string, Omit<ProductDocument, "model">[]> = {
  "CP-UNC-DA41L3C-D-Q": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-DA41L3C-D-Q.pdf" },
    {
      type: "manual",
      title: "User manual",
      url: "/docs/manuals/CP-UNC-DA41L3C-D-Q user manual.pdf",
    },
  ],
  "CP-UNC-TA41L3C-Q": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-TA41L3C-Q.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-TA41L3C-Q-manual.pdf" },
  ],
  "CP-UNC-DA41L3C-LQ": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-DA41L3C-LQ.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-DA41L3C-LQ-manual.pdf" },
  ],
  "CP-UNC-TA41L3C-LQ": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-TA41L3C-LQ.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-TA41L3C-LQ-manual.pdf" },
  ],
  "CP-UNC-DA21L3C-Q": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-DA21L3C-Q.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-DA21L3C-Q-manual.pdf" },
  ],
  "CP-UNC-TA21L3C-Q": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-TA21L3C-Q.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-TA21L3C-Q user manual.pdf" },
  ],
  "CP-UNC-DA21L3C-LQ": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-DA21L3C-LQ.pdf" },
    {
      type: "manual",
      title: "User manual",
      url: "/docs/manuals/CP-UNC-DA21L3C-LQ user manual.pdf",
    },
  ],
  "CP-UNC-TA21L3C-LQ": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNC-TA21L3C-LQ.pdf" },
    {
      type: "manual",
      title: "User manual",
      url: "/docs/manuals/CP-UNC-TA21L3C-LQ  user manual.pdf",
    },
  ],
  "CP-UNR-108F1": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNR-108F1.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNR-108F1-manual.pdf" },
  ],
  "CP-UNR-4K2161-V2": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/CP-UNR-4K2161-V2.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNR-4K2161-V2-manual.pdf" },
  ],
  X990: [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/X990Catalog.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/X990_usermanual.pdf" },
  ],
  "F22+ID+WIFI": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/F22.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/F22_usermanual-.pdf" },
  ],
  F18: [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/F18.pdf" },
    { type: "manual", title: "User manual", url: "/docs/manuals/F18UserManual.pdf" },
  ],
  "K30-PRO": [{ type: "datasheet", title: "Datasheet", url: "/docs/datasheets/K30-Pro.pdf" }],
  FR1200: [{ type: "datasheet", title: "Datasheet", url: "/docs/datasheets/FR1200.pdf" }],
  "K90-PRO": [{ type: "datasheet", title: "Datasheet", url: "/docs/datasheets/K90-Pro.pdf" }],
  "AIFACE-MARS": [
    {
      type: "datasheet",
      title: "Datasheet",
      url: "/docs/datasheets/aiface-marscompressed_new.pdf",
    },
    { type: "manual", title: "User manual", url: "/docs/manuals/AiFace_Mars_usermanual.pdf" },
  ],
  "AIFACE-MARS-+-HID": [
    { type: "datasheet", title: "Datasheet", url: "/docs/datasheets/aiface-mars-hid.pdf" },
  ],
};

function sourceKey(model: string) {
  return normalizeModel(model);
}

const publicPriceOverrides: Record<
  string,
  { price: number; priceSourceStatus: Product["priceSourceStatus"] }
> = {
  SF100: { price: 825_000, priceSourceStatus: "verified" },
  FR1200: { price: 589_900, priceSourceStatus: "verified" },
};

const legacyCatalogue: Product[] = sourceProducts.map((source) => {
  const correction = modelCorrections[source.model];
  const model = correction?.model ?? source.model;
  const key = sourceKey(model);
  const categorySlug = slugify(source.category);
  const brandSlug = slugify(source.brand);
  const canonicalSlug = correction?.slug ?? source.id;
  const warrantySummary = source.specs.Warranty ?? "OEM warranty terms apply";

  const productDocuments = (documents[key] ?? []).map((document) => ({ ...document, model }));
  const publicPriceOverride = publicPriceOverrides[key];

  return {
    id: canonicalSlug,
    slug: canonicalSlug,
    legacySlugs: canonicalSlug === source.id ? [] : [source.id],
    model,
    brand: source.brand === "ESSL" ? "eSSL" : source.brand,
    brandSlug,
    category: source.category,
    categorySlug,
    title: source.name.replace(source.model, model),
    shortDescription: source.shortDescription,
    longDescription: `${source.shortDescription} Review the official specifications and compatibility notes before ordering for a project.`,
    images: source.images,
    imageModel: model,
    documents: productDocuments,
    specs: Object.fromEntries(
      Object.entries(source.specs).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    highlights: source.highlights,
    useCases: source.useCases,
    stockStatus: source.inStock ? "in_stock" : "lead_time",
    // The legacy storefront charged its tax-inclusive `mrp` field. Preserve that public amount,
    // but do not present it as verified MRP until documentary evidence is available.
    sellingPriceInclGstPaise: publicPriceOverride?.price ?? Math.round(source.mrp * 100),
    mrpInclGstPaise: null,
    compareAtPriceInclGstPaise: null,
    compareAtLabel: null,
    gstRateBasisPoints: 1800,
    gstIncluded: true,
    priceVerifiedAt: verifiedAt,
    priceSourceStatus: publicPriceOverride?.priceSourceStatus ?? "verified",
    officialSourceUrl: officialSources[key] ?? "https://esslsecurity.com/",
    verifiedAt,
    warrantySummary,
    relatedProductIds: [],
    builderCompatibleIds: categorySlug.includes("camera")
      ? ["cp-unr-108f1", "cp-unr-4k2161-v2"]
      : [],
    builderExclusions: categorySlug.includes("camera")
      ? ["HDD, PoE switching, cabling and installation require separate sizing"]
      : [],
  } satisfies Product;
});

export const catalogue: Product[] = [...legacyCatalogue, ...exactCatalogueExpansion];

export const catalogueBySlug = new Map(
  catalogue.flatMap((product) => [
    [product.slug, product] as const,
    ...product.legacySlugs.map((slug) => [slug, product] as const),
  ]),
);

export const categories = Array.from(
  new Map(catalogue.map((product) => [product.categorySlug, product.category])).entries(),
).map(([slug, name]) => ({ slug, name }));

export const brands = Array.from(
  new Map(catalogue.map((product) => [product.brandSlug, product.brand])).entries(),
).map(([slug, name]) => ({ slug, name }));

export function getProduct(slug: string) {
  return catalogueBySlug.get(slug);
}

export function searchProducts(query: string) {
  const normalized = query.trim().toLowerCase();
  const compact = normaliseSearchTerm(query);
  if (!normalized) return catalogue;
  return catalogue.filter((product) => {
    const text = [
      product.title,
      product.model,
      product.brand,
      product.category,
      product.shortDescription,
      ...product.highlights,
      ...product.useCases,
      ...Object.entries(product.specs).flatMap(([label, value]) => [label, value]),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(normalized) || normaliseSearchTerm(text).includes(compact);
  });
}
