"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { vereisGebruiker } from "@/lib/auth";
import {
  haalReserveringen,
  maakReservering,
  verwijderReservering,
} from "@/lib/agenda";

const ReserveringInvoer = z.object({
  van: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige begindatum"),
  totEnMet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige einddatum"),
  opmerking: z.string().trim().max(500),
  /** Tweede poging na een overlapwaarschuwing. */
  tochDoorgaan: z.boolean(),
});

export type ReserveerState =
  | { soort: "fout"; melding: string }
  | { soort: "overlap"; melding: string }
  | { soort: "gelukt"; melding: string }
  | null;

export async function reserveerAction(
  _vorige: ReserveerState,
  formData: FormData,
): Promise<ReserveerState> {
  const gebruiker = await vereisGebruiker();

  const gelezen = ReserveringInvoer.safeParse({
    van: formData.get("van"),
    totEnMet: formData.get("totEnMet"),
    opmerking: formData.get("opmerking") ?? "",
    tochDoorgaan: formData.get("tochDoorgaan") === "ja",
  });
  if (!gelezen.success) {
    return {
      soort: "fout",
      melding: gelezen.error.issues[0]?.message ?? "Ongeldige invoer",
    };
  }
  const invoer = gelezen.data;
  if (invoer.totEnMet < invoer.van) {
    return { soort: "fout", melding: "De einddatum ligt voor de begindatum." };
  }

  // Overlap mag, maar niet ongemerkt: eerst waarschuwen, daarna pas boeken.
  if (!invoer.tochDoorgaan) {
    const bestaand = await haalReserveringen(invoer.van, invoer.totEnMet);
    if ("fout" in bestaand) return { soort: "fout", melding: bestaand.fout };
    const botsingen = bestaand.filter(
      (r) => r.van <= invoer.totEnMet && r.tot >= invoer.van,
    );
    if (botsingen.length > 0) {
      const namen = botsingen.map((r) => r.titel).join(", ");
      return {
        soort: "overlap",
        melding: `Er staat al iets in deze periode: ${namen}. Nog een keer op Reserveren drukken boekt het er alsnog bij.`,
      };
    }
  }

  const resultaat = await maakReservering({
    van: invoer.van,
    totEnMet: invoer.totEnMet,
    titel: gebruiker.naam,
    opmerking: invoer.opmerking,
    userId: gebruiker.id,
    coupleId: gebruiker.coupleId,
  });
  if ("fout" in resultaat) return { soort: "fout", melding: resultaat.fout };

  revalidatePath("/vaarplanning");
  return { soort: "gelukt", melding: "Gereserveerd." };
}

export async function annuleerAction(formData: FormData) {
  await vereisGebruiker();
  const id = String(formData.get("id") ?? "");
  if (id) await verwijderReservering(id);
  revalidatePath("/vaarplanning");
}
