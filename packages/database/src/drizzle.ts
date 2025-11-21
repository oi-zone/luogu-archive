import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./generated/drizzle/schema.js";

export * from "drizzle-orm";

export const db = drizzle({
  schema,
  connection: {
    connectionString: process.env.DATABASE_URL,
  },
});

export { schema };
