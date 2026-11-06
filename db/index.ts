import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

/** Map waarin de lokale PGlite-database staat als er geen `DATABASE_URL` is. */
export const PGLITE_MAP = "./.pglite";

/** Een lege omgevingsvariabele telt als niet ingevuld. */
export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url && url.trim() !== "" ? url : null;
}

let verbinding: Db | null = null;

function verbind(): Db {
  if (verbinding) return verbinding;

  const url = databaseUrl();
  if (url) {
    verbinding = drizzle(neon(url), { schema });
    return verbinding;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL ontbreekt. Zet hem in de Vercel-omgeving (Storage → Neon).",
    );
  }

  // Geen database ingesteld en we draaien lokaal: val terug op PGlite, een echte
  // Postgres gecompileerd naar WebAssembly, met de data in PGLITE_MAP. Bewust via
  // createRequire zodat de bundler dit ontwikkelpakket niet in de productiebuild trekt.
  const laad = createRequire(import.meta.url);
  const { PGlite } = laad("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = laad(
    "drizzle-orm/pglite",
  ) as typeof import("drizzle-orm/pglite");
  // Eén PGlite per proces, niet per module. Next bundelt pagina's en route handlers
  // (zoals /api/document) apart, elk met een eigen kopie van dit bestand. Kreeg elk
  // daarvan een eigen PGlite op dezelfde map, dan zag de route nieuwe rijen niet en
  // schreven twee databases door elkaar heen in één map -- tot hij "Aborted()" gaf.
  // Op globalThis staat hij één keer voor alle bundels, en ook na een hot reload.
  const gedeeld = globalThis as { __euphoriaPglite?: InstanceType<typeof PGlite> };
  if (!gedeeld.__euphoriaPglite) {
    console.warn(
      `[db] Geen DATABASE_URL — lokale PGlite in ${PGLITE_MAP}. Alleen voor ontwikkeling.`,
    );
    gedeeld.__euphoriaPglite = new PGlite(PGLITE_MAP);
  }
  // Beide drivers delen dezelfde PgDatabase-querybouwer; alleen het transport verschilt.
  verbinding = drizzlePglite(gedeeld.__euphoriaPglite, { schema }) as unknown as Db;
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
