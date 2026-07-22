import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const extensions = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".svg", ".json", ".webmanifest"]);
const excluded = ["node_modules", ".next", "public/images", "public/docs", "reports"];
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const projectPath = relative(root, path).replaceAll("\\", "/");
    if (excluded.some((prefix) => projectPath === prefix || projectPath.startsWith(`${prefix}/`)))
      continue;
    if (entry.isDirectory()) walk(path);
    else if (extensions.has(extname(entry.name)) || entry.name.endsWith(".webmanifest"))
      files.push(path);
  }
}

walk(join(root, "src"));
walk(join(root, "public"));

const globals = readFileSync(join(root, "src/app/globals.css"), "utf8").toLowerCase();
for (const color of ["#ff8a00", "#ffa62b", "#ffb347"])
  assert.ok(globals.includes(color), `Missing canonical theme colour ${color}`);

const disallowed = [
  /#f97316/gi,
  /#ff7a1a/gi,
  /#ff6b00/gi,
  /#ff9900/gi,
  /rgba?\(255\s*,\s*165\s*,\s*0/gi,
  /rgba?\(255\s*,\s*122\s*,\s*26/gi,
  /rgba?\(255\s*,\s*138\s*,\s*0/gi,
  /(?:text|bg|border|shadow|from|to)-orange-/gi,
  /--tangerine-dark\b/gi,
];

const violations = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const pattern of disallowed) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) violations.push(`${relative(root, file)}: ${pattern.source}`);
  }
}

assert.deepEqual(violations, [], `Off-palette branded orange found:\n${violations.join("\n")}`);
console.log(`Theme validation passed across ${files.length} source and theme files.`);
