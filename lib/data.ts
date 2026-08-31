// Geen `server-only` hier: dit bestand wordt ook door db/smoke.ts gedraaid, dat buiten
// Next leeft. De barriere is `@/db` zelf, dat node-modules importeert en dus nooit in
// een clientbundel past. De echte geheimen staan in lib/auth.ts, dat de guard wel heeft.
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  budgets,
  couples,
  documents,
  expenseLines,
  expenses,
  posten,
  users,
} from "@/db";
import { saldoCent, type SaldoRegel } from "./geld";
import type { Sortering } from "./sorteren";

/**
 * Alle dashboardcijfers komen uit deze ene platte query. Aggregeren gebeurt daarna in
 * JavaScript, in plaats van de rekenregels een tweede keer in SQL te herhalen.
 */
export type RegelRij = {
  lineId: number;
  expenseId: number;
  datum: string;
  leverancier: string;
  omschrijving: string;
  bedragCent: number;
  aandeelAPct: number;
  /** De post waarop de regel drukt; kan een hoofdpost of een subpost zijn. */
  postId: number;
  postNaam: string;
  kleur: string;
  /** De hoofdpost erboven, of de post zelf als die er geen ouder heeft. */
  hoofdpostId: number;
  hoofdpostNaam: string;
  hoofdpostKleur: string;
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

  // Tweede keer dezelfde tabel voor de ouder; zonder alias verwart Postgres ze.
  const ouder = alias(posten, "ouder");

  return db
    .select({
      lineId: expenseLines.id,
      expenseId: expenses.id,
      datum: expenses.datum,
      leverancier: expenses.leverancier,
      omschrijving: expenseLines.omschrijving,
      bedragCent: expenseLines.bedragCent,
      aandeelAPct: expenseLines.aandeelAPct,
      postId: posten.id,
      postNaam: posten.naam,
      kleur: posten.kleur,
      hoofdpostId: sql<number>`coalesce(${ouder.id}, ${posten.id})`,
      hoofdpostNaam: sql<string>`coalesce(${ouder.naam}, ${posten.naam})`,
      hoofdpostKleur: sql<string>`coalesce(${ouder.kleur}, ${posten.kleur})`,
      betaaldDoorA: sql<boolean>`${couples.volgorde} = 1`,
    })
    .from(expenseLines)
    .innerJoin(expenses, eq(expenseLines.expenseId, expenses.id))
    .innerJoin(couples, eq(expenses.coupleId, couples.id))
    .innerJoin(posten, eq(expenseLines.postId, posten.id))
    .leftJoin(ouder, eq(posten.ouderId, ouder.id))
    .where(filter)
    .orderBy(asc(expenses.datum), asc(expenseLines.volgorde));
}

export function saldoUitRegels(regels: readonly SaldoRegel[]) {
  return saldoCent(regels);
}

/**
 * Voor de grafiek: opgeteld per hoofdpost. Een subpost telt mee bij zijn hoofdpost,
 * anders valt een taartpunt uiteen in stukjes die los niets zeggen.
 */
export function totaalPerHoofdpost(regels: readonly RegelRij[]) {
  const perId = new Map<number, { naam: string; kleur: string; cent: number }>();
  for (const regel of regels) {
    const huidig = perId.get(regel.hoofdpostId) ?? {
      naam: regel.hoofdpostNaam,
      kleur: regel.hoofdpostKleur,
      cent: 0,
    };
    huidig.cent += regel.bedragCent;
    perId.set(regel.hoofdpostId, huidig);
  }
  return [...perId.entries()]
    .map(([postId, rest]) => ({ postId, ...rest }))
    .sort((a, b) => b.cent - a.cent);
}

/**
 * Twaalf maanden, per huishouden wat dat huishouden heeft voorgeschoten. Wie wat
 * draagt is altijd half om half en dus geen grafiek waard; wie het geld heeft
 * uitgegeven wel.
 */
export function perMaandPerBetaler(regels: readonly RegelRij[]) {
  const a = Array<number>(12).fill(0);
  const b = Array<number>(12).fill(0);
  for (const regel of regels) {
    const maand = Number(regel.datum.slice(5, 7)) - 1;
    if (regel.betaaldDoorA) a[maand] += regel.bedragCent;
    else b[maand] += regel.bedragCent;
  }
  return { a, b };
}

