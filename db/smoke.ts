import "dotenv/config";
import assert from "node:assert/strict";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import {
  db,
  categories,
  couples,
  expenseLines,
  expenses,
  recurring,
  users,
} from "./index";
import { genereerVasteLasten, haalRegels } from "../lib/data";
import { saldoCent } from "../lib/geld";
import { vandaag } from "../lib/datum";

/**
 * Draait de databasepaden een keer echt: verdelen, saldo en het lui aanmaken van
 * vaste lasten. Alles wat dit script maakt draagt het merkteken hieronder en wordt
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
  await db.delete(recurring).where(like(recurring.omschrijving, `${MERK}%`));
  await db.delete(categories).where(like(categories.naam, `${MERK}%`));
}

async function main() {
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

  // Precies een jaar achterstallig: dat hoort twee uitgaven op te leveren, die van
  // vorig jaar en die van vandaag.
  const nu = vandaag();
  const dagDeel = nu.slice(4) === "-02-29" ? "-02-28" : nu.slice(4);
  const start = `${Number(nu.slice(0, 4)) - 1}${dagDeel}`;
  const [post] = await db
    .insert(recurring)
    .values({
      omschrijving: `${MERK} ligplaats`,
      categoryId: categorie.id,
      bedragCent: 5_000,
      interval: "jaar",
      volgendeDatum: start,
      coupleId: huishoudenA.id,
    })
    .returning();

  const aangemaakt = await genereerVasteLasten(gebruiker.id);
  assert.equal(aangemaakt, 2, "vorig jaar en vandaag horen allebei uit te rollen");

  const [na] = await db
    .select()
    .from(recurring)
    .where(eq(recurring.id, post.id));
  assert.ok(na.volgendeDatum > nu, "volgende datum moet voorbij vandaag liggen");

  // Nog een keer draaien mag niets meer opleveren.
  assert.equal(
    await genereerVasteLasten(gebruiker.id),
    0,
    "tweede keer draaien mag geen dubbele uitgave maken",
  );
  console.log("✔ vaste lasten rollen een keer uit en niet twee keer");

  const dubbel = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(
      and(
        like(expenses.leverancier, `${MERK} ligplaats`),
        eq(expenses.coupleId, huishoudenA.id),
      ),
    );
  assert.equal(dubbel.length, aangemaakt, "aantal uitgaven moet kloppen");
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
