import "server-only";
import { and, asc, eq, desc, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  taken,
  taakHelpers,
  posten,
  users,
  couples,
  type TaakSoort,
} from "@/db";
import { plusDagen, vandaag } from "./datum";

export type Helper = { userId: number; naam: string };

export type Taak = {
  id: number;
  titel: string;
  toelichting: string;
  postId: number | null;
  postNaam: string | null;
  postKleur: string | null;
  deadline: string | null;
  soort: TaakSoort;
  samen: boolean;
  userId: number | null;
  userNaam: string | null;
  coupleId: number | null;
  coupleNaam: string | null;
  klaar: boolean;
  klaarOp: Date | null;
  klaarDoorNaam: string | null;
  helpers: Helper[];
};

const eigenaar = alias(users, "eigenaar");
const afronder = alias(users, "afronder");

/**
 * Alle taken in één keer, met de namen erbij. Het zijn er tientallen, geen
 * duizenden -- filteren en groeperen doet het scherm, dan hoeft er maar één
 * bevraging te gebeuren voor alle drie de tabbladen.
 */
export async function alleTaken(): Promise<Taak[]> {
  const [rijen, aanmeldingen] = await Promise.all([
    db
      .select({
        id: taken.id,
        titel: taken.titel,
        toelichting: taken.toelichting,
        postId: taken.postId,
        postNaam: posten.naam,
        postKleur: posten.kleur,
        deadline: taken.deadline,
        soort: taken.soort,
        samen: taken.samen,
        userId: taken.userId,
        userNaam: eigenaar.naam,
        coupleId: taken.coupleId,
        coupleNaam: couples.naam,
        klaar: taken.klaar,
        klaarOp: taken.klaarOp,
        klaarDoorNaam: afronder.naam,
        aangemaaktOp: taken.aangemaaktOp,
      })
      .from(taken)
      .leftJoin(posten, eq(taken.postId, posten.id))
      .leftJoin(eigenaar, eq(taken.userId, eigenaar.id))
      .leftJoin(afronder, eq(taken.klaarDoor, afronder.id))
      .leftJoin(couples, eq(taken.coupleId, couples.id))
      // Zonder deadline achteraan: die hebben geen moment om je op te richten.
      .orderBy(
        sql`${taken.deadline} asc nulls last`,
        desc(taken.aangemaaktOp),
      ),
    db
      .select({ taakId: taakHelpers.taakId, userId: users.id, naam: users.naam })
      .from(taakHelpers)
      .innerJoin(users, eq(taakHelpers.userId, users.id))
      .orderBy(asc(users.naam)),
  ]);

  const perTaak = new Map<number, Helper[]>();
  for (const rij of aanmeldingen) {
    const lijst = perTaak.get(rij.taakId) ?? [];
    lijst.push({ userId: rij.userId, naam: rij.naam });
    perTaak.set(rij.taakId, lijst);
  }

  return rijen.map((rij) => ({
    ...rij,
    helpers: perTaak.get(rij.id) ?? [],
  }));
}

/** Wat er op het overzichtsscherm past: de eerstvolgende open taken. */
export async function komendeTaken(hoeveel = 3) {
  const open = (await alleTaken()).filter((t) => !t.klaar);
  return {
    lijst: open.slice(0, hoeveel),
    open: open.length,
  };
}

/** Voor de voortgangsring: hoeveel er af zijn van wat er dit seizoen ligt. */
export function voortgang(lijst: readonly Taak[]) {
  const klaar = lijst.filter((t) => t.klaar).length;
  const totaal = lijst.length;
  return {
    klaar,
    totaal,
    procent: totaal === 0 ? 0 : Math.round((klaar / totaal) * 100),
  };
}

/**
 * "Deze week": alles met een deadline binnen zeven dagen, plus wat al te laat is.
 * Dat is de lijst waar je vlak voor je week naar kijkt.
 */
export function dezeWeek(lijst: readonly Taak[]) {
  const grens = plusDagen(vandaag(), 7);
  return lijst.filter(
    (t) => !t.klaar && !t.samen && t.deadline !== null && t.deadline <= grens,
  );
}

/** De posten waaruit je bij een taak kunt kiezen: alleen de hoofdposten. */
export async function taakPosten() {
  return db
    .select({ id: posten.id, naam: posten.naam, kleur: posten.kleur })
    .from(posten)
    .where(and(isNull(posten.ouderId), eq(posten.actief, true)))
    .orderBy(asc(posten.naam));
}
