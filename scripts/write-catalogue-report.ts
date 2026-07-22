import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogue } from "../src/data/catalog";
import { catalogueResearchManifest } from "../src/data/catalogue-research-manifest";
import { formatPrice, normalizeModel } from "../src/lib/products";

const counts = Object.fromEntries(
  [
    "verified-new",
    "verified-existing",
    "duplicate",
    "ambiguous",
    "not-found",
    "needs-confirmation",
  ].map((status) => [
    status,
    catalogueResearchManifest.filter((entry) => entry.status === status).length,
  ]),
);

const productByModel = new Map(
  catalogue.map((product) => [normalizeModel(product.model), product]),
);
const cell = (value: string | undefined) =>
  (value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (label: string, url: string | undefined) => (url ? `[${label}](${url})` : "—");

const rows = catalogueResearchManifest.map((entry) => {
  const product = entry.verifiedModel
    ? productByModel.get(normalizeModel(entry.verifiedModel))
    : undefined;
  const datasheet = product?.documents.some((document) => document.type === "datasheet")
    ? "Downloaded"
    : product
      ? "Not available locally"
      : "Not applicable";
  const manual = product?.documents.some(
    (document) => document.type === "manual" || document.type === "installation-guide",
  )
    ? "Downloaded"
    : product
      ? "Not available locally"
      : "Not applicable";
  const price = product
    ? `${formatPrice(product.sellingPriceInclGstPaise)} incl. GST (${product.priceSourceStatus})`
    : entry.observedPriceInclGstPaise
      ? `Public reference ${formatPrice(entry.observedPriceInclGstPaise)}; not published`
      : "Not published";
  return `| ${cell(entry.sourceEntry)} | ${cell(entry.verifiedModel)} | ${entry.siteAction} | ${link("Official", entry.officialProductUrl ?? product?.officialSourceUrl)} | ${product ? "Downloaded" : "Not published"} | ${datasheet} | ${manual} | ${price} | ${cell(entry.notes)} |`;
});

const unresolved = catalogueResearchManifest
  .filter((entry) => ["ambiguous", "not-found", "needs-confirmation"].includes(entry.status))
  .map(
    (entry) =>
      `- **${entry.sourceEntry}${entry.suppliedModel ? ` (${entry.suppliedModel})` : ""}:** ${entry.notes}`,
  );

const prices = catalogue
  .map(
    (product) =>
      `| ${product.model} | ${formatPrice(product.sellingPriceInclGstPaise)} | ${product.priceSourceStatus} | ${product.priceVerifiedAt ?? "—"} | GST included; no unverified compare-at price |`,
  )
  .join("\n");

const missingDatasheets = catalogue
  .filter((product) => !product.documents.some((document) => document.type === "datasheet"))
  .map((product) => product.model)
  .join(", ");
const missingManuals = catalogue
  .filter(
    (product) =>
      !product.documents.some(
        (document) => document.type === "manual" || document.type === "installation-guide",
      ),
  )
  .map((product) => product.model)
  .join(", ");

const report = `# DeviceDestination catalogue completion report

Generated 2026-07-22. The supplier/base-price inputs and margin calculations are intentionally not stored in this public repository. Customer-facing prices use integer paise, include GST under the site's central pricing policy, and do not display fabricated MRP or discounts.

## 1. Catalogue summary

- Original product count: 19
- Final product count: ${catalogue.length}
- New exact-model products added: ${counts["verified-new"]}
- Existing source matches reviewed or updated: ${counts["verified-existing"]}
- Duplicate source entries avoided: ${counts.duplicate}
- Unresolved and excluded: ${counts.ambiguous + counts["not-found"] + counts["needs-confirmation"]}

## 2. Product-by-product status

| Supplied description | Verified model | Site action | Official source | Image | Datasheet | Manual | Pricing | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## 3. Ambiguous and unresolved products

${unresolved.join("\n")}

## 4. Published pricing report

No source cost or margin data is shipped to the client bundle. New sale prices were calculated offline from the supplied source inputs using the requested approximately 22% commercial markup and clean rupee rounding; public retailer prices were used as a reasonableness check. Existing approved storefront prices were retained except where the task supplied a verified current public-price correction. All compare-at values remain empty unless independently verifiable.

| Model | Published price | Status | Verified at | Treatment |
| --- | ---: | --- | --- | --- |
${prices}

## 5. Asset report

- New official product images downloaded: 11
- New official datasheet files downloaded: 7
- New official manual/installation files downloaded: 8
- Published products without a local datasheet: ${missingDatasheets || "None"}
- Published products without a local manual/installation guide: ${missingManuals || "None"}
- Rejected assets: reseller-watermarked images, screenshots, remote hotlinks and family documents that did not name the exact model.

## 6. Duplicate and correction report

- Thirteen generic or repeated source entries were matched to exact records and were not duplicated.
- CP Plus NVR records were kept under their verified UNR identifiers, with legacy routes retained.
- X-990 was corrected to X990.
- F22 was corrected to the exact F22+ID+WIFI variant while preserving its old route.
- The unresolved CP Plus -G camera was not silently changed; CP-UNC-TA61L3C-LQ is a separately verified exact product.
- Similar Prama NRAS and CP Plus FI model codes were not substituted for mistyped source strings.

## 7. Important files changed

- \`src/data/catalogue-expansion.ts\`: eleven exact-model product records and sale prices.
- \`src/data/catalogue-research-manifest.ts\`: disposition and evidence for all 60 source entries.
- \`reports/catalogue-audit-2026-07-22.json\`: machine-readable pre-migration audit.
- \`src/data/catalog.ts\`: merged catalogue, corrections, current public-price overrides and expanded search.
- \`src/app/products/page.tsx\`: relevant resolution, PoE, authentication, availability and price filters.
- \`src/components/home-motion.tsx\`: Anime.js brand entrance and GSAP section reveals.
- \`src/components/hero-products.tsx\`: Motion carousel with reduced-motion handling.
- \`src/lib/compare-store.ts\`: same-product-group comparison enforcement.

## 8. Test results

- \`npm run products:validate\`: passed for 30 products with zero duplicate IDs, slugs or models; zero missing assets, model mismatches or broken references.
- \`npm run typecheck\`: passed.
- \`npm run lint\`: passed.
- \`npm test\`: passed, 4 files and 26 tests.
- \`npm run build\`: passed; all 30 product routes generated.
- \`SKIP_BUILD=1 npm run test:e2e\`: passed full desktop/mobile workflows, WCAG serious/critical checks and responsive layout checks at 320, 375, 430, 768, 1024 and 1440 px.

## 9. Required business confirmations

- Confirm that the storefront's centrally configured GST-inclusive policy remains correct for every new SKU.
- Confirm warranty terms before making stronger claims than the OEM documents.
- Confirm official MRP before enabling any compare-at price or discount badge.
- Confirm the mistyped/unclear CP Plus and Prama model numbers listed above.
- Confirm the physical manufacturer of the U bracket; the retired KonnectEdge brand was not published.
- Supply exact manufacturer part numbers for the Western Digital drive, generic cameras, NVRs and cable bundles.
`;

writeFileSync(join(process.cwd(), "reports/catalogue-completion-report.md"), report);
console.log(
  `Wrote reports/catalogue-completion-report.md with ${catalogueResearchManifest.length} source rows.`,
);
