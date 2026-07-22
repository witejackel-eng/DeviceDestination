import { catalogue } from "../src/data/catalog";
import { validateProductCatalogue } from "../src/lib/catalogue-validation";

const report = validateProductCatalogue(catalogue);
if (report.warnings.length) {
  console.warn(`Product validation completed with ${report.warnings.length} warning(s):`);
  report.warnings.forEach((warning) => console.warn(`- ${warning}`));
}
if (report.errors.length) {
  console.error(`Product validation failed with ${report.errors.length} issue(s):`);
  report.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(
  `Validated ${report.productCount} products: 0 duplicate IDs, 0 duplicate slugs, 0 duplicate models, 0 missing assets, 0 model mismatches, 0 broken related references, and 0 broken builder references.`,
);
