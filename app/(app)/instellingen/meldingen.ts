"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, users, pushAbonnementen } from "@/db";
import { vereisBeheerder, vereisGebruiker } from "@/lib/auth";
import {
  magOntvangen,
  maakVapidSleutels,
  stuurMelding,
  type MeldingSoort,
} from "@/lib/melding";

export type MeldingState = { fout?: string; gelukt?: string } | null;

const SOORTEN: MeldingSoort[] = ["bon", "taak", "vrijgave"];

/** Eenmalig het sleutelpaar aanmaken; alleen de beheerder zet dit op. */
export async function maakSleutelsAction(): Promise<MeldingState> {
  await vereisBeheerder();
  try {
    await maakVapidSleutels();
    revalidatePath("/instellingen");
    return {
      gelukt: "Sleutels aangemaakt. Meldingen kunnen nu aangezet worden.",
    };
  } catch (fout) {
    return { fout: `Aanmaken mislukte: ${(fout as Error).message}` };
  }
}

/**
 * Een toestel aanmelden. De browser heeft dan al toestemming gevraagd en een
 * abonnement gekregen; hier bewaren we het. Hetzelfde toestel twee keer aanmelden
 * levert dezelfde endpoint op, dus dat werkt bij en maakt geen dubbele rij.
 */
export async function meldToestelAanAction(
  abonnement: { endpoint: string; p256dh: string; auth: string },
  toestel: string,
): Promise<MeldingState> {
  const gebruiker = await vereisGebruiker();

  if (!abonnement.endpoint || !abonnement.p256dh || !abonnement.auth) {
    return { fout: "De browser gaf geen bruikbaar abonnement terug." };
  }

  await db
    .insert(pushAbonnementen)
    .values({
      userId: gebruiker.id,
      endpoint: abonnement.endpoint,
      p256dh: abonnement.p256dh,
      auth: abonnement.auth,
      toestel: toestel.slice(0, 120),
    })
    .onConflictDoUpdate({
      target: pushAbonnementen.endpoint,
      set: {
        userId: gebruiker.id,
        p256dh: abonnement.p256dh,
        auth: abonnement.auth,
      },
    });

  revalidatePath("/instellingen");
  return { gelukt: "Dit toestel krijgt voortaan meldingen." };
}

export async function meldToestelAfAction(
  endpoint: string,
): Promise<MeldingState> {
  const gebruiker = await vereisGebruiker();
  await db
    .delete(pushAbonnementen)
    .where(
      and(
        eq(pushAbonnementen.endpoint, endpoint),
        eq(pushAbonnementen.userId, gebruiker.id),
      ),
    );
  revalidatePath("/instellingen");
  return { gelukt: "Dit toestel krijgt geen meldingen meer." };
}

/** Eén soort aan- of uitzetten voor jezelf. */
export async function zetVoorkeurAction(
  soort: string,
  aan: boolean,
): Promise<MeldingState> {
  const gebruiker = await vereisGebruiker();
  if (!SOORTEN.includes(soort as MeldingSoort)) {
    return { fout: "Onbekende soort melding." };
  }
  const gekozen = soort as MeldingSoort;

  // De server beslist wat je mag ontvangen, niet het scherm.
  if (!magOntvangen(gekozen, gebruiker)) {
    return { fout: "Dit soort melding is niet voor jou bedoeld." };
  }

  const kolom =
    gekozen === "bon"
      ? { meldBon: aan }
      : gekozen === "taak"
        ? { meldTaak: aan }
        : { meldVrijgave: aan };

  await db.update(users).set(kolom).where(eq(users.id, gebruiker.id));
  revalidatePath("/instellingen");
  return { gelukt: aan ? "Aangezet." : "Uitgezet." };
}

/** Een proefbericht naar je eigen toestellen, om te zien of het werkt. */
export async function proefMeldingAction(): Promise<MeldingState> {
  const gebruiker = await vereisGebruiker();
  const soort: MeldingSoort = gebruiker.beheerder ? "bon" : "vrijgave";
  const uitkomst = await stuurMelding([gebruiker.id], soort, {
    titel: "Euphoria",
    tekst: "Dit is een proefbericht. De meldingen werken.",
    url: "/",
  });

  if (uitkomst.verstuurd === 0) {
    return {
      fout: "Er ging niets uit. Staat dit soort melding aan, en is dit toestel aangemeld?",
    };
  }
  return {
    gelukt: `Verstuurd naar ${uitkomst.verstuurd} ${uitkomst.verstuurd === 1 ? "toestel" : "toestellen"}.`,
  };
}
