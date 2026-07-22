import { defineConfig, devices } from "@playwright/test";
import chromium, { inflate } from "@sparticuz/chromium";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrotliDecompress } from "node:zlib";

async function extractBrotliTar(archive: string, destination: string, marker: string) {
  if (existsSync(marker)) return;
  mkdirSync(destination, { recursive: true });
  const tar = spawn("tar", ["-x", "--no-same-owner", "-C", destination, "-f", "-"]);
  createReadStream(archive).pipe(createBrotliDecompress()).pipe(tar.stdin);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    tar.once("error", reject);
    tar.once("exit", resolve);
  });
  if (exitCode !== 0) throw new Error(`Could not unpack browser support archive: ${archive}`);
}

chromium.setGraphicsMode = false;
process.env.FONTCONFIG_PATH = join(tmpdir(), "fonts");
process.env.XDG_CACHE_HOME = join(tmpdir(), "playwright-cache");
mkdirSync(process.env.XDG_CACHE_HOME, { recursive: true });
const temporaryExecutable = join(tmpdir(), "chromium");
if (existsSync(temporaryExecutable) && statSync(temporaryExecutable).size === 0)
  unlinkSync(temporaryExecutable);
const bundleDirectory = join(
  dirname(fileURLToPath(import.meta.resolve("@sparticuz/chromium"))),
  "../bin",
);
await Promise.all([
  extractBrotliTar(
    join(bundleDirectory, "fonts.tar.br"),
    join(tmpdir(), "fonts"),
    join(tmpdir(), "fonts/fonts.conf"),
  ),
  extractBrotliTar(
    join(bundleDirectory, "swiftshader.tar.br"),
    tmpdir(),
    join(tmpdir(), "libGLESv2.so"),
  ),
]);
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (await inflate(join(bundleDirectory, "chromium.br")));
const browserArgs = chromium.args.filter(
  (argument) => argument !== "--single-process" && argument !== "--no-zygote",
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    launchOptions: { executablePath, args: browserArgs },
  },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
