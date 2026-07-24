import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The application ships with two interchangeable database drivers:
 *
 *  - `neon-http` (default in production): uses `@neondatabase/serverless` and
 *    speaks to Neon over HTTP. This is the only driver that works against the
 *    production Neon database and against Vercel Postgres / Supabase HTTP.
 *  - `node-postgres`: uses the standard `pg` driver. This works against any
 *    local Postgres, the GitHub Actions Postgres service container, and any
 *    standard Postgres deployment. It supports real interactive transactions,
 *    `FOR UPDATE SKIP LOCKED`, advisory locks and other semantics that the
 *    Neon HTTP driver does not.
 *
 * The driver is chosen by:
 *
 *   1. `DB_DRIVER` env var (`neon-http` | `node-postgres`), if set; otherwise
 *   2. URL heuristics: any host that is not a Neon/Vercel/Supabase HTTP host
 *      (e.g. `localhost`, `127.0.0.1`, an internal IP) selects `node-postgres`.
 *
 * This dual-driver design lets the integration test suite exercise the real
 * production code paths against a local Postgres instance, while production
 * keeps using the optimised Neon HTTP driver.
 */

export type DbDriver = "neon-http" | "node-postgres";

let database: ReturnType<typeof typeofDrizzle> | null = null;
let pool: Pool | null = null;

// We can't easily type a union of two drizzle instances with the same schema,
// so we collapse to the common interface used by callers.
type AnyDb = ReturnType<typeof drizzle<typeof schema>> &
  ReturnType<typeof drizzleNode<typeof schema>>;
function typeofDrizzle() {
  return drizzle(neon("unused"), { schema });
}

function resolveDriver(url: string): DbDriver {
  const explicit = process.env.DB_DRIVER?.toLowerCase();
  if (explicit === "neon-http" || explicit === "node-postgres") return explicit;
  // Heuristic: Neon / Vercel / Supabase HTTP endpoints use these hosts.
  if (
    url.includes(".neon.tech") ||
    url.includes(".vercel.app") ||
    url.includes("db.supabase.co") ||
    url.includes("supabase.com")
  ) {
    return "neon-http";
  }
  // Everything else (localhost, 127.0.0.1, private IPs, RDS, etc.) uses pg.
  return "node-postgres";
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!database) {
    const url = process.env.DATABASE_URL;
    const driver = resolveDriver(url);
    if (driver === "neon-http") {
      database = drizzle(neon(url), { schema }) as unknown as AnyDb;
    } else {
      pool = new Pool({ connectionString: url, max: 10 });
      database = drizzleNode(pool, { schema }) as unknown as AnyDb;
    }
  }
  return database;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Close the underlying connection pool. Only used by integration tests to
 * release the worker cleanly. Safe to call when no DB was created.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  database = null;
}
