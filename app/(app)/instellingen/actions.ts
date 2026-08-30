"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, categories, couples, users } from "@/db";
import { probeerInloggen, vereisGebruiker } from "@/lib/auth";
import { hashPin, isGeldigePin } from "@/lib/pin";
import { parseEuro } from "@/lib/geld";

export type MeldingState = { fout?: string; gelukt?: string } | null;

const KLEUR = /^#[0-9a-fA-F]{6}$/;

export async function nieuweCategorieAction(
  _vorige: MeldingState,
  formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();
  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "#64748b");
  if (naam.length < 1 || naam.length > 60) return { fout: "Vul een naam in." };
  if (!KLEUR.test(kleur)) return { fout: "Ongeldige kleur." };

  const budget = parseEuro(String(formData.get("budget") ?? ""));
  try {
    await db
      .insert(categories)
      .values({ naam, kleur, budgetJaarCent: budget });
  } catch {
    return { fout: "Die categorie bestaat al." };
  }
  revalidatePath("/instellingen");
  revalidatePath("/");
  return { gelukt: `${naam} toegevoegd.` };
}

export async function wijzigCategorieAction(formData: FormData) {
  await vereisGebruiker();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "");
  const budgetTekst = String(formData.get("budget") ?? "").trim();

  await db
    .update(categories)
    .set({
      ...(naam ? { naam } : {}),
      ...(KLEUR.test(kleur) ? { kleur } : {}),
      // Leeg veld betekent expliciet "geen budget".
      budgetJaarCent: budgetTekst === "" ? null : parseEuro(budgetTekst),
      actief: formData.get("actief") === "on",
    })
    .where(eq(categories.id, id));

  revalidatePath("/instellingen");
  revalidatePath("/");
}

export async function wijzigNamenAction(
  _vorige: MeldingState,
  formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();

  for (const [sleutel, waarde] of formData.entries()) {
    const tekst = String(waarde).trim();
    if (tekst === "" || tekst.length > 60) continue;

    const huishouden = /^huishouden-(\d+)$/.exec(sleutel);
    if (huishouden) {
      await db
        .update(couples)
        .set({ naam: tekst })
        .where(eq(couples.id, Number(huishouden[1])));
      continue;
    }
    const gebruiker = /^gebruiker-(\d+)$/.exec(sleutel);
    if (gebruiker) {
      await db
        .update(users)
        .set({ naam: tekst })
        .where(eq(users.id, Number(gebruiker[1])));
    }
  }

  revalidatePath("/instellingen");
  revalidatePath("/");
  return { gelukt: "Namen bijgewerkt." };
}

export async function wijzigPinAction(
  _vorige: MeldingState,
  formData: FormData,
): Promise<MeldingState> {
  const gebruiker = await vereisGebruiker();
  const huidig = String(formData.get("huidig") ?? "");
  const nieuw = String(formData.get("nieuw") ?? "");
  const herhaal = String(formData.get("herhaal") ?? "");

  if (!isGeldigePin(nieuw)) return { fout: "De nieuwe pincode is vier cijfers." };
  if (nieuw !== herhaal) return { fout: "De herhaling komt niet overeen." };

  // Hergebruikt de bestaande pogingteller met blokkade, zodat ook dit formulier
  // geen manier is om pincodes af te tasten.
  const controle = await probeerInloggen(gebruiker.id, huidig);
  if (!controle.ok) return { fout: controle.fout };

  await db.update(users).set(await hashPin(nieuw)).where(eq(users.id, gebruiker.id));
  return { gelukt: "Pincode gewijzigd." };
}
