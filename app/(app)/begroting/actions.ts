"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
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

  // Wordt de post opgebouwd uit regels, dan hoort dit veld er niet te staan. Het
  // scherm toont het dan ook niet, maar een oud tabblad mag er geen bedrag naast zetten.
  const [regel] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.jaar, jaar),
        eq(budgets.postId, postId),
        isNotNull(budgets.naam),
      ),
    )
    .limit(1);
  if (regel) {
    return { fout: "Deze post wordt opgebouwd uit regels." };
  }

  const losseRij = and(
    eq(budgets.jaar, jaar),
    eq(budgets.postId, postId),
    isNull(budgets.naam),
  );

  const schoon = tekst.trim();
  if (schoon === "") {
    await db.delete(budgets).where(losseRij);
    return { gelukt: "opgeslagen" };
  }

  const bedragCent = parseEuro(schoon);
  if (bedragCent === null || bedragCent < 0) {
    return { fout: `"${schoon}" is geen bedrag.` };
  }

  // Bijwerken als hij er al is, anders aanmaken. De partiele unieke index
  // `budgets_jaar_post_los` vangt af dat twee snelle opslagen twee rijen maken.
  const bijgewerkt = await db
    .update(budgets)
    .set({ bedragCent })
    .where(losseRij)
    .returning({ id: budgets.id });
  if (bijgewerkt.length === 0) {
    await db
      .insert(budgets)
      .values({ jaar, postId, bedragCent, naam: null })
      .onConflictDoNothing();
  }

  return { gelukt: "opgeslagen" };
}

/** Wat het bewerkblad terugstuurt: de post zelf plus zijn volledige lijst regels. */
export type PostInvoer = {
  naam: string;
  kleur: string;
  actief: boolean;
  /** 0 of null betekent: eigen hoofdpost. */
  ouderId: number | null;
  regels: { naam: string; bedrag: string }[];
};

/**
 * Alles van een post in een keer wegschrijven: naam, kleur, of hij nog meedoet, en de
 * regels die zijn begrote bedrag opbouwen. Een blad met een opslaanknop in plaats van
 * een veld dat zichzelf bewaart, want bij een lijst met velden gaan uitgestelde
 * opslagen en verversingen elkaar in de weg zitten.
 *
 * Neon spreekt over HTTP en kent geen transacties, en de rest van deze app gebruikt ze
 * ook nergens. Daarom eerst de oude regels weg en dan de nieuwe erin: gaat er halverwege
 * iets mis, dan staat er hooguit een post zonder begroting en nooit een verzonnen bedrag.
 */
export async function bewaarPostAction(
  jaar: number,
  postId: number,
  invoer: PostInvoer,
): Promise<BegrotingState> {
  await vereisGebruiker();

  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2100) {
    return { fout: "Ongeldig jaar." };
  }
  if (!Number.isInteger(postId) || postId <= 0) {
    return { fout: "Onbekende post." };
  }

  const naam = invoer.naam.trim();
  if (naam.length < 1 || naam.length > 60) {
    return { fout: "Geef de post een naam van maximaal 60 tekens." };
  }
  if (!KLEUR.test(invoer.kleur)) return { fout: "Ongeldige kleur." };

  const [bestaat] = await db
    .select({ id: posten.id })
    .from(posten)
    .where(eq(posten.id, postId));
  if (!bestaat) return { fout: "Die post bestaat niet meer." };

  // Zichzelf als ouder, een ouder die zelf al ergens onder hangt, of een post die zelf
  // subposten heeft -- elk van de drie zou de boom van twee lagen breken.
  let ouderId: number | null = null;
  const gekozenOuder = invoer.ouderId ?? 0;
  if (
    Number.isInteger(gekozenOuder) &&
    gekozenOuder > 0 &&
    gekozenOuder !== postId
  ) {
    const [ouder] = await db
      .select({ ouderId: posten.ouderId })
      .from(posten)
      .where(eq(posten.id, gekozenOuder));
    if (!ouder) return { fout: "Die hoofdpost bestaat niet." };
    if (ouder.ouderId !== null) {
      return { fout: "Een subpost kan zelf geen subposten hebben." };
    }
    const eigenKinderen = await db
      .select({ id: posten.id })
      .from(posten)
      .where(eq(posten.ouderId, postId));
    if (eigenKinderen.length > 0) {
      return {
        fout: "Deze post heeft zelf subposten en kan er dus niet onder hangen.",
      };
    }
    ouderId = gekozenOuder;
  }

  // Eerst alle regels nalopen, zodat een fout halverwege niets half heeft opgeslagen.
  const schoon: { naam: string; bedragCent: number }[] = [];
  for (const regel of invoer.regels) {
    const regelNaam = regel.naam.trim();
    if (regelNaam.length > 60) {
      return { fout: `"${regelNaam.slice(0, 20)}…" is een te lange naam.` };
    }
    const tekst = regel.bedrag.trim();
    const bedragCent = tekst === "" ? 0 : parseEuro(tekst);
    if (bedragCent === null || bedragCent < 0) {
      const waar = regelNaam === "" ? "een regel" : `"${regelNaam}"`;
      return { fout: `Het bedrag bij ${waar} is geen bedrag.` };
    }
    schoon.push({ naam: regelNaam, bedragCent });
  }

  await db
    .update(posten)
    .set({ naam, kleur: invoer.kleur, actief: invoer.actief, ouderId })
    .where(eq(posten.id, postId));

  await db
    .delete(budgets)
    .where(
      and(
        eq(budgets.jaar, jaar),
        eq(budgets.postId, postId),
        isNotNull(budgets.naam),
      ),
    );

  if (schoon.length > 0) {
    // Zijn er regels, dan is het losse bedrag betekenisloos geworden; weg ermee,
    // anders blijft er een getal staan dat niemand meer ziet.
    await db
      .delete(budgets)
      .where(
        and(
          eq(budgets.jaar, jaar),
          eq(budgets.postId, postId),
          isNull(budgets.naam),
        ),
      );
    await db.insert(budgets).values(
      schoon.map((regel, volgorde) => ({
        jaar,
        postId,
        naam: regel.naam,
        bedragCent: regel.bedragCent,
        volgorde,
      })),
    );
  }

  revalidatePath("/begroting");
  revalidatePath("/uitgaven");
  revalidatePath("/");
  return { gelukt: `${naam} opgeslagen.` };
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

  // Posten die dit jaar al iets hebben laten we met rust -- anders zou een post met
  // drie regels er zomaar drie van vorig jaar bij krijgen.
  const bezet = new Set(
    (
      await db
        .select({ postId: budgets.postId })
        .from(budgets)
        .where(eq(budgets.jaar, jaar))
    ).map((r) => r.postId),
  );

  const mee = vorig.filter((rij) => !bezet.has(rij.postId));
  if (mee.length === 0) {
    return {
      fout: `Alles wat in ${jaar - 1} stond heeft dit jaar al een bedrag.`,
    };
  }

  // De onderbouwing komt mee: naam en volgorde gaan gewoon over.
  await db.insert(budgets).values(
    mee.map((rij) => ({
      jaar,
      postId: rij.postId,
      bedragCent: rij.bedragCent,
      naam: rij.naam,
      volgorde: rij.volgorde,
    })),
  );

  revalidatePath("/begroting");
  revalidatePath("/");
  return { gelukt: `Overgenomen uit ${jaar - 1}.` };
}
