import "dotenv/config";
import assert from "node:assert/strict";
import { asc, inArray, like } from "drizzle-orm";
import {
  db,
  budgetItems,
  budgets,
  categories,
  couples,
  expenseLines,
  expenses,
  users,
} from "./index";
import { budgetOverzicht, haalRegels } from "../lib/data";
import { saldoCent } from "../lib/geld";
import { vandaag } from "../lib/datum";
import { vereisGeenDraaiendeServer } from "./vrij";

/**
 * Draait de databasepaden een keer echt: verdelen, saldo en de begroting naast de
 * werkelijke uitgaven. Alles wat dit script maakt draagt het merkteken hieronder en wordt
 * daarna weer opgeruimd, ook als er iets misgaat.
 */
const MERK = "[smoke]";

async function ruimOp() {
  const rommel = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(like(expenses.leverancier, `${MERK}%`));
  if (rommel.length > 0) {
    await db.delete(expenseLines).where(
      inArray(
        expenseLines.expenseId,
        rommel.map((r) => r.id),
      ),
    );
    await db.delete(expenses).where(
      inArray(
        expenses.id,
        rommel.map((r) => r.id),
      ),
    );
  }
  // De begrotingsrijen gaan mee met de post dankzij de cascade.
  await db.delete(budgetItems).where(like(budgetItems.naam, `${MERK}%`));
  await db.delete(categories).where(like(categories.naam, `${MERK}%`));
}

async function main() {
  await vereisGeenDraaiendeServer();

  const huishoudens = await db
    .select()
    .from(couples)
    .orderBy(asc(couples.volgorde));
  const [gebruiker] = await db.select().from(users).limit(1);
  assert.equal(huishoudens.length, 2, "verwacht twee huishoudens — seed eerst");
  assert.ok(gebruiker, "verwacht minstens een gebruiker — seed eerst");
  const [huishoudenA, huishoudenB] = huishoudens;

  await ruimOp();

  const [categorie] = await db
    .insert(categories)
    .values({ naam: `${MERK} test`, kleur: "#123456" })
    .returning();
  const [post] = await db
    .insert(budgetItems)
    .values({ naam: `${MERK} post`, kleur: "#123456" })
    .returning();

  const gemaakt: number[] = [];
  async function maakUitgave(
    coupleId: number,
    bedragCent: number,
    aandeelAPct: number,
  ) {
    const [uitgave] = await db
      .insert(expenses)
      .values({
        coupleId,
        userId: gebruiker.id,
        datum: vandaag(),
        leverancier: `${MERK} uitgave`,
      })
      .returning({ id: expenses.id });
    await db.insert(expenseLines).values({
      expenseId: uitgave.id,
      omschrijving: "regel",
      bedragCent,
      categoryId: categorie.id,
      budgetItemId: post.id,
      aandeelAPct,
    });
    gemaakt.push(uitgave.id);
    return uitgave.id;
  }

  // A schiet 100,00 voor, half om half. B schiet 30,00 voor, volledig voor A.
  // Netto houdt B 20,00 schuld over aan A.
  await maakUitgave(huishoudenA.id, 10_000, 50);
  await maakUitgave(huishoudenB.id, 3_000, 100);

  const regels = (await haalRegels()).filter((r) =>
    gemaakt.includes(r.expenseId),
  );
  assert.equal(regels.length, 2, "beide regels moeten terugkomen uit de join");
  assert.equal(saldoCent(regels), 2_000, "saldo moet 20,00 zijn");
  console.log("✔ verdelen en saldo kloppen tegen de echte database");

  // Begroting: wat erin gaat moet er naast de werkelijke uitgaven weer uitkomen.
  const jaar = Number(vandaag().slice(0, 4));
  await db
    .insert(budgets)
    .values({ jaar, budgetItemId: post.id, bedragCent: 20_000 })
    .onConflictDoUpdate({
      target: [budgets.jaar, budgets.budgetItemId],
      set: { bedragCent: 20_000 },
    });

  const overzicht = await budgetOverzicht(jaar);
  const regel = overzicht.find((r) => r.id === post.id);
  assert.ok(regel, "de begrote post hoort in het overzicht te staan");
  assert.equal(regel.begrootCent, 20_000, "begroot bedrag moet terugkomen");
  assert.equal(
    regel.werkelijkCent,
    13_000,
    "werkelijk moet de som van beide uitgaven zijn",
  );
  console.log("✔ begroting en werkelijke uitgaven komen naast elkaar terug");
}

main()
  .then(async () => {
    await ruimOp();
    console.log("Alles opgeruimd. Database is weer zoals hij was.");
    process.exit(0);
  })
  .catch(async (fout) => {
    await ruimOp().catch(() => {});
    console.error(fout);
    process.exit(1);
  });
