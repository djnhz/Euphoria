"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db, budgets, expenseLines, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { parseEuro } from "@/lib/geld";

export type BegrotingState = { fout?: string; gelukt?: string } | null;

const KLEUR = /^#[0-9a-fA-F]{6}$/;

/**
 * Een bedrag van een post in een jaar. Wordt aangeroepen zodra je klaar bent met
 * typen, dus er is geen opslaanknop meer. Een leeg veld betekent "niet begroot" en
 * haalt de rij weg; zo blijft er geen nul staan die als bewuste keuze leest.
 *
 * Bewust zonder `revalidatePath`: elke pagina is toch al dynamisch, en verversen
 * tijdens het typen zou de velden onder je handen terugzetten.
 */
export async function zetBedragAction(
  jaar: number,
  postId: number,
  tekst: string,
): Promise<BegrotingState> {
  await vereisGebruiker();

  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2100) {
    return { fout: "Ongeldig jaar." };
  }
  if (!Number.isInteger(postId) || postId <= 0) {
    return { fout: "Onbekende post." };
  }

  const schoon = tekst.trim();
  if (schoon === "") {
    await db
      .delete(budgets)
      .where(and(eq(budgets.jaar, jaar), eq(budgets.postId, postId)));
    return { gelukt: "opgeslagen" };
  }

  const bedragCent = parseEuro(schoon);
  if (bedragCent === null || bedragCent < 0) {
    return { fout: `"${schoon}" is geen bedrag.` };
  }

  await db
    .insert(budgets)
    .values({ jaar, postId, bedragCent })
    .onConflictDoUpdate({
      target: [budgets.jaar, budgets.postId],
      set: { bedragCent },
    });

  return { gelukt: "opgeslagen" };
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

/**
 * Een post weghalen. Alleen als er geen bonregel meer op staat: die regels stilletjes
 * ergens anders heen schuiven zou de cijfers veranderen zonder dat je het ziet.
 * Subposten eronder worden zelf hoofdpost, en begrote bedragen gaan mee weg.
 */
export async function verwijderPostAction(
  _vorige: BegrotingState,
  formData: FormData,
): Promise<BegrotingState> {
  await vereisGebruiker();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { fout: "Onbekende post." };

  const [post] = await db
    .select({ naam: posten.naam })
    .from(posten)
    .where(eq(posten.id, id));
  if (!post) return { fout: "Die post bestaat niet meer." };

  const [telling] = await db
    .select({ aantal: count() })
    .from(expenseLines)
    .where(eq(expenseLines.postId, id));
  if (telling.aantal > 0) {
    const aantal = telling.aantal;
    return {
      fout: `Er ${aantal === 1 ? "staat" : "staan"} ${aantal} bonregel${aantal === 1 ? "" : "s"} op ${post.naam}. Zet die eerst op een andere post, of vink hem uit zodat hij niet meer te kiezen is.`,
    };
  }

  await db.delete(posten).where(eq(posten.id, id));

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
  return { gelukt: `${post.naam} verwijderd.` };
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
