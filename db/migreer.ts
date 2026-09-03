import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, databaseUrl, PGLITE_MAP } from "./index";

/**
 * Kleine migratieloper. `drizzle-kit push` vergelijkt het schema met de database en
 * stelt dan vragen die niet te beantwoorden zijn als er niemand kijkt -- daar liep
 * het elke keer op vast. Dit draait gewoon de SQL in `db/migraties` op volgorde en
 * houdt in een tabel bij wat al gedaan is, dus twee keer draaien kan geen kwaad.
 *
 *   npm run db:migreer
 *
 * Zonder DATABASE_URL gaat het naar de lokale PGlite, met naar wat daarin staat.
 */
const MAP = join(import.meta.dirname, "migraties");

/**
 * Zowel de Neon-verbinding als PGlite nemen één opdracht per keer aan, dus het
 * bestand wordt hier in losse opdrachten geknipt. Puntkomma's binnen tekst tussen
 * aanhalingstekens en in `$$`-blokken tellen niet mee als einde.
 */
function splitsOpdrachten(inhoud: string): string[] {
  const opdrachten: string[] = [];
  let huidig = "";
  let inTekst = false;
  let inDollar = false;

  for (let i = 0; i < inhoud.length; i++) {
    const teken = inhoud[i];

    if (!inTekst && !inDollar && teken === "-" && inhoud[i + 1] === "-") {
      while (i < inhoud.length && inhoud[i] !== "\n") i++;
      huidig += "\n";
      continue;
    }
    if (!inDollar && teken === "'") inTekst = !inTekst;
    if (!inTekst && teken === "$" && inhoud[i + 1] === "$") {
      inDollar = !inDollar;
      huidig += "$$";
      i++;
      continue;
    }
    if (teken === ";" && !inTekst && !inDollar) {
      if (huidig.trim()) opdrachten.push(huidig.trim());
      huidig = "";
      continue;
    }
    huidig += teken;
  }
  if (huidig.trim()) opdrachten.push(huidig.trim());
  return opdrachten;
}

async function main() {
  const doel = databaseUrl()
    ? "de ingestelde database"
    : `PGlite in ${PGLITE_MAP}`;
  console.log(`Migreren naar ${doel}.`);

  await db.execute(
    sql`create table if not exists migraties (
      naam text primary key,
      gedraaid_op timestamptz not null default now()
    )`,
  );

  const gedaan = new Set(
    (
      await db.execute<{ naam: string }>(sql`select naam from migraties`)
    ).rows.map((r) => r.naam),
  );

  const bestanden = readdirSync(MAP)
    .filter((naam) => naam.endsWith(".sql"))
    .sort();

  let nieuw = 0;
  for (const naam of bestanden) {
    if (gedaan.has(naam)) continue;
    process.stdout.write(`  ${naam} … `);
    for (const opdracht of splitsOpdrachten(readFileSync(join(MAP, naam), "utf8"))) {
      await db.execute(sql.raw(opdracht));
    }
    await db.execute(sql`insert into migraties (naam) values (${naam})`);
    console.log("klaar");
    nieuw++;
  }

  console.log(
    nieuw === 0
      ? "Niets te doen; alles stond er al."
      : `${nieuw} migratie${nieuw === 1 ? "" : "s"} gedraaid.`,
  );

  // PGlite houdt zijn werker open, dus zonder dit blijft het proces hangen.
  process.exit(0);
}

main().catch((fout) => {
  console.error(fout);
  process.exit(1);
});
