// Geen `server-only` hier: dit bestand wordt ook door db/smoke.ts gedraaid, dat buiten
// Next leeft. De barriere is `@/db` zelf, dat node-modules importeert en dus nooit in
// een clientbundel past. De echte geheimen staan in lib/auth.ts, dat de guard wel heeft.
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  categories,
  couples,
  documents,
  expenseLines,
  expenses,
  recurring,
  users,
} from "@/db";
import { saldoCent, verdeelRegel, type SaldoRegel } from "./geld";
import { vandaag, volgendeDatum } from "./datum";

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

export async function budgetOverzicht(jaar: number) {
  const [regels, alleCategorieen] = await Promise.all([
    haalRegels(jaar),
    db.select().from(categories).where(eq(categories.actief, true)),
  ]);
  const werkelijk = new Map(
    totaalPerCategorie(regels).map((r) => [r.categoryId, r.cent]),
  );
  return alleCategorieen
    .map((categorie) => ({
      ...categorie,
      werkelijkCent: werkelijk.get(categorie.id) ?? 0,
    }))
    .filter((r) => r.budgetJaarCent !== null || r.werkelijkCent > 0)
    .sort((a, b) => b.werkelijkCent - a.werkelijkCent);
}

export type UitgaveFilter = {
  jaar?: number;
  categoryId?: number;
  coupleId?: number;
};

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
    .orderBy(desc(expenses.datum), desc(expenses.id));

  // Categoriefilter zit op regelniveau; na het groeperen filteren houdt de query simpel.
  if (filter.categoryId === undefined) return rijen;
  const metCategorie = new Set(
    (
      await db
        .selectDistinct({ expenseId: expenseLines.expenseId })
        .from(expenseLines)
        .where(eq(expenseLines.categoryId, filter.categoryId))
    ).map((r) => r.expenseId),
  );
  return rijen.filter((r) => metCategorie.has(r.id));
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

/**
 * Vaste lasten worden lui aangemaakt bij het laden van het dashboard: geen cron, geen
 * scheduler. De voorwaardelijke UPDATE is de vergrendeling. Laden twee mensen
 * tegelijk, dan wint er precies een en ziet de ander nul gewijzigde rijen.
 *
 * ponytail: lui genereren bij paginabezoek. Vercel Cron pas als de app weken
 * ongebruikt blijft en er meldingen nodig zijn.
 */
export async function genereerVasteLasten(userId: number): Promise<number> {
  const nu = vandaag();
  const kandidaten = await db
    .select()
    .from(recurring)
    .where(and(eq(recurring.actief, true), lte(recurring.volgendeDatum, nu)));

  let aangemaakt = 0;
  for (const post of kandidaten) {
    let datum = post.volgendeDatum;
    while (datum <= nu) {
      const volgende = volgendeDatum(datum, post.interval);
      const gewonnen = await db
        .update(recurring)
        .set({ volgendeDatum: volgende })
        .where(
          and(eq(recurring.id, post.id), eq(recurring.volgendeDatum, datum)),
        )
        .returning({ id: recurring.id });
      if (gewonnen.length === 0) break; // iemand anders was ons voor

      const [uitgave] = await db
        .insert(expenses)
        .values({
          coupleId: post.coupleId,
          userId,
          datum,
          leverancier: post.omschrijving,
          opmerking: "Automatisch aangemaakt vanuit vaste lasten",
        })
        .returning({ id: expenses.id });
      await db.insert(expenseLines).values({
        expenseId: uitgave.id,
        omschrijving: post.omschrijving,
        bedragCent: post.bedragCent,
        categoryId: post.categoryId,
        aandeelAPct: post.aandeelAPct,
      });
      aangemaakt++;
      datum = volgende;
    }
  }
  return aangemaakt;
}
