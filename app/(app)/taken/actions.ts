"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, taken, taakHelpers, posten, couples } from "@/db";
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

  const deadlineRuw = String(formData.get("deadline") ?? "").trim();
  if (deadlineRuw !== "" && !DATUM.test(deadlineRuw)) {
    return { fout: "Ongeldige datum." } as const;
  }
  const deadline = deadlineRuw === "" ? null : deadlineRuw;

  const postRuw = Number(formData.get("post"));
  let postId: number | null = null;
  if (Number.isInteger(postRuw) && postRuw > 0) {
    const [gevonden] = await db
      .select({ id: posten.id })
      .from(posten)
      .where(eq(posten.id, postRuw));
    if (!gevonden) return { fout: "Onbekende post." } as const;
    postId = gevonden.id;
  }

  const coupleRuw = Number(formData.get("huishouden"));
  let coupleId: number | null = null;
  if (Number.isInteger(coupleRuw) && coupleRuw > 0) {
    const [gevonden] = await db
      .select({ id: couples.id })
      .from(couples)
      .where(eq(couples.id, coupleRuw));
    if (!gevonden) return { fout: "Onbekend huishouden." } as const;
    coupleId = gevonden.id;
  }

  const soort: TaakSoort =
    formData.get("soort") === "winterklaar" ? "winterklaar" : "gewoon";
  const samen = formData.get("samen") === "aan";

  return {
    titel,
    toelichting,
    deadline,
    postId,
    coupleId,
    soort,
    samen,
  } as const;
}

export async function nieuweTaakAction(
  _vorige: TaakState,
  formData: FormData,
): Promise<TaakState> {
  const gebruiker = await vereisGebruiker();
  const velden = await leesVelden(formData);
  if ("fout" in velden) return velden;

  // "Voor mij" is de enige toewijzing die je bij het aanmaken kunt doen; iemand
  // anders een klus geven doe je niet via een lijstje maar door het te vragen.
  const voorMij = formData.get("voorMij") === "aan";

  await db.insert(taken).values({
    ...velden,
    userId: voorMij ? gebruiker.id : null,
  });

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

  await db.update(taken).set(velden).where(eq(taken.id, id));

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
