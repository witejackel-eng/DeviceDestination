/**
 * Removes stale Next.js generated route-type artefacts before a type check or build.
 *
 * `next dev` writes `.next/dev/types/routes.d-<HOSTNAME>.ts` while `next build`
 * writes `.next/dev/types/routes.d.ts`. `tsconfig.json` includes
 * `.next/dev/types/**\/*.ts`, so when both survive in the same tree TypeScript sees
 * `PageProps` and `LayoutProps` declared twice (TS2428 / TS2300), and the older
 * file's `AppRoutes` union no longer covers routes added since it was written
 * (TS2344). Neither error comes from source code.
 *
 * This project lives in a OneDrive-synced folder, where deleted build artefacts
 * can be rehydrated, so the collision recurs. Keeping only the newest route
 * declaration is enough to clear it without discarding a usable cache.
 *
 * `--all` removes the whole `.next/dev` directory instead, for a hard reset.
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const devTypesDir = join(process.cwd(), ".next", "dev", "types");
const removeEverything = process.argv.includes("--all");

if (!existsSync(devTypesDir)) {
  console.log("clean-generated: nothing to clean.");
  process.exit(0);
}

if (removeEverything) {
  rmSync(join(process.cwd(), ".next", "dev"), { recursive: true, force: true });
  console.log("clean-generated: removed .next/dev");
  process.exit(0);
}

// Every file matching routes.d*.ts declares the same interfaces, so at most one
// may remain. Keep whichever was written last; it reflects the current routes.
const routeDeclarations = readdirSync(devTypesDir)
  .filter((name) => /^routes\.d.*\.ts$/.test(name))
  .map((name) => {
    const path = join(devTypesDir, name);
    return { name, path, modifiedAt: statSync(path).mtimeMs };
  })
  .sort((a, b) => b.modifiedAt - a.modifiedAt);

if (routeDeclarations.length < 2) {
  console.log("clean-generated: no duplicate route declarations.");
  process.exit(0);
}

for (const stale of routeDeclarations.slice(1)) {
  rmSync(stale.path, { force: true });
  console.log(`clean-generated: removed stale ${stale.name}`);
}
console.log(`clean-generated: kept ${routeDeclarations[0].name}`);
