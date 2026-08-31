// Geen `server-only` hier: dit bestand wordt ook door db/smoke.ts gedraaid, dat buiten
// Next leeft. De barriere is `@/db` zelf, dat node-modules importeert en dus nooit in
// een clientbundel past. De echte geheimen staan in lib/auth.ts, dat de guard wel heeft.
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  budgetItems,
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
  /** Null zolang de regel nog aan geen begrotingspost hangt. */
  budgetItemId: number | null;
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
      budgetItemId: expenseLines.budgetItemId,
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
/** Wat er in een jaar per begrotingspost is uitgegeven. */
export function totaalPerPost(regels: readonly RegelRij[]) {
  const perId = new Map<number | null, number>();
  for (const regel of regels) {
    perId.set(
      regel.budgetItemId,
      (perId.get(regel.budgetItemId) ?? 0) + regel.bedragCent,
    );
  }
  return perId;
}

/** Voor het dashboard: alleen posten waar iets mee is, begroot of uitgegeven. */
export async function budgetOverzicht(jaar: number) {
  const alles = await begroting(jaar);
  return alles
    .filter((r) => r.begrootCent !== null || r.werkelijkCent > 0)
    .sort((a, b) => b.werkelijkCent - a.werkelijkCent);
}

/**
 * Alle posten, ook de lege: dat is wat het begrotingsscherm invult. Per post komen de
 * categorieën mee waar het geld heen ging, zodat een bedrag na te lopen is zonder
 * eerst naar de uitgavenlijst te hoeven.
 */
export async function begroting(jaar: number) {
  const [posten, begroot, regels] = await Promise.all([
    db.select().from(budgetItems).orderBy(asc(budgetItems.naam)),
    db.select().from(budgets).where(eq(budgets.jaar, jaar)),
    haalRegels(jaar),
  ]);
  const werkelijk = totaalPerPost(regels);
  const perPost = new Map(begroot.map((r) => [r.budgetItemId, r.bedragCent]));

  // Per post de categorieën, grootste bedrag eerst.
  const uitsplitsing = new Map<
    number,
    Map<number, { naam: string; kleur: string; cent: number }>
  >();
  for (const regel of regels) {
    if (regel.budgetItemId === null) continue;
    const perCategorie =
      uitsplitsing.get(regel.budgetItemId) ??
      new Map<number, { naam: string; kleur: string; cent: number }>();
    const huidig = perCategorie.get(regel.categoryId) ?? {
      naam: regel.categorieNaam,
      kleur: regel.kleur,
      cent: 0,
    };
    huidig.cent += regel.bedragCent;
    perCategorie.set(regel.categoryId, huidig);
    uitsplitsing.set(regel.budgetItemId, perCategorie);
  }

  return posten.map((post) => ({
    id: post.id,
    naam: post.naam,
    kleur: post.kleur,
    actief: post.actief,
    begrootCent: perPost.get(post.id) ?? null,
    werkelijkCent: werkelijk.get(post.id) ?? 0,
    categorieen: [...(uitsplitsing.get(post.id)?.entries() ?? [])]
      .map(([categoryId, rest]) => ({ categoryId, ...rest }))
      .sort((a, b) => b.cent - a.cent),
  }));
}

/**
 * Uitgaven die nog aan geen post hangen. Die tellen nergens in de begroting mee, dus
 * het begrotingsscherm hoort ze te laten zien in plaats van ze stil weg te laten.
 */
export async function nietToegewezen(jaar: number) {
  const regels = await haalRegels(jaar);
  const losse = regels.filter((r) => r.budgetItemId === null);
  return {
    aantal: new Set(losse.map((r) => r.expenseId)).size,
    cent: losse.reduce((som, r) => som + r.bedragCent, 0),
  };
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
  /** Een id, of "geen" voor alles wat nog aan geen post hangt. */
  post?: number | "geen";
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
    gevonden = gevonden.filter((r) => metCategorie.has(r.id));
  }

  // Ook de begrotingspost zit op regelniveau, dus dezelfde aanpak.
  if (filter.post !== undefined) {
    const metPost = new Set(
      (
        await db
          .selectDistinct({ expenseId: expenseLines.expenseId })
          .from(expenseLines)
          .where(
            filter.post === "geen"
              ? isNull(expenseLines.budgetItemId)
              : eq(expenseLines.budgetItemId, filter.post),
          )
      ).map((r) => r.expenseId),
    );
    gevonden = gevonden.filter((r) => metPost.has(r.id));
  }

  return metHoofdcategorie(gevonden);
}

/**
 * Een uitgave kan regels in meerdere categorieën hebben, en net zo goed in meerdere
 * begrotingsposten. Voor het groeperen en voor het label in de lijst telt telkens
 * waar het meeste geld naartoe ging.
 */
async function metHoofdcategorie<T extends { id: number }>(rijen: T[]) {
  const ids = rijen.map((r) => r.id);
  if (ids.length === 0) {
    return [] as (T & {
      hoofdcategorie: string;
      categorieKleur: string;
      hoofdpost: string;
    })[];
  }

  const [perCategorie, perPost] = await Promise.all([
    db
      .select({
        expenseId: expenseLines.expenseId,
        naam: categories.naam,
        kleur: categories.kleur,
        cent: sql<number>`sum(${expenseLines.bedragCent})::int`,
      })
      .from(expenseLines)
      .innerJoin(categories, eq(expenseLines.categoryId, categories.id))
      .where(inArray(expenseLines.expenseId, ids))
      .groupBy(expenseLines.expenseId, categories.id),
    db
      .select({
        expenseId: expenseLines.expenseId,
        naam: budgetItems.naam,
        cent: sql<number>`sum(${expenseLines.bedragCent})::int`,
      })
      .from(expenseLines)
      .innerJoin(budgetItems, eq(expenseLines.budgetItemId, budgetItems.id))
      .where(inArray(expenseLines.expenseId, ids))
      .groupBy(expenseLines.expenseId, budgetItems.id),
  ]);

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

  const grootstePost = new Map<number, { naam: string; cent: number }>();
  for (const rij of perPost) {
    const huidig = grootstePost.get(rij.expenseId);
    if (!huidig || rij.cent > huidig.cent) {
      grootstePost.set(rij.expenseId, { naam: rij.naam, cent: rij.cent });
    }
  }

  return rijen.map((rij) => ({
    ...rij,
    hoofdcategorie: grootste.get(rij.id)?.naam ?? "Zonder categorie",
    categorieKleur: grootste.get(rij.id)?.kleur ?? "#64748b",
    hoofdpost: grootstePost.get(rij.id)?.naam ?? "Geen begrotingspost",
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

