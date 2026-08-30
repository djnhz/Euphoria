// Geen `server-only` hier: dit bestand wordt ook door db/smoke.ts gedraaid, dat buiten
// Next leeft. De barriere is `@/db` zelf, dat node-modules importeert en dus nooit in
// een clientbundel past. De echte geheimen staan in lib/auth.ts, dat de guard wel heeft.
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  budgets,
  categories,
  couples,
  documents,
  expenseLines,
  expenses,
  users,
} from "@/db";
import { saldoCent, verdeelRegel, type SaldoRegel } from "./geld";
import type { Sortering } from "./sorteren";

/**
 * Alle dashboardcijfers komen uit deze ene platte query. Aggregeren gebeurt daarna in
 * JavaScript met dezelfde `verdeelRegel` die de test dekt, in plaats van de
 * afrondingsregel een tweede keer in SQL te herhalen.
 */
export type RegelRij = {
  lineId: number;
  expenseId: number;
  datum: string;
  leverancier: string;
  omschrijving: string;
  bedragCent: number;
  aandeelAPct: number;
  categoryId: number;
  categorieNaam: string;
  kleur: string;
  betaaldDoorA: boolean;
};

export async function haalRegels(jaar?: number): Promise<RegelRij[]> {
  const filter =
    jaar === undefined
      ? undefined
      : and(
          gte(expenses.datum, `${jaar}-01-01`),
          lte(expenses.datum, `${jaar}-12-31`),
        );

  return db
    .select({
      lineId: expenseLines.id,
      expenseId: expenses.id,
      datum: expenses.datum,
      leverancier: expenses.leverancier,
      omschrijving: expenseLines.omschrijving,
      bedragCent: expenseLines.bedragCent,
      aandeelAPct: expenseLines.aandeelAPct,
      categoryId: categories.id,
      categorieNaam: categories.naam,
      kleur: categories.kleur,
      betaaldDoorA: sql<boolean>`${couples.volgorde} = 1`,
    })
    .from(expenseLines)
    .innerJoin(expenses, eq(expenseLines.expenseId, expenses.id))
    .innerJoin(couples, eq(expenses.coupleId, couples.id))
    .innerJoin(categories, eq(expenseLines.categoryId, categories.id))
    .where(filter)
    .orderBy(asc(expenses.datum), asc(expenseLines.volgorde));
}

export function saldoUitRegels(regels: readonly SaldoRegel[]) {
  return saldoCent(regels);
}

export function totaalPerCategorie(regels: readonly RegelRij[]) {
  const perId = new Map<number, { naam: string; kleur: string; cent: number }>();
  for (const regel of regels) {
    const huidig = perId.get(regel.categoryId) ?? {
      naam: regel.categorieNaam,
      kleur: regel.kleur,
      cent: 0,
    };
    huidig.cent += regel.bedragCent;
    perId.set(regel.categoryId, huidig);
  }
  return [...perId.entries()]
    .map(([categoryId, rest]) => ({ categoryId, ...rest }))
    .sort((a, b) => b.cent - a.cent);
}

/** Twaalf maanden, per huishouden wat dat huishouden zelf draagt (niet wat het voorschoot). */
export function perMaandPerHuishouden(regels: readonly RegelRij[]) {
  const a = Array<number>(12).fill(0);
  const b = Array<number>(12).fill(0);
  for (const regel of regels) {
    const maand = Number(regel.datum.slice(5, 7)) - 1;
    const { deelA, deelB } = verdeelRegel(regel.bedragCent, regel.aandeelAPct);
    a[maand] += deelA;
    b[maand] += deelB;
  }
  return { a, b };
}

/** Cumulatief saldo aan het eind van elke maand. */
export function saldoPerMaand(regels: readonly RegelRij[]) {
  const perMaand = Array<number>(12).fill(0);
  for (const regel of regels) {
    const maand = Number(regel.datum.slice(5, 7)) - 1;
    perMaand[maand] += saldoCent([regel]);
  }
  let loper = 0;
  return perMaand.map((cent) => (loper += cent));
}

