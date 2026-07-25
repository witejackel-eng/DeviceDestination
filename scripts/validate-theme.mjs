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

// The token contract. Components are expected to reference these rather than
// re-declaring raw values, so a token disappearing is a build-breaking change.
const requiredTokens = [
  // typography roles
  "--font-sans",
  "--font-mono",
  "--font-display",
  "--font-body",
  "--font-technical",
  // colour roles beyond the tangerine ramp
  "--canvas",
  "--surface",
  "--surface-raised",
  "--ink",
  "--ink-contrast",
  "--muted",
  "--line",
  "--success",
  "--warning",
  "--danger",
  // radius scale
  "--r-xs",
  "--r-sm",
  "--r-md",
  "--r-lg",
  "--r-xl",
  "--r-2xl",
  "--r-full",
  // spacing scale
  "--space-1",
  "--space-4",
  "--space-24",
  // elevation
  "--shadow-sm",
  "--shadow-md",
  // motion
  "--dur-micro",
  "--dur-enter",
  "--dur-content",
  "--dur-hero",
  "--stagger",
  "--ease-out-quint",
  "--ease-out-expo",
  "--ease-panel",
  "--ease-sharp",
  "--ease-standard",
  // layering
  "--z-sticky",
  "--z-header",
  "--z-overlay",
  "--z-panel",
];
const missingTokens = requiredTokens.filter((token) => !globals.includes(`${token}:`));
assert.deepEqual(missingTokens, [], `Missing design tokens in globals.css:\n${missingTokens.join("\n")}`);

// Motion values are declared twice — as CSS custom properties and as Motion
// transition tokens — so they are asserted to agree rather than drifting apart.
const motionConstants = readFileSync(join(root, "src/lib/motion/constants.ts"), "utf8");
const pairedEasings = [
  ["--ease-out-quint", "0.23, 1, 0.32, 1"],
  ["--ease-out-expo", "0.16, 1, 0.3, 1"],
  ["--ease-panel", "0.32, 0.72, 0, 1"],
  ["--ease-sharp", "0.4, 0.4, 0, 1"],
  ["--ease-standard", "0.22, 1, 0.36, 1"],
];
for (const [token, curve] of pairedEasings) {
  assert.ok(
    globals.includes(`${token}: cubic-bezier(${curve})`),
    `globals.css ${token} must be cubic-bezier(${curve})`,
  );
  assert.ok(
    motionConstants.includes(`[${curve}]`),
    `src/lib/motion/constants.ts must define the curve [${curve}] paired with ${token}`,
  );
}

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

/**
 * Retired typefaces. The project loads Plus Jakarta Sans and Geist Mono through
 * next/font, so a component must never pin an old family.
 *
 * These match declarations — a next/font import identifier, a quoted entry in a
 * font stack, or a Tailwind arbitrary value — rather than any mention, so that
 * comments explaining why a face was replaced do not trip the check.
 */
const retiredTypefaces = [
  /\bBarlow_Condensed\b/g,
  /\bManrope\s*\(/g,
  /["'[]Barlow[_ ]Condensed["'\]]/gi,
  /["'[]Manrope["'\]]/gi,
  /font-family:[^;]*\b(?:barlow|manrope)\b/gi,
];

const colourViolations = [];
const typefaceViolations = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const pattern of disallowed) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) colourViolations.push(`${relative(root, file)}: ${pattern.source}`);
  }
  for (const pattern of retiredTypefaces) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) typefaceViolations.push(`${relative(root, file)}: ${pattern.source}`);
  }
}

assert.deepEqual(
  colourViolations,
  [],
  `Off-palette branded orange found:\n${colourViolations.join("\n")}`,
);
assert.deepEqual(
  typefaceViolations,
  [],
  `Retired typeface declared; use Plus Jakarta Sans or Geist Mono via next/font:\n${typefaceViolations.join("\n")}`,
);
console.log(
  `Theme validation passed across ${files.length} source and theme files ` +
    `(${requiredTokens.length} design tokens, ${pairedEasings.length} paired easings).`,
);
