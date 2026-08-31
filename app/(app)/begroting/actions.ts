"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, budgetItems, budgets, categories, expenseLines } from "@/db";
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
    const budgetItemId = Number(treffer[1]);
    const tekst = String(waarde).trim();

    if (tekst === "") {
      teWissen.push(budgetItemId);
      continue;
    }
    const bedragCent = parseEuro(tekst);
    if (bedragCent === null || bedragCent < 0) {
      return { fout: `"${tekst}" is geen bedrag.` };
    }

    await db
      .insert(budgets)
      .values({ jaar, budgetItemId, bedragCent })
      .onConflictDoUpdate({
        target: [budgets.jaar, budgets.budgetItemId],
        set: { bedragCent },
      });
  }

  if (teWissen.length > 0) {
    await db
      .delete(budgets)
      .where(
        and(eq(budgets.jaar, jaar), inArray(budgets.budgetItemId, teWissen)),
      );
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Begroting ${jaar} opgeslagen.` };
}

/** Een nieuwe post om op te begroten. Los van de categorieën van de uitgaven. */
export async function nieuwePostAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "#64748b");
  if (naam.length < 1 || naam.length > 60) return { fout: "Vul een naam in." };
  if (!KLEUR.test(kleur)) return { fout: "Ongeldige kleur." };

  try {
    await db.insert(budgetItems).values({ naam, kleur });
  } catch {
    return { fout: "Die post bestaat al." };
  }

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
  return { gelukt: `${naam} toegevoegd.` };
}

/** Naam of kleur bijwerken, of een post buiten gebruik stellen. */
export async function wijzigPostAction(formData: FormData) {
  await vereisGebruiker();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const naam = String(formData.get("naam") ?? "").trim();
  const kleur = String(formData.get("kleur") ?? "");

  await db
    .update(budgetItems)
    .set({
      ...(naam ? { naam } : {}),
      ...(KLEUR.test(kleur) ? { kleur } : {}),
      actief: formData.get("actief") === "on",
    })
    .where(eq(budgetItems.id, id));

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
}

/**
 * Regels zonder post krijgen de post van hun categorie. Alleen lege regels, dus wat
 * je met de hand hebt gezet blijft staan. Handig na het leggen van de koppelingen.
 */
export async function volgKoppelingAction(
  _vorige: BegrotingState,
  _formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const gekoppeld = await db
    .select({ id: categories.id, budgetItemId: categories.budgetItemId })
    .from(categories);

  let bijgewerkt = 0;
  for (const categorie of gekoppeld) {
    if (categorie.budgetItemId === null) continue;
    const rijen = await db
      .update(expenseLines)
      .set({ budgetItemId: categorie.budgetItemId })
      .where(
        and(
          eq(expenseLines.categoryId, categorie.id),
          isNull(expenseLines.budgetItemId),
        ),
      )
      .returning({ id: expenseLines.id });
    bijgewerkt += rijen.length;
  }

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
  return bijgewerkt === 0
    ? { fout: "Er viel niets toe te wijzen. Koppel eerst posten aan categorieën." }
    : { gelukt: `${bijgewerkt} regel${bijgewerkt === 1 ? "" : "s"} toegewezen.` };
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
      .values({
        jaar,
        budgetItemId: rij.budgetItemId,
        bedragCent: rij.bedragCent,
      })
      .onConflictDoNothing({ target: [budgets.jaar, budgets.budgetItemId] });
  }

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Overgenomen uit ${jaar - 1}.` };
}
