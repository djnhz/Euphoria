"use server";

import { revalidatePath } from "next/cache";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { publiceerSeizoen, seizoenStand } from "@/lib/agenda";
import { dagenInSeizoen } from "@/lib/datum";
import { maakSeizoensplanning } from "@/lib/seizoen";

const FeestdagCodes = z.enum([
  "pasen",
  "hemelvaart",
  "pinksteren",
  "koningsdag",
]);

/**
 * Het concept wordt hier opnieuw uitgerekend uit dezelfde invoer, in plaats van de
 * blokken uit de browser te geloven. Wat de agenda in gaat komt zo altijd uit de
 * geteste rekenmodule.
 */
const PubliceerInvoer = z.object({
  jaar: z.number().int().min(2020).max(2100),
  onevenCoupleId: z.number().int().positive(),
  evenCoupleId: z.number().int().positive(),
  feestdagToewijzing: z.record(FeestdagCodes, z.number().int().positive()),
  /** Zelf ingeplande weken, per maandag: welk huishouden en hoe die vakantie heet. */
  overrides: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.object({
      coupleId: z.number().int().positive(),
      naam: z.string().trim().max(80).optional(),
    }),
  ),
});

export type PubliceerState =
  | { soort: "fout"; melding: string }
  | { soort: "gelukt"; melding: string }
  | null;

export async function publiceerAction(
  _vorige: PubliceerState,
  formData: FormData,
): Promise<PubliceerState> {
  await vereisGebruiker();

  const gelezen = PubliceerInvoer.safeParse(
    JSON.parse(String(formData.get("payload") ?? "{}")),
  );
  if (!gelezen.success) {
    return { soort: "fout", melding: "Ongeldige invoer voor de planning." };
  }
  const invoer = gelezen.data;

  const huishoudens = await db
    .select()
    .from(couples)
    .orderBy(asc(couples.volgorde));
  const naamVan = new Map(huishoudens.map((h) => [h.id, h.naam]));
  if (!naamVan.has(invoer.onevenCoupleId) || !naamVan.has(invoer.evenCoupleId)) {
    return { soort: "fout", melding: "Onbekend huishouden in de planning." };
  }

  const planning = maakSeizoensplanning(invoer);
  const dagen = dagenInSeizoen(invoer.jaar);

  const resultaat = await publiceerSeizoen(
    invoer.jaar,
    planning.blokken.map((blok) => ({
      van: blok.van,
      tot: blok.tot,
      // De naam van een ingeplande vakantie hoort in de agenda te staan, anders zie
      // je daar alleen een huishouden en niet waarom die weken aan elkaar zitten.
      titel: blok.naam
        ? `${naamVan.get(blok.coupleId) ?? "Gereserveerd"} — ${blok.naam}`
        : (naamVan.get(blok.coupleId) ?? "Gereserveerd"),
      opmerking:
        blok.reden === "feestdag"
          ? `Seizoensplanning ${invoer.jaar} — ${blok.feestdag}`
          : `Seizoensplanning ${invoer.jaar}`,
      coupleId: blok.coupleId,
    })),
    dagen[0],
    dagen.at(-1)!,
  );
  if ("fout" in resultaat) return { soort: "fout", melding: resultaat.fout };

  revalidatePath("/vaarplanning");
  return {
    soort: "gelukt",
    melding: `${resultaat.aangemaakt} afspraken gezet${
      resultaat.verwijderd > 0
        ? `, ${resultaat.verwijderd} van de vorige planning vervangen`
        : ""
    }.`,
  };
}

export type StandState = { melding: string } | null;

/** Kijkt wat er al in de agenda staat, zonder iets te wijzigen. */
export async function standAction(
  _vorige: StandState,
  formData: FormData,
): Promise<StandState> {
  await vereisGebruiker();
  const jaar = Number(formData.get("jaar"));
  if (!Number.isInteger(jaar)) return { melding: "Ongeldig jaartal." };

  const dagen = dagenInSeizoen(jaar);
  const stand = await seizoenStand(jaar, dagen[0], dagen.at(-1)!);
  if ("fout" in stand) return { melding: stand.fout };

  return {
    melding:
      `In dit seizoen staan ${stand.vanSeizoen} afspraken van een eerdere planning ` +
      `(die worden vervangen) en ${stand.handmatig} andere afspraken (die blijven staan).`,
  };
}
