import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let verbinding: Db | null = null;

function verbind(): Db {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ontbreekt. Zet hem in .env.local of in de Vercel-omgeving.",
    );
  }
  verbinding ??= drizzle(neon(url), { schema });
  return verbinding;
}

/**
 * Pas bij het eerste gebruik verbinden. Zo draait `next build` ook zonder database,
 * wat scheelt bij een eerste deploy en in CI.
 */
export const db = new Proxy({} as Db, {
  get: (_doel, eigenschap) =>
    Reflect.get(verbind() as object, eigenschap) as unknown,
});

export * from "./schema";
