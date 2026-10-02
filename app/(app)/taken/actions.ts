"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, taken, taakHelpers, couples, users } from "@/db";
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
   * Datum en huishouden horen alleen bij een gewone taak, en bij een winterklaar-taak
   * stuurt het formulier ze niet mee. Een veld dat ontbreekt is dus iets anders dan
   * een veld dat leeg is: leeg betekent "wis het", ontbreken betekent "blijf eraf".
   * Zonder dat onderscheid zou het opslaan van een winterklaar-taak stilletjes
   * wissen wat er eerder aan stond. Dat geldt ook voor de post, die niet meer in het
   * formulier zit maar bij oudere taken nog wel is ingevuld.
   */
  let deadline: string | null | undefined;
  if (formData.has("deadline")) {
    const ruw = String(formData.get("deadline") ?? "").trim();
    if (ruw !== "" && !DATUM.test(ruw)) {
      return { fout: "Ongeldige datum." } as const;
    }
    deadline = ruw === "" ? null : ruw;
  }

  let coupleId: number | null | undefined;
  if (formData.has("huishouden")) {
    const ruw = Number(formData.get("huishouden"));
    coupleId = null;
    if (Number.isInteger(ruw) && ruw > 0) {
      const [gevonden] = await db
        .select({ id: couples.id })
        .from(couples)
        .where(eq(couples.id, ruw));
      if (!gevonden) return { fout: "Onbekend huishouden." } as const;
      coupleId = gevonden.id;
    }
  }

  const soort: TaakSoort =
    formData.get("soort") === "winterklaar" ? "winterklaar" : "gewoon";
  // Alleen een gewone taak kent "samen oppakken". Bij winterklaar is het vakje er
  // niet, en afwezig is daar geen "nee": een oudere winterklaar-taak die het wel
  // had, houdt het.
  const samen =
    soort === "gewoon" ? formData.get("samen") === "aan" : undefined;

  return {
    titel,
    toelichting,
    soort,
    samen,
    // `undefined` laat drizzle de kolom met rust; `null` zou hem leegmaken.
    deadline,
    coupleId,
  } as const;
}

/**
 * Aan wie een winterklaar-taak is toegekend, als het formulier die keuze kent.
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

  // Bij een gewone taak is "Ik pak hem zelf op" de enige toewijzing; een winterklaar-
  // taak kent hij toe via `wie`, aan een of meer personen.
  const voorMij = formData.get("voorMij") === "aan";
  const wie = await leesWie(formData);

  const [nieuw] = await db
    .insert(taken)
    .values({
      ...velden,
      userId: voorMij ? gebruiker.id : null,
    })
    .returning({ id: taken.id });
  if (wie !== undefined) await zetWie(nieuw.id, wie);

  await stuurMelding(await anderen(gebruiker.id), "taak", {
    titel: velden.samen ? "Klus om samen te doen" : "Nieuwe taak",
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

  await db.update(taken).set(velden).where(eq(taken.id, id));
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

/** Aanmelden voor een klus die je samen doet, of je afmelding weer intrekken. */
export async function helpMeeAction(id: number, meedoen: boolean) {
  const gebruiker = await vereisGebruiker();
  if (!Number.isInteger(id) || id <= 0) return;

  if (meedoen) {
    await db
      .insert(taakHelpers)
      .values({ taakId: id, userId: gebruiker.id })
      .onConflictDoNothing();

    const [taak] = await db
      .select({ titel: taken.titel })
      .from(taken)
      .where(eq(taken.id, id));
    if (taak) {
      await stuurMelding(await anderen(gebruiker.id), "taak", {
        titel: "Iemand helpt mee",
        tekst: `${gebruiker.naam} pakt "${taak.titel}" mee op.`,
        url: "/taken",
      });
    }
  } else {
    await db
      .delete(taakHelpers)
      .where(
        and(eq(taakHelpers.taakId, id), eq(taakHelpers.userId, gebruiker.id)),
      );
  }

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
