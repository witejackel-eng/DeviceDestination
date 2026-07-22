import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!database) {
    database = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return database;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
