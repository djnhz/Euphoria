import "dotenv/config";
import { createConnection } from "node:net";
import { databaseUrl, PGLITE_MAP } from "./index";

/**
 * PGlite is single-writer. Draait de dev-server, dan houdt die de map open en maakt een
 * tweede proces de database stuk in plaats van netjes te wachten. Dat is een keer echt
 * gebeurd, dus dit is een grendel en geen waarschuwing.
 *
 * Met een echte DATABASE_URL speelt het niet: Postgres regelt meerdere schrijvers zelf.
 */
export async function vereisGeenDraaiendeServer(): Promise<void> {
  if (databaseUrl()) return;

  const poort = Number(process.env.PORT ?? 3000);
  if (!(await luistertIemand(poort))) return;

  console.error(
    [
      `Er luistert iets op poort ${poort}, waarschijnlijk de dev-server.`,
      `De lokale database in ${PGLITE_MAP} verdraagt maar een schrijver tegelijk.`,
      "Stop de dev-server, draai dit commando opnieuw en start hem daarna weer.",
    ].join("\n"),
  );
  process.exit(1);
}

function luistertIemand(poort: number): Promise<boolean> {
  return new Promise((klaar) => {
    const verbinding = createConnection({ port: poort, host: "127.0.0.1" })
      .setTimeout(500)
      .on("connect", () => {
        verbinding.destroy();
        klaar(true);
      })
      .on("timeout", () => {
        verbinding.destroy();
        klaar(false);
      })
      .on("error", () => klaar(false));
  });
}

// Ook bruikbaar als los commando, zodat `db:push` er ook langs moet.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("db/vrij.ts")) {
  void vereisGeenDraaiendeServer();
}
