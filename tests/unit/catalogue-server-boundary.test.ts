/**
 * Server boundary for the catalogue repository (M1).
 *
 * The repository and its database adapter must never be reachable from a
 * client component. `server-only` is not a dependency of this project, and its
 * default export throws under vitest, so the boundary is enforced with a static
 * import-graph walk instead: every `"use client"` module in `src/` is expanded
 * transitively and checked against the server-only module list.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.join(process.cwd(), "src");

/** Modules that load the database or environment and must stay server-side. */
const SERVER_ONLY_MODULES = [
  "src/data/repository.ts",
  "src/data/catalogue-db-adapter.ts",
  "src/db/client.ts",
];

/** Repository modules that are serialisable and may be imported by client code. */
const CLIENT_SAFE_MODULES = ["src/data/catalogue-types.ts", "src/data/catalogue-static.ts"];

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return walk(absolute);
    return /\.tsx?$/.test(absolute) ? [absolute] : [];
  });
}

const SOURCE_FILES = walk(SRC_ROOT);

function relative(absolute: string): string {
  return path.relative(process.cwd(), absolute).replace(/\\/g, "/");
}

function moduleDirective(absolute: string): "use client" | "use server" | null {
  const header = readFileSync(absolute, "utf8").slice(0, 400);
  const match = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["'](use client|use server)["']/.exec(
    header,
  );
  return (match?.[1] as "use client" | "use server" | undefined) ?? null;
}

function isClientModule(absolute: string): boolean {
  return moduleDirective(absolute) === "use client";
}

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC_ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null; // node_modules or a bare package — not part of this graph

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Candidate does not exist — try the next extension.
    }
  }
  return null;
}

const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*|\bimport\()\s*["']([^"']+)["']/g;

function importsOf(absolute: string): string[] {
  const source = readFileSync(absolute, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const resolved = resolveSpecifier(match[1], absolute);
    if (resolved) specifiers.push(resolved);
  }
  return specifiers;
}

/** Breadth-first search returning the first import chain that reaches a target. */
function findPathToServerModule(entry: string, targets: ReadonlySet<string>): string[] | null {
  const queue: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [entry] }];
  const seen = new Set<string>([entry]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of importsOf(current.file)) {
      if (seen.has(next)) continue;
      seen.add(next);
      const chain = [...current.chain, next];
      if (targets.has(relative(next))) return chain.map(relative);
      // A `"use server"` module is an RPC boundary, not a bundling edge: Next.js
      // replaces the import with a server reference, so nothing behind it ships
      // to the browser. Stop the walk there.
      if (moduleDirective(next) === "use server") continue;
      queue.push({ file: next, chain });
    }
  }
  return null;
}

describe("catalogue repository server boundary", () => {
  it("finds client components to check", () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(0);
    expect(SOURCE_FILES.filter(isClientModule).length).toBeGreaterThan(0);
  });

  it("detects a reachable module, proving the walk is not vacuous", () => {
    // `@/lib/products` is genuinely imported by client components, so a walk
    // that cannot find it would mean the graph resolution is broken.
    const clientModules = SOURCE_FILES.filter(isClientModule);
    const found = clientModules.some((file) =>
      findPathToServerModule(file, new Set(["src/lib/products.ts"])),
    );
    expect(found).toBe(true);
  });

  it("is never reachable from a client component", () => {
    const targets = new Set(SERVER_ONLY_MODULES);
    const violations: string[] = [];

    for (const file of SOURCE_FILES.filter(isClientModule)) {
      const chain = findPathToServerModule(file, targets);
      if (chain) violations.push(chain.join(" → "));
    }

    expect(violations).toEqual([]);
  });

  it("declares no client directive in any repository module", () => {
    for (const modulePath of [...SERVER_ONLY_MODULES, ...CLIENT_SAFE_MODULES]) {
      const absolute = path.join(process.cwd(), modulePath);
      expect(isClientModule(absolute)).toBe(false);
    }
  });

  it("keeps the shared catalogue types free of database imports", () => {
    for (const modulePath of CLIENT_SAFE_MODULES) {
      const absolute = path.join(process.cwd(), modulePath);
      const reachable = new Set<string>();
      const queue = [absolute];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const next of importsOf(current)) {
          if (reachable.has(next)) continue;
          reachable.add(next);
          queue.push(next);
        }
      }
      const forbidden = [...reachable]
        .map(relative)
        .filter((file) => file.startsWith("src/db/") || SERVER_ONLY_MODULES.includes(file));
      expect(forbidden).toEqual([]);
    }
  });
});
