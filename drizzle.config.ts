import type { Config } from "drizzle-kit";
import "dotenv/config";
import { databaseUrl, PGLITE_MAP } from "./db";

const url = databaseUrl();

/**
 * Zonder `DATABASE_URL` schrijft `drizzle-kit push` naar dezelfde lokale PGlite-map
 * die de app dan gebruikt, zodat ontwikkelen zonder cloudaccount werkt.
 */
export default (
  url
    ? {
        schema: "./db/schema.ts",
        out: "./db/migrations",
        dialect: "postgresql",
        dbCredentials: { url },
      }
    : {
        schema: "./db/schema.ts",
        out: "./db/migrations",
        dialect: "postgresql",
        driver: "pglite",
        dbCredentials: { url: PGLITE_MAP },
      }
) satisfies Config;
