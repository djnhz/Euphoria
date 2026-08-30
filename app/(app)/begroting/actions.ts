"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, budgets, categories } from "@/db";
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
    const treffer = /^onderdeel-(\d+)$/.exec(sleutel);
    if (!treffer) continue;
    const categoryId = Number(treffer[1]);
    const tekst = String(waarde).trim();

    if (tekst === "") {
      teWissen.push(categoryId);
      continue;
    }
    const bedragCent = parseEuro(tekst);
    if (bedragCent === null || bedragCent < 0) {
      return { fout: `"${tekst}" is geen bedrag.` };
    }

    await db
      .insert(budgets)
      .values({ jaar, categoryId, bedragCent })
      .onConflictDoUpdate({
        target: [budgets.jaar, budgets.categoryId],
        set: { bedragCent },
      });
  }

  if (teWissen.length > 0) {
    await db
      .delete(budgets)
      .where(
        and(eq(budgets.jaar, jaar), inArray(budgets.categoryId, teWissen)),
      );
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Begroting ${jaar} opgeslagen.` };
}

/** Een nieuw onderdeel om op te begroten; dat is dezelfde lijst als bij de uitgaven. */
export async function nieuwOnderdeelAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "#64748b");
  if (naam.length < 1 || naam.length > 60) return { fout: "Vul een naam in." };
  if (!KLEUR.test(kleur)) return { fout: "Ongeldige kleur." };

  try {
    await db.insert(categories).values({ naam, kleur });
  } catch {
    return { fout: "Dat onderdeel bestaat al." };
  }

  revalidatePath("/begroting");
  revalidatePath("/instellingen");
  revalidatePath("/");
  return { gelukt: `${naam} toegevoegd.` };
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
      .values({ jaar, categoryId: rij.categoryId, bedragCent: rij.bedragCent })
      .onConflictDoNothing({ target: [budgets.jaar, budgets.categoryId] });
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Overgenomen uit ${jaar - 1}.` };
}
