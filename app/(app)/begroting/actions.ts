"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, budgets, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { parseEuro } from "@/lib/geld";

export type BegrotingState = { fout?: string; gelukt?: string } | null;

const KLEUR = /^#[0-9a-fA-F]{6}$/;

/**
 * Slaat de hele begroting van een jaar in een keer op. Een leeg veld betekent "niet
 * begroot" en haalt de rij weg; zo blijft er geen nul staan die als bewuste keuze leest.
 */
export async function bewaarBegrotingAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const jaar = Number(formData.get("jaar"));
  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2100) {
    return { fout: "Ongeldig jaar." };
  }

  const teWissen: number[] = [];
  for (const [sleutel, waarde] of formData.entries()) {
    const treffer = /^post-(\d+)$/.exec(sleutel);
    if (!treffer) continue;
    const postId = Number(treffer[1]);
    const tekst = String(waarde).trim();

    if (tekst === "") {
      teWissen.push(postId);
      continue;
    }
    const bedragCent = parseEuro(tekst);
    if (bedragCent === null || bedragCent < 0) {
      return { fout: `"${tekst}" is geen bedrag.` };
    }

    await db
      .insert(budgets)
      .values({ jaar, postId, bedragCent })
      .onConflictDoUpdate({
        target: [budgets.jaar, budgets.postId],
        set: { bedragCent },
      });
  }

  if (teWissen.length > 0) {
    await db
      .delete(budgets)
      .where(and(eq(budgets.jaar, jaar), inArray(budgets.postId, teWissen)));
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Begroting ${jaar} opgeslagen.` };
}

/**
 * Een nieuwe post. Zonder ouder is het een hoofdpost, met ouder een subpost daaronder.
 * Dieper dan twee lagen kan niet: een subpost van een subpost wordt geweigerd.
 */
export async function nieuwePostAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "#64748b");
  const ouder = Number(formData.get("ouder"));
  if (naam.length < 1 || naam.length > 60) return { fout: "Vul een naam in." };
  if (!KLEUR.test(kleur)) return { fout: "Ongeldige kleur." };

  let ouderId: number | null = null;
  if (Number.isInteger(ouder) && ouder > 0) {
    const [gekozen] = await db
      .select({ ouderId: posten.ouderId })
      .from(posten)
      .where(eq(posten.id, ouder));
    if (!gekozen) return { fout: "Die hoofdpost bestaat niet." };
    if (gekozen.ouderId !== null) {
      return { fout: "Een subpost kan zelf geen subposten hebben." };
    }
    ouderId = ouder;
  }

  try {
    await db.insert(posten).values({ naam, kleur, ouderId });
  } catch {
    return { fout: "Die post bestaat al." };
  }

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
  return { gelukt: `${naam} toegevoegd.` };
}

/** Naam, kleur of plek in de boom bijwerken, of een post buiten gebruik stellen. */
export async function wijzigPostAction(formData: FormData) {
  await vereisGebruiker();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "");
  const ouder = Number(formData.get("ouder"));

  // Zichzelf als ouder, of een post die zelf al subposten heeft, zou de boom breken.
  let ouderId: number | null = null;
  if (Number.isInteger(ouder) && ouder > 0 && ouder !== id) {
    const [gekozen] = await db
      .select({ ouderId: posten.ouderId })
      .from(posten)
      .where(eq(posten.id, ouder));
    const eigenKinderen = await db
      .select({ id: posten.id })
      .from(posten)
      .where(eq(posten.ouderId, id));
    if (gekozen && gekozen.ouderId === null && eigenKinderen.length === 0) {
      ouderId = ouder;
    }
  }

  await db
    .update(posten)
    .set({
      ...(naam ? { naam } : {}),
      ...(KLEUR.test(kleur) ? { kleur } : {}),
      ouderId,
      actief: formData.get("actief") === "on",
    })
    .where(eq(posten.id, id));

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
}

/** Vorig jaar als startpunt overnemen; bestaande bedragen blijven staan. */
export async function neemVorigJaarOverAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const jaar = Number(formData.get("jaar"));
  if (!Number.isInteger(jaar)) return { fout: "Ongeldig jaar." };

  const vorig = await db
    .select()
    .from(budgets)
    .where(eq(budgets.jaar, jaar - 1));
  if (vorig.length === 0) {
    return { fout: `Er staat niets begroot voor ${jaar - 1}.` };
  }

  for (const rij of vorig) {
    await db
      .insert(budgets)
      .values({ jaar, postId: rij.postId, bedragCent: rij.bedragCent })
      .onConflictDoNothing({ target: [budgets.jaar, budgets.postId] });
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Overgenomen uit ${jaar - 1}.` };
}
