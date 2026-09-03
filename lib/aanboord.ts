import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, couples, seizoenen } from "@/db";
import { leesPlan } from "./seizoenplan";
import { maakSeizoensplanning, type Blok } from "./seizoen";
import { isoWeek, vandaag } from "./datum";

export type Beurt = {
  van: string;
  tot: string;
  coupleId: number;
  coupleNaam: string;
  week: number;
  /** Hoeveel dagen tot de eerste dag; 0 zolang het blok loopt. */
  dagenTot: number;
  /** Loopt hij nu? */
  bezig: boolean;
  naam: string | null;
};

/**
 * Wie er wanneer aan boord is, volgens de vastgezette seizoensplanning. Dit is wat
 * het overzichtsscherm vooraan zet: de aftelling naar je eigen week is het antwoord
 * op de vraag waarvoor je de app opent.
 *
 * Geen planning voor dit jaar? Dan valt er niets af te tellen en geeft dit een lege
 * lijst terug -- het scherm laat dan een uitnodiging zien om er een te maken.
 */
export async function komendeBeurten(limiet = 4): Promise<{
  beurten: Beurt[];
  jaar: number;
  gepland: boolean;
}> {
  const nu = vandaag();
  const jaar = Number(nu.slice(0, 4));

  const [huishoudens, rijen] = await Promise.all([
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    db.select().from(seizoenen).where(eq(seizoenen.jaar, jaar)),
  ]);
  const plan = leesPlan(rijen[0]?.plan);
  if (!plan || huishoudens.length < 2) {
    return { beurten: [], jaar, gepland: false };
  }

  const oneven = plan.onevenCoupleId;
  const even = huishoudens.find((h) => h.id !== oneven)?.id ?? oneven;

  const overrides: Record<string, { coupleId: number; naam?: string }> = {};
  for (const periode of plan.periodes) {
    let maandag = periode.vanMaandag;
    while (maandag <= periode.totMaandag) {
      overrides[maandag] = { coupleId: periode.coupleId, naam: periode.naam };
      maandag = verderMetEenWeek(maandag);
    }
  }

  const planning = maakSeizoensplanning({
    jaar,
    onevenCoupleId: oneven,
    evenCoupleId: even,
    feestdagToewijzing: plan.feestdagen as Record<string, number>,
    overrides,
  });

  const namen = new Map(huishoudens.map((h) => [h.id, h.naam]));
  const beurten = planning.blokken
    .filter((blok: Blok) => blok.tot >= nu)
    .slice(0, limiet)
    .map((blok: Blok) => ({
      van: blok.van,
      tot: blok.tot,
      coupleId: blok.coupleId,
      coupleNaam: namen.get(blok.coupleId) ?? "Onbekend",
      week: isoWeek(blok.van),
      dagenTot: blok.van <= nu ? 0 : dagenTussen(nu, blok.van),
      bezig: blok.van <= nu && blok.tot >= nu,
      naam: blok.naam,
    }));

  return { beurten, jaar, gepland: true };
}

/** De eerstvolgende beurt van jouw huishouden -- de aftelling bovenaan. */
export function jouwBeurt(beurten: readonly Beurt[], coupleId: number) {
  return beurten.find((b) => b.coupleId === coupleId) ?? null;
}

function verderMetEenWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function dagenTussen(van: string, tot: string): number {
  const a = Date.parse(`${van}T00:00:00Z`);
  const b = Date.parse(`${tot}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