/** Wat elk huishouden dit jaar heeft voorgeschoten, als twee getallen. */
export function voorgeschotenPerHuishouden(regels: readonly RegelRij[]) {
  let a = 0;
  let b = 0;
  for (const regel of regels) {
    if (regel.betaaldDoorA) a += regel.bedragCent;
    else b += regel.bedragCent;
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

export type BegrotingsRegel = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  /** Null voor een hoofdpost. */
  ouderId: number | null;
  begrootCent: number | null;
  /** Alleen wat rechtstreeks op deze post is geboekt. */
  eigenCent: number;
  /** Inclusief de subposten eronder; voor een subpost gelijk aan `eigenCent`. */
  werkelijkCent: number;
  /**
   * Doet deze post dit jaar mee: er staat een bedrag voor, er is op geboekt, of een
   * subpost eronder doet mee. Een post die je pas volgend jaar gaat gebruiken hoort
   * niet in het overzicht van dit jaar te staan.
   */
  inGebruik: boolean;
  subposten: BegrotingsRegel[];
};

/**
 * De begroting van een jaar als boom: hoofdposten met hun subposten eronder, elk met
 * het begrote bedrag en wat er werkelijk is uitgegeven. Een hoofdpost telt de
 * subposten mee, want dat is wat je van een hoofdpost wilt weten.
 */
export async function begroting(jaar: number): Promise<BegrotingsRegel[]> {
  const [alle, begroot, regels] = await Promise.all([
    db.select().from(posten).orderBy(asc(posten.naam)),
    db.select().from(budgets).where(eq(budgets.jaar, jaar)),
    haalRegels(jaar),
  ]);

  const perPost = new Map(begroot.map((r) => [r.postId, r.bedragCent]));
  const eigen = new Map<number, number>();
  for (const regel of regels) {
    eigen.set(regel.postId, (eigen.get(regel.postId) ?? 0) + regel.bedragCent);
  }

  function maakRegel(post: (typeof alle)[number]): BegrotingsRegel {
    const subposten = alle
      .filter((p) => p.ouderId === post.id)
      .map((p) => maakRegel(p));
    const eigenCent = eigen.get(post.id) ?? 0;
    const begrootCent = perPost.get(post.id) ?? null;
    return {
      id: post.id,
      naam: post.naam,
      kleur: post.kleur,
      actief: post.actief,
      ouderId: post.ouderId,
      begrootCent,
      eigenCent,
      werkelijkCent:
        eigenCent + subposten.reduce((som, s) => som + s.werkelijkCent, 0),
      inGebruik:
        begrootCent !== null ||
        eigenCent > 0 ||
        subposten.some((sub) => sub.inGebruik),
      subposten,
    };
  }

  return alle.filter((p) => p.ouderId === null).map((p) => maakRegel(p));
}

/** Voor het dashboard: alleen hoofdposten waar iets mee is, begroot of uitgegeven. */
export async function budgetOverzicht(jaar: number) {
  const boom = await begroting(jaar);
  return boom
    .map((post) => ({
      ...post,
      // Een hoofdpost zonder eigen bedrag maar met begrote subposten hoort ook mee te
      // tellen, anders lijkt hij niet begroot.
      begrootCent: totaalBegroot(post),
    }))
    .filter((r) => r.begrootCent !== null || r.werkelijkCent > 0)
    .sort((a, b) => b.werkelijkCent - a.werkelijkCent);
}

/** Begroot op deze post plus alles wat eronder hangt; null als nergens iets staat. */
export function totaalBegroot(regel: BegrotingsRegel): number | null {
  const delen = [
    regel.begrootCent,
    ...regel.subposten.map((s) => totaalBegroot(s)),
  ].filter((cent): cent is number => cent !== null);
  return delen.length === 0 ? null : delen.reduce((som, cent) => som + cent, 0);
}

/** Jaren waarvoor iets begroot is, zodat het jaaroverzicht ze kan aanbieden. */
export async function begroteJaren(): Promise<number[]> {
  const rijen = await db.selectDistinct({ jaar: budgets.jaar }).from(budgets);
  return rijen.map((r) => r.jaar);
}

export type UitgaveFilter = {
  jaar?: number;
  /** Een post; subposten tellen mee als je een hoofdpost kiest. */
  postId?: number;
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

  // De post zit op regelniveau; na het groeperen filteren houdt de query simpel. De
  // sorteervolgorde blijft daarbij staan.
  let gevonden = rijen;
  if (filter.postId !== undefined) {
    // Een hoofdpost betekent: ook alles wat op zijn subposten staat.
    const kinderen = await db
      .select({ id: posten.id })
      .from(posten)
      .where(eq(posten.ouderId, filter.postId));
    const ids = [filter.postId, ...kinderen.map((k) => k.id)];

    const metPost = new Set(
      (
        await db
          .selectDistinct({ expenseId: expenseLines.expenseId })
          .from(expenseLines)
          .where(inArray(expenseLines.postId, ids))
      ).map((r) => r.expenseId),
    );
    gevonden = gevonden.filter((r) => metPost.has(r.id));
  }

  return metHoofdpost(gevonden);
}

/**
 * Een uitgave kan regels op meerdere posten hebben. Voor het groeperen en voor het
 * label in de lijst telt de post waar het meeste geld naartoe ging.
 */
async function metHoofdpost<T extends { id: number }>(rijen: T[]) {
  const ids = rijen.map((r) => r.id);
  if (ids.length === 0) {
    return [] as (T & { post: string; postKleur: string; hoofdpost: string })[];
  }

  const ouder = alias(posten, "ouder");
  const perPost = await db
    .select({
      expenseId: expenseLines.expenseId,
      naam: posten.naam,
      kleur: posten.kleur,
      hoofdpost: sql<string>`coalesce(${ouder.naam}, ${posten.naam})`,
      cent: sql<number>`sum(${expenseLines.bedragCent})::int`,
    })
    .from(expenseLines)
    .innerJoin(posten, eq(expenseLines.postId, posten.id))
    .leftJoin(ouder, eq(posten.ouderId, ouder.id))
    .where(inArray(expenseLines.expenseId, ids))
    .groupBy(expenseLines.expenseId, posten.id, ouder.naam);

  const grootste = new Map<
    number,
    { naam: string; kleur: string; hoofdpost: string; cent: number }
  >();
  for (const rij of perPost) {
    const huidig = grootste.get(rij.expenseId);
    if (!huidig || rij.cent > huidig.cent) grootste.set(rij.expenseId, rij);
  }

  return rijen.map((rij) => ({
    ...rij,
    post: grootste.get(rij.id)?.naam ?? "Zonder post",
    postKleur: grootste.get(rij.id)?.kleur ?? "#64748b",
    hoofdpost: grootste.get(rij.id)?.hoofdpost ?? "Zonder post",
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