/**
 * Begroot bedrag naast werkelijke uitgaven, per onderdeel voor een jaar. Onderdelen
 * zonder begroting en zonder uitgaven blijven weg; die zeggen niets.
 */
export async function budgetOverzicht(jaar: number) {
  const [regels, alleCategorieen, begroot] = await Promise.all([
    haalRegels(jaar),
    db.select().from(categories).where(eq(categories.actief, true)),
    db.select().from(budgets).where(eq(budgets.jaar, jaar)),
  ]);
  const werkelijk = new Map(
    totaalPerCategorie(regels).map((r) => [r.categoryId, r.cent]),
  );
  const perCategorie = new Map(begroot.map((r) => [r.categoryId, r.bedragCent]));

  return alleCategorieen
    .map((categorie) => ({
      ...categorie,
      begrootCent: perCategorie.get(categorie.id) ?? null,
      werkelijkCent: werkelijk.get(categorie.id) ?? 0,
    }))
    .filter((r) => r.begrootCent !== null || r.werkelijkCent > 0)
    .sort((a, b) => b.werkelijkCent - a.werkelijkCent);
}

/** Alle onderdelen, ook de niet-begrote: dat is wat het begrotingsscherm invult. */
export async function begroting(jaar: number) {
  const [alleCategorieen, begroot, regels] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.naam)),
    db.select().from(budgets).where(eq(budgets.jaar, jaar)),
    haalRegels(jaar),
  ]);
  const werkelijk = new Map(
    totaalPerCategorie(regels).map((r) => [r.categoryId, r.cent]),
  );
  const perCategorie = new Map(begroot.map((r) => [r.categoryId, r.bedragCent]));

  return alleCategorieen.map((categorie) => ({
    id: categorie.id,
    naam: categorie.naam,
    kleur: categorie.kleur,
    actief: categorie.actief,
    begrootCent: perCategorie.get(categorie.id) ?? null,
    werkelijkCent: werkelijk.get(categorie.id) ?? 0,
  }));
}

/** Jaren waarvoor iets begroot is, zodat het jaaroverzicht ze kan aanbieden. */
export async function begroteJaren(): Promise<number[]> {
  const rijen = await db.selectDistinct({ jaar: budgets.jaar }).from(budgets);
  return rijen.map((r) => r.jaar);
}

export type UitgaveFilter = {
  jaar?: number;
  categoryId?: number;
  coupleId?: number;
  sortering?: Sortering;
};

/** De ORDER BY die bij een sortering hoort; het id erachter houdt hem stabiel. */
function volgorde(sortering: Sortering) {
  const totaal = sql`coalesce(sum(${expenseLines.bedragCent}), 0)`;
  switch (sortering) {
    case "datum-oud":
      return [asc(expenses.datum), asc(expenses.id)];
    case "bedrag-hoog":
      return [desc(totaal), desc(expenses.id)];
    case "bedrag-laag":
      return [asc(totaal), desc(expenses.id)];
    case "leverancier":
      return [asc(expenses.leverancier), desc(expenses.datum)];
    default:
      return [desc(expenses.datum), desc(expenses.id)];
  }
}

