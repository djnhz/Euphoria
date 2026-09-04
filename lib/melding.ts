import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db, users, pushAbonnementen } from "@/db";
import {
  leesGeheim,
  bewaarGeheim,
  leesGewoon,
  bewaarGewoon,
} from "./instellingen";
import { magOntvangen, type MeldingSoort } from "./meldingregels";

export {
  magOntvangen,
  keuzesVoor,
  MELDING_LABELS,
  MELDING_SOORTEN,
  type MeldingSoort,
} from "./meldingregels";

/**
 * Pushmeldingen via de webstandaard: geen dienst van derden en niets te betalen.
 * De browser van de ontvanger geeft een adres bij Google of Apple, en daar zetten
 * wij een versleuteld bericht neer. Alleen dat ene toestel kan het lezen.
 *
 * Op een iPhone werkt dit uitsluitend als de app op het beginscherm staat. In een
 * gewoon Safari-tabblad bestaat de functie niet; het scherm in Instellingen zegt
 * dat er dan bij.
 */

const SLEUTEL_PUBLIEK = "vapid_publiek";
const SLEUTEL_PRIVE = "vapid_prive";

/** Kolom in `users` per soort, zodat de vraag "wil hij dit" één plek heeft. */
const VOORKEUR = {
  bon: users.meldBon,
  taak: users.meldTaak,
  vrijgave: users.meldVrijgave,
} as const;

export type VapidStand = { ingesteld: boolean; publiek: string | null };

export async function vapidStand(): Promise<VapidStand> {
  const publiek = await leesGewoon(SLEUTEL_PUBLIEK);
  const prive = await leesGeheim(SLEUTEL_PRIVE);
  return { ingesteld: Boolean(publiek && prive), publiek: publiek ?? null };
}

/**
 * Eenmalig een sleutelpaar maken. De publieke helft gaat mee naar de browser, de
 * private blijft hier en staat versleuteld in de database, net als de OpenAI-sleutel.
 */
export async function maakVapidSleutels(): Promise<{ publiek: string }> {
  const paar = webpush.generateVAPIDKeys();
  await bewaarGewoon(SLEUTEL_PUBLIEK, paar.publicKey);
  await bewaarGeheim(SLEUTEL_PRIVE, paar.privateKey);
  return { publiek: paar.publicKey };
}

export type Bericht = {
  titel: string;
  tekst: string;
  /** Waar de melding heen brengt als je erop tikt. */
  url: string;
};

/**
 * Een bericht sturen naar iedereen in `userIds` die dit soort mág en wíl krijgen.
 * Faalt er een toestel met 404 of 410, dan bestaat dat abonnement niet meer en gaat
 * de rij weg -- anders blijft de tabel vollopen met telefoons die er niet meer zijn.
 *
 * Gooit nooit: een mislukte melding mag de handeling die hem uitlokte niet omver
 * halen. Een bon indienen moet lukken, ook als de meldingen stuk zijn.
 */
export async function stuurMelding(
  userIds: readonly number[],
  soort: MeldingSoort,
  bericht: Bericht,
): Promise<{ verstuurd: number; opgeruimd: number }> {
  const leeg = { verstuurd: 0, opgeruimd: 0 };
  if (userIds.length === 0) return leeg;

  try {
    const publiek = await leesGewoon(SLEUTEL_PUBLIEK);
    const prive = await leesGeheim(SLEUTEL_PRIVE);
    if (!publiek || !prive) return leeg;

    const ontvangers = await db
      .select({
        id: users.id,
        beheerder: users.beheerder,
        wil: VOORKEUR[soort],
      })
      .from(users)
      .where(inArray(users.id, [...userIds]));

    const wil = ontvangers
      .filter((o) => o.wil && magOntvangen(soort, o))
      .map((o) => o.id);
    if (wil.length === 0) return leeg;

    const abonnementen = await db
      .select()
      .from(pushAbonnementen)
      .where(inArray(pushAbonnementen.userId, wil));
    if (abonnementen.length === 0) return leeg;

    webpush.setVapidDetails("mailto:euphoria@wspsystems.com", publiek, prive);
    const inhoud = JSON.stringify(bericht);

    let verstuurd = 0;
    const dood: number[] = [];
    for (const abo of abonnementen) {
      try {
        await webpush.sendNotification(
          {
            endpoint: abo.endpoint,
            keys: { p256dh: abo.p256dh, auth: abo.auth },
          },
          inhoud,
        );
        verstuurd++;
      } catch (fout) {
        const code = (fout as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dood.push(abo.id);
      }
    }

    if (dood.length > 0) {
      await db
        .delete(pushAbonnementen)
        .where(inArray(pushAbonnementen.id, dood));
    }
    return { verstuurd, opgeruimd: dood.length };
  } catch {
    return leeg;
  }
}

/** Iedereen behalve degene die de handeling deed; jezelf een bericht sturen is onzin. */
export async function anderen(behalveUserId: number): Promise<number[]> {
  const rijen = await db.select({ id: users.id }).from(users);
  return rijen.map((r) => r.id).filter((id) => id !== behalveUserId);
}

/** Hoeveel toestellen deze gebruiker heeft aangemeld. */
export async function aantalToestellen(userId: number): Promise<number> {
  const rijen = await db
    .select({ id: pushAbonnementen.id })
    .from(pushAbonnementen)
    .where(eq(pushAbonnementen.userId, userId));
  return rijen.length;
}
