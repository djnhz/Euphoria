import "dotenv/config";
import { db, couples, users, categories } from "./index";
import { hashPin } from "../lib/pin";

/** Pas deze namen aan voordat je seedt; wijzigen kan later ook via Instellingen. */
const HUISHOUDENS = [
  { naam: "Huishouden A", volgorde: 1, leden: ["Dirk-Jan", "Partner"] },
  { naam: "Huishouden B", volgorde: 2, leden: ["Vriend 1", "Vriend 2"] },
];

const CATEGORIEEN = [
  { naam: "Ligplaats", kleur: "#0ea5e9" },
  { naam: "Onderhoud", kleur: "#f97316" },
  { naam: "Brandstof", kleur: "#eab308" },
  { naam: "Verzekering", kleur: "#8b5cf6" },
  { naam: "Winterstalling", kleur: "#06b6d4" },
  { naam: "Uitrusting", kleur: "#22c55e" },
  { naam: "Overig", kleur: "#64748b" },
];

/** Vier verschillende pincodes, zodat er geen gedeelde standaardcode ontstaat. */
function willekeurigePin() {
  return String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
}

async function main() {
  if ((await db.select().from(couples)).length > 0) {
    console.log("Er staan al huishoudens in de database. Seed overgeslagen.");
    return;
  }

  await db.insert(categories).values(CATEGORIEEN);

  const startpins: string[] = [];
  for (const huishouden of HUISHOUDENS) {
    const [rij] = await db
      .insert(couples)
      .values({ naam: huishouden.naam, volgorde: huishouden.volgorde })
      .returning();
    for (const naam of huishouden.leden) {
      const pin = willekeurigePin();
      await db
        .insert(users)
        .values({ coupleId: rij.id, naam, ...(await hashPin(pin)) });
      startpins.push(`  ${naam.padEnd(12)} ${pin}`);
    }
  }

  console.log("Seed klaar. Startpincodes (wijzig ze na de eerste login):");
  console.log(startpins.join("\n"));
}

main().then(
  () => process.exit(0),
  (fout) => {
    console.error(fout);
    process.exit(1);
  },
);