export async function uitgavenLijst(filter: UitgaveFilter = {}) {
  const voorwaarden = [];
  if (filter.jaar !== undefined) {
    voorwaarden.push(gte(expenses.datum, `${filter.jaar}-01-01`));
    voorwaarden.push(lte(expenses.datum, `${filter.jaar}-12-31`));
  }
  if (filter.coupleId !== undefined) {
    voorwaarden.push(eq(expenses.coupleId, filter.coupleId));
  }

  const rijen = await db
    .select({
      id: expenses.id,
      datum: expenses.datum,
      leverancier: expenses.leverancier,
      opmerking: expenses.opmerking,
      analyseStatus: expenses.analyseStatus,
      coupleId: expenses.coupleId,
      coupleNaam: couples.naam,
      betaaldDoorA: sql<boolean>`${couples.volgorde} = 1`,
      invoerder: users.naam,
      totaalCent: sql<number>`coalesce(sum(${expenseLines.bedragCent}), 0)::int`,
      regelCount: sql<number>`count(${expenseLines.id})::int`,
      heeftBon: sql<boolean>`bool_or(${documents.id} is not null)`,
    })
    .from(expenses)
    .innerJoin(couples, eq(expenses.coupleId, couples.id))
    .innerJoin(users, eq(expenses.userId, users.id))
    .leftJoin(expenseLines, eq(expenseLines.expenseId, expenses.id))
    .leftJoin(documents, eq(documents.expenseId, expenses.id))
    .where(voorwaarden.length ? and(...voorwaarden) : undefined)
    .groupBy(expenses.id, couples.id, users.id)
    .orderBy(...volgorde(filter.sortering ?? "datum-nieuw"));

  // Categoriefilter zit op regelniveau; na het groeperen filteren houdt de query simpel.
  // De sorteervolgorde blijft daarbij staan.
  let gevonden = rijen;
  if (filter.categoryId !== undefined) {
    const metCategorie = new Set(
      (
        await db
          .selectDistinct({ expenseId: expenseLines.expenseId })
          .from(expenseLines)
          .where(eq(expenseLines.categoryId, filter.categoryId))
      ).map((r) => r.expenseId),
    );
    gevonden = rijen.filter((r) => metCategorie.has(r.id));
  }

  return metHoofdcategorie(gevonden);
}

/**
 * Een uitgave kan regels in meerdere categorieën hebben. Voor het groeperen en voor het
 * label in de lijst telt de categorie waar het meeste geld naartoe ging.
 */
async function metHoofdcategorie<T extends { id: number }>(rijen: T[]) {
  const ids = rijen.map((r) => r.id);
  if (ids.length === 0) {
    return [] as (T & { hoofdcategorie: string; categorieKleur: string })[];
  }

  const perCategorie = await db
    .select({
      expenseId: expenseLines.expenseId,
      naam: categories.naam,
      kleur: categories.kleur,
      cent: sql<number>`sum(${expenseLines.bedragCent})::int`,
    })
    .from(expenseLines)
    .innerJoin(categories, eq(expenseLines.categoryId, categories.id))
    .where(inArray(expenseLines.expenseId, ids))
    .groupBy(expenseLines.expenseId, categories.id);

  const grootste = new Map<number, { naam: string; kleur: string; cent: number }>();
  for (const rij of perCategorie) {
    const huidig = grootste.get(rij.expenseId);
    if (!huidig || rij.cent > huidig.cent) {
      grootste.set(rij.expenseId, {
        naam: rij.naam,
        kleur: rij.kleur,
        cent: rij.cent,
      });
    }
  }

  return rijen.map((rij) => ({
    ...rij,
    hoofdcategorie: grootste.get(rij.id)?.naam ?? "Zonder categorie",
    categorieKleur: grootste.get(rij.id)?.kleur ?? "#64748b",
  }));
}

export async function uitgaveMetRegels(id: number) {
  const [uitgave] = await db
    .select({
      id: expenses.id,
      datum: expenses.datum,
      leverancier: expenses.leverancier,
      opmerking: expenses.opmerking,
      coupleId: expenses.coupleId,
      analyseStatus: expenses.analyseStatus,
      invoerder: users.naam,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .where(eq(expenses.id, id));
  if (!uitgave) return null;

  const [regels, bonnen] = await Promise.all([
    db
      .select()
      .from(expenseLines)
      .where(eq(expenseLines.expenseId, id))
      .orderBy(asc(expenseLines.volgorde), asc(expenseLines.id)),
    db.select().from(documents).where(eq(documents.expenseId, id)),
  ]);
  return { ...uitgave, regels, bonnen };
}

export async function beschikbareJaren(): Promise<number[]> {
  const rijen = await db
    .selectDistinct({ jaar: sql<string>`left(${expenses.datum}::text, 4)` })
    .from(expenses);
  const jaren = rijen.map((r) => Number(r.jaar));
  const nu = new Date().getFullYear();
  if (!jaren.includes(nu)) jaren.push(nu);
  return jaren.sort((a, b) => b - a);
}

