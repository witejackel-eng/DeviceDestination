import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogue } from "../src/data/catalog";
import { normalizeModel } from "../src/lib/products";

const source = path.join(process.cwd(), "private-data", "product-price-source.csv");
const output = path.join(process.cwd(), "private-data", "import-review.private.json");

function parseCsvLine(line: string) {
  return (
    line
      .match(/("[^"]*(?:""[^"]*)*"|[^,]*)(?:,|$)/g)
      ?.map((value) => value.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? []
  );
}

const text = await readFile(source, "utf8");
const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(headerLine).map((header) => header.trim().toLowerCase());
const modelIndex = headers.indexOf("model");
if (modelIndex < 0) throw new Error("Private import CSV must include a model column");
const existing = new Set(catalogue.map((product) => normalizeModel(product.model)));
const review = lines.map(parseCsvLine).map((row) => {
  const model = row[modelIndex]?.trim() ?? "";
  return {
    model,
    normalizedModel: model ? normalizeModel(model) : null,
    action: !model
      ? "unresolved-generic"
      : existing.has(normalizeModel(model))
        ? "deduplicate-existing"
        : "research-exact-model",
  };
});
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    { importedAt: new Date().toISOString(), source: path.basename(source), review },
    null,
    2,
  ),
);
console.log(
  `Prepared ${review.length} private rows for review. No product was automatically published.`,
);
