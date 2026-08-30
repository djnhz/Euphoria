"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, categories, couples, users } from "@/db";
import { probeerInloggen, vereisGebruiker } from "@/lib/auth";
import { hashPin, isGeldigePin } from "@/lib/pin";
import { parseEuro } from "@/lib/geld";
import {
  sleutelZietEruitAlsSleutel,
  verwijderOpenAiSleutel,
  zetOpenAiModel,
  zetOpenAiSleutel,
  ontkoppelGoogle,
  zetGoogleAgendaId,
  zetGoogleServiceAccount,
} from "@/lib/instellingen";
import { testOpenAi } from "@/lib/receipt";
import { testAgenda } from "@/lib/agenda";

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

export async function bewaarOpenAiAction(
  _vorige: MeldingState,
  formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();

  const model = String(formData.get("model") ?? "");
  if (model.length > 100) return { fout: "Die modelnaam is te lang." };
  await zetOpenAiModel(model);

  // Leeg sleutelveld betekent: alleen het model bijwerken, sleutel laten staan.
  const sleutel = String(formData.get("sleutel") ?? "").trim();
  if (sleutel === "") {
    revalidatePath("/instellingen");
    return { gelukt: "Model opgeslagen." };
  }

  const bezwaar = sleutelZietEruitAlsSleutel(sleutel);
  if (bezwaar) return { fout: bezwaar };

  await zetOpenAiSleutel(sleutel);
  revalidatePath("/instellingen");
  return { gelukt: "Sleutel opgeslagen. Controleer hem met Verbinding testen." };
}

export async function verwijderOpenAiAction(
  _vorige: MeldingState,
  _formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();
  await verwijderOpenAiSleutel();
  revalidatePath("/instellingen");
  return { gelukt: "Sleutel verwijderd. Bonanalyse staat nu uit." };
}

export async function testOpenAiAction(
  _vorige: MeldingState,
  _formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();
  const resultaat = await testOpenAi();
  return resultaat.ok ? { gelukt: resultaat.melding } : { fout: resultaat.fout };
}

export async function bewaarAgendaAction(
  _vorige: MeldingState,
  formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();

  const agendaId = String(formData.get("agendaId") ?? "").trim();
  if (agendaId.length > 300) return { fout: "Dat agenda-ID is wel erg lang." };
  await zetGoogleAgendaId(agendaId);

  // Leeg sleutelveld betekent: alleen het agenda-ID bijwerken.
  const json = String(formData.get("serviceAccount") ?? "").trim();
  if (json === "") {
    revalidatePath("/instellingen");
    revalidatePath("/vaarplanning");
    return { gelukt: "Agenda-ID opgeslagen." };
  }

  try {
    const email = await zetGoogleServiceAccount(json);
    revalidatePath("/instellingen");
    revalidatePath("/vaarplanning");
    return {
      gelukt: `Opgeslagen. Deel de agenda met ${email} en geef die rechten om afspraken te wijzigen.`,
    };
  } catch (fout) {
    return { fout: (fout as Error).message };
  }
}

export async function testAgendaAction(
  _vorige: MeldingState,
  _formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();
  const resultaat = await testAgenda();
  return "fout" in resultaat
    ? { fout: resultaat.fout }
    : { gelukt: resultaat.melding };
}

export async function ontkoppelAgendaAction(
  _vorige: MeldingState,
  _formData: FormData,
): Promise<MeldingState> {
  await vereisGebruiker();
  await ontkoppelGoogle();
  revalidatePath("/instellingen");
  revalidatePath("/vaarplanning");
  return { gelukt: "Agenda ontkoppeld." };
}
