import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./generated/drizzle/schema.js";

export * from "drizzle-orm";

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: boundedInteger("DB_POOL_MAX", 10, 1, 100),
  idleTimeoutMillis: boundedInteger(
    "DB_IDLE_TIMEOUT_MS",
    30_000,
    1_000,
    600_000,
  ),
  connectionTimeoutMillis: boundedInteger(
    "DB_CONNECTION_TIMEOUT_MS",
    5_000,
    250,
    60_000,
  ),
});

export const db = drizzle(pool, { schema });

export async function closeDb() {
  await pool.end();
}

export { schema };
