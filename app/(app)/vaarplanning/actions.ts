"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { vereisGebruiker } from "@/lib/auth";
import { anderen, stuurMelding } from "@/lib/melding";
import { formatDatum } from "@/lib/datum";
import {
  geefDagenVrij,
  haalReserveringen,
  maakReservering,
} from "@/lib/agenda";

const ReserveringInvoer = z.object({
  titel: z.string().trim().min(1, "Vul een titel in").max(120),
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
    titel: formData.get("titel"),
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
    titel: invoer.titel,
    opmerking: invoer.opmerking,
    userId: gebruiker.id,
    coupleId: gebruiker.coupleId,
  });
  if ("fout" in resultaat) return { soort: "fout", melding: resultaat.fout };

  revalidatePath("/vaarplanning");
  return { soort: "gelukt", melding: "Gereserveerd." };
}

export type VrijgeefState = { fout?: string; gelukt?: string } | null;

/**
 * Dagen uit een reservering halen. Vink je alle dagen aan, dan valt de reservering
 * helemaal weg; vink je er een paar in het midden aan, dan blijven de stukken
 * ervoor en erna staan als losse reserveringen.
 *
 * Alleen weken van het eigen huishouden -- ook de blokken uit de
 * seizoensplanning, want juist daar wil je een losse dag kunnen teruggeven.
 */
export async function geefDagenVrijAction(
  _vorige: VrijgeefState,
  formData: FormData,
): Promise<VrijgeefState> {
  const gebruiker = await vereisGebruiker();

  const id = String(formData.get("id") ?? "");
  if (!id) return { fout: "Onbekende reservering." };

  const dagen = formData
    .getAll("dag")
    .map(String)
    .filter((dag) => /^\d{4}-\d{2}-\d{2}$/.test(dag));
  if (dagen.length === 0) {
    return { fout: "Vink eerst de dagen aan die je wilt vrijgeven." };
  }

  // De reservering opnieuw ophalen in plaats van het scherm geloven: daartussen
  // kan iemand anders hem al hebben aangepast.
  const bestaand = await haalReserveringen(dagen[0], dagen[dagen.length - 1]);
  if ("fout" in bestaand) return { fout: bestaand.fout };
  const mijne = bestaand.find((r) => r.id === id);
  if (!mijne) return { fout: "Deze reservering staat er niet meer." };
  // Op huishouden en niet op persoon: de blokken uit de seizoensplanning staan op
  // naam van een huishouden en van niemand in het bijzonder, en binnen een gezin
  // hoeft niemand te wachten tot degene die boekte tijd heeft.
  //
  // Staat er geen huishouden bij, dan is de afspraak rechtstreeks in Google Agenda
  // gezet. Die hoort niemand toe en mag dus door iedereen bijgesteld worden -- daar
  // in de agenda kan dat immers ook.
  if (mijne.coupleId !== null && mijne.coupleId !== gebruiker.coupleId) {
    return { fout: "Deze week staat op naam van het andere huishouden." };
  }

  const uitkomst = await geefDagenVrij(id, dagen);
  if ("fout" in uitkomst) return { fout: uitkomst.fout };

  revalidatePath("/vaarplanning");
  revalidatePath("/");
  const aantal = `${dagen.length} ${dagen.length === 1 ? "dag" : "dagen"}`;

  // Dit is het bericht dat iedereen wil: er is boot vrijgekomen.
  await stuurMelding(await anderen(gebruiker.id), "vrijgave", {
    titel: "Dagen vrijgegeven",
    tekst:
      dagen.length === 1
        ? `${gebruiker.naam} gaf ${formatDatum(dagen[0])} vrij uit "${mijne.titel}".`
        : `${gebruiker.naam} gaf ${aantal} vrij uit "${mijne.titel}", vanaf ${formatDatum(dagen[0])}.`,
    url: "/vaarplanning",
  });
  return {
    gelukt:
      uitkomst.stukken === 0
        ? "De hele reservering is weg."
        : uitkomst.stukken === 1
          ? `${aantal} vrijgegeven.`
          : `${aantal} vrijgegeven; de reservering staat nu in ${uitkomst.stukken} stukken.`,
  };
}
