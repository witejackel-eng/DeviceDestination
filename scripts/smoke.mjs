import { spawn } from "node:child_process";

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  },
);
let logs = "";
server.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3100/");
      if (response.ok) return;
    } catch {
      /* server is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${logs}`);
}

try {
  await waitForServer();
  const checks = [
    ["/", "Security hardware."],
    ["/products?q=CP-UNR-108F1", "CP-UNR-108F1"],
    ["/products/cp-unr-108f1", "Inclusive of all taxes"],
    ["/contact", "Send a product enquiry"],
    ["/system-builder", "Compatible starting set"],
  ];
  for (const [route, expected] of checks) {
    const response = await fetch(`http://127.0.0.1:3100${route}`);
    const body = await response.text();
    if (!response.ok || !body.includes(expected))
      throw new Error(`${route} failed: ${response.status}, missing ${expected}`);
    console.log(`PASS ${route} ${response.status}`);
  }
  const legacy = await fetch("http://127.0.0.1:3100/products/cp-unc-108f1", { redirect: "manual" });
  if (
    ![307, 308].includes(legacy.status) ||
    !legacy.headers
      .get("location")
      ?.split(",")
      .map((value) => value.trim())
      .includes("/products/cp-unr-108f1")
  )
    throw new Error(`Legacy redirect failed: ${legacy.status} ${legacy.headers.get("location")}`);
  console.log("PASS legacy product redirect");
} finally {
  server.kill("SIGTERM");
}
