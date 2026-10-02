"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db, taken, taakHelpers, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { anderen, stuurMelding } from "@/lib/melding";
import type { TaakSoort } from "@/db";

export type TaakState = { fout?: string; gelukt?: string } | null;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Uit het formulier de velden halen die zowel bij nieuw als bij wijzigen gelden. */
async function leesVelden(formData: FormData) {
  const titel = String(formData.get("titel") ?? "").trim();
  if (titel.length < 2 || titel.length > 120) {
    return { fout: "Geef de taak een naam van minstens twee tekens." } as const;
  }

  const toelichting = String(formData.get("toelichting") ?? "").trim();
  if (toelichting.length > 500) {
    return { fout: "De toelichting is te lang." } as const;
  }

  /**
   * De datum hoort alleen bij een gewone taak, en bij een winterklaar-taak stuurt het
   * formulier hem niet mee. Een veld dat ontbreekt is dus iets anders dan een veld
   * dat leeg is: leeg betekent "wis het", ontbreken betekent "blijf eraf". Zonder dat
   * onderscheid zou het opslaan van een winterklaar-taak stilletjes wissen wat er
   * eerder aan stond. Dat geldt ook voor de post, die niet meer in het formulier zit
   * maar bij oudere taken nog wel is ingevuld.
   */
  let deadline: string | null | undefined;
  if (formData.has("deadline")) {
    const ruw = String(formData.get("deadline") ?? "").trim();
    if (ruw !== "" && !DATUM.test(ruw)) {
      return { fout: "Ongeldige datum." } as const;
    }
    deadline = ruw === "" ? null : ruw;
  }

  const soort: TaakSoort =
    formData.get("soort") === "winterklaar" ? "winterklaar" : "gewoon";

  return {
    titel,
    toelichting,
    soort,
    // `undefined` laat drizzle de kolom met rust; `null` zou hem leegmaken.
    deadline,
  } as const;
}

/**
 * Aan wie een taak is toegekend, als het formulier die keuze kent.
 * `undefined` betekent "dit formulier gaat er niet over, blijf eraf" en een lege
 * lijst betekent "niemand". Een vakje dat uit staat stuurt niets mee, dus de twee
 * zijn alleen uit elkaar te houden doordat het formulier zelf meldt dat de keuze
 * erbij hoort (`wieIngevuld`).
 *
 * Alleen bestaande gebruikers komen door: een id uit een oud tabblad of een
 * verzonnen formulier maakt geen rij aan voor iemand die er niet is.
 */
async function leesWie(formData: FormData): Promise<number[] | undefined> {
  if (!formData.has("wieIngevuld")) return undefined;
  const ids = [
    ...new Set(
      formData
        .getAll("wie")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (ids.length === 0) return [];
  const bestaand = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, ids));
  return bestaand.map((r) => r.id);
}

/**
 * De toegekende personen vervangen door deze set. Neon kent hier geen transactie,
 * dus eerst weg en dan erin: gaat er halverwege iets mis, dan staat er hooguit
 * niemand op de taak en nooit iemand die je niet gekozen had.
 */
async function zetWie(taakId: number, wie: number[]) {
  await db.delete(taakHelpers).where(eq(taakHelpers.taakId, taakId));
  if (wie.length > 0) {
    await db
      .insert(taakHelpers)
      .values(wie.map((userId) => ({ taakId, userId })));
  }
}

export async function nieuweTaakAction(
  _vorige: TaakState,
  formData: FormData,
): Promise<TaakState> {
  const gebruiker = await vereisGebruiker();
  const velden = await leesVelden(formData);
  if ("fout" in velden) return velden;

  // Toekennen gaat voor elke taak op dezelfde manier: aan een of meer personen, via
  // `wie`. De kolommen `userId`, `coupleId` en `samen` blijven voor wat er al stond.
  const wie = await leesWie(formData);

  const [nieuw] = await db
    .insert(taken)
    .values(velden)
    .returning({ id: taken.id });
  if (wie !== undefined) await zetWie(nieuw.id, wie);

  await stuurMelding(await anderen(gebruiker.id), "taak", {
    titel: "Nieuwe taak",
    tekst: `${gebruiker.naam} zette "${velden.titel}" op de lijst.`,
    url: "/taken",
  });

  revalidatePath("/taken");
  revalidatePath("/");
  return { gelukt: "Taak toegevoegd." };
}

export async function wijzigTaakAction(
  _vorige: TaakState,
  formData: FormData,
): Promise<TaakState> {
  await vereisGebruiker();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { fout: "Onbekende taak." };

  const velden = await leesVelden(formData);
  if ("fout" in velden) return velden;
  const wie = await leesWie(formData);

  // Wordt er toegekend, dan staat de hele toewijzing in die lijst. Een eigenaar of
  // huishouden uit de tijd van de losse keuzes gaat daarin op: het blad toonde ze al
  // aangevinkt, dus ze blijven bestaan als je ze laat staan, en vallen weg als je
  // ze uitzet. Anders bleef er een toewijzing hangen die je nergens kunt zien.
  await db
    .update(taken)
    .set(
      wie === undefined ? velden : { ...velden, userId: null, coupleId: null },
    )
    .where(eq(taken.id, id));
  if (wie !== undefined) await zetWie(id, wie);

  revalidatePath("/taken");
  revalidatePath("/");
  return { gelukt: "Taak bijgewerkt." };
}

/**
 * Afvinken en terugzetten met dezelfde actie: het is één knop op het scherm, en
 * per ongeluk afvinken moet je in één tik ongedaan kunnen maken.
 */
export async function zetKlaarAction(id: number, klaar: boolean) {
  const gebruiker = await vereisGebruiker();
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .update(taken)
    .set({
      klaar,
      klaarOp: klaar ? new Date() : null,
      klaarDoor: klaar ? gebruiker.id : null,
    })
    .where(eq(taken.id, id));

  revalidatePath("/taken");
  revalidatePath("/");
}

export async function verwijderTaakAction(id: number) {
  await vereisGebruiker();
  if (!Number.isInteger(id) || id <= 0) return;
  await db.delete(taken).where(eq(taken.id, id));
  revalidatePath("/taken");
  revalidatePath("/");
}
