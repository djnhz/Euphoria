"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, categories, documents, expenseLines, expenses } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { verwijderBestand } from "@/lib/opslag";
import {
  analyseerBon,
  maakVoorbeeld,
  pdfTekst,
  voorbeeldBase64,
  type AnalyseBron,
  type Bon,
} from "@/lib/receipt";

/**
 * Alles wat hier binnenkomt is invoer van de browser en wordt daarom gevalideerd,
 * ook al vult het eigen formulier het netjes in.
 */
const RegelInvoer = z.object({
  omschrijving: z.string().trim().min(1).max(300),
  aantal: z.number().int().min(1).max(9999),
  bedragCent: z.number().int().min(-10_000_000).max(10_000_000),
  categoryId: z.number().int().positive(),
  aandeelAPct: z.number().int().min(0).max(100),
  bron: z.enum(["handmatig", "ai"]),
});

const UitgaveInvoer = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum"),
  leverancier: z.string().trim().max(200),
  opmerking: z.string().trim().max(1000),
  coupleId: z.number().int().positive(),
  documentIds: z.array(z.number().int().positive()),
  regels: z.array(RegelInvoer).min(1, "Voeg minstens een regel toe"),
});

export type BewaarState = { fout: string } | null;

function leesInvoer(formData: FormData) {
  return UitgaveInvoer.safeParse(
    JSON.parse(String(formData.get("payload") ?? "{}")),
  );
}

export async function bewaarUitgaveAction(
  _vorige: BewaarState,
  formData: FormData,
): Promise<BewaarState> {
  const gebruiker = await vereisGebruiker();
  const gelezen = leesInvoer(formData);
  if (!gelezen.success) {
    return { fout: gelezen.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const invoer = gelezen.data;

  const [uitgave] = await db
    .insert(expenses)
    .values({
      coupleId: invoer.coupleId,
      userId: gebruiker.id,
      datum: invoer.datum,
      leverancier: invoer.leverancier,
      opmerking: invoer.opmerking,
      analyseStatus: invoer.regels.some((r) => r.bron === "ai")
        ? "gelukt"
        : "geen",
    })
    .returning({ id: expenses.id });

  await db.insert(expenseLines).values(
    invoer.regels.map((regel, volgorde) => ({
      expenseId: uitgave.id,
      ...regel,
      volgorde,
    })),
  );

  // Alleen losse documenten koppelen die nog nergens aan hangen.
  for (const documentId of invoer.documentIds) {
    await db
      .update(documents)
      .set({ expenseId: uitgave.id })
      .where(and(eq(documents.id, documentId), isNull(documents.expenseId)));
  }

  revalidatePath("/");
  revalidatePath("/uitgaven");
  redirect(`/uitgaven/${uitgave.id}`);
}

export async function wijzigUitgaveAction(
  id: number,
  _vorige: BewaarState,
  formData: FormData,
): Promise<BewaarState> {
  await vereisGebruiker();
  const gelezen = leesInvoer(formData);
  if (!gelezen.success) {
    return { fout: gelezen.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const invoer = gelezen.data;

  await db
    .update(expenses)
    .set({
      coupleId: invoer.coupleId,
      datum: invoer.datum,
      leverancier: invoer.leverancier,
      opmerking: invoer.opmerking,
    })
    .where(eq(expenses.id, id));

  // Regels worden vervangen in plaats van bijgewerkt: het formulier stuurt altijd de
  // volledige lijst, dus verschillen uitrekenen zou alleen maar code toevoegen.
  await db.delete(expenseLines).where(eq(expenseLines.expenseId, id));
  await db.insert(expenseLines).values(
    invoer.regels.map((regel, volgorde) => ({
      expenseId: id,
      ...regel,
      volgorde,
    })),
  );

  revalidatePath("/");
  revalidatePath("/uitgaven");
  revalidatePath(`/uitgaven/${id}`);
  redirect(`/uitgaven/${id}`);
}

export async function verwijderUitgaveAction(id: number) {
  await vereisGebruiker();

  // De cascade in het schema ruimt de rijen op, maar niet de bestanden erachter.
  // Die eerst ophalen, anders blijven ze voorgoed staan en kosten ze opslag.
  const bestanden = await db
    .select({ url: documents.url, voorbeeldUrl: documents.voorbeeldUrl })
    .from(documents)
    .where(eq(documents.expenseId, id));

  await db.delete(expenses).where(eq(expenses.id, id));
  await Promise.allSettled(
    bestanden
      .flatMap((bestand) => [bestand.url, bestand.voorbeeldUrl])
      .filter((url): url is string => Boolean(url))
      .map((url) => verwijderBestand(url)),
  );

  revalidatePath("/");
  revalidatePath("/uitgaven");
  revalidatePath("/documenten");
  redirect("/uitgaven");
}


const BestandInvoer = z.object({
  url: z.string().min(1).max(2000),
  opslag: z.enum(["blob", "lokaal", "drive"]),
  naam: z.string().trim().min(1).max(300),
  mime: z.string().max(200),
  grootteBytes: z.number().int().min(0),
});

export type BewaardeBon = {
  documentId: number;
  naam: string;
  url: string;
  voorbeeldUrl: string | null;
  /** Foto of PDF met tekst; een gescande PDF of ander bestand valt af. */
  analyseerbaar: boolean;
};

/**
 * Opslaan gebeurt altijd en staat los van de analyse: het bestand is bewaard zodra het
 * binnen is, ook zonder OpenAI-sleutel of als het uitlezen later misgaat.
 */
export async function bewaarBonAction(
  ruw: z.input<typeof BestandInvoer>,
): Promise<BewaardeBon> {
  const gebruiker = await vereisGebruiker();
  const invoer = BestandInvoer.parse(ruw);

  const voorbeeld = invoer.mime.startsWith("image/")
    ? await maakVoorbeeld(invoer.url, invoer.naam.replace(/\.[^.]+$/, ""))
    : null;

  const [document] = await db
    .insert(documents)
    .values({
      naam: invoer.naam,
      map: "bon",
      mime: invoer.mime,
      grootteBytes: invoer.grootteBytes,
      opslag: invoer.opslag,
      url: invoer.url,
      voorbeeldUrl: voorbeeld?.url ?? null,
      geuploadDoor: gebruiker.id,
    })
    .returning({ id: documents.id });

  revalidatePath("/documenten");
  return {
    documentId: document.id,
    naam: invoer.naam,
    url: invoer.url,
    voorbeeldUrl: voorbeeld?.url ?? null,
    analyseerbaar: voorbeeld !== null || invoer.mime === "application/pdf",
  };
}

export type AnalyseAntwoord = { bon: Bon | null; fout: string | null };

/** Wordt met de hand gestart vanuit het formulier, nooit vanzelf bij het uploaden. */
export async function analyseerDocumentAction(
  documentId: number,
): Promise<AnalyseAntwoord> {
  await vereisGebruiker();

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!document) return { bon: null, fout: "Dat bestand bestaat niet meer." };

  const bron = await kiesBron(document.mime, document.url, document.voorbeeldUrl);
  if (!bron) {
    return {
      bon: null,
      fout: document.mime === "application/pdf"
        ? "Deze PDF bevat geen tekst, waarschijnlijk een scan. Fotografeer hem of vul de regels zelf in."
        : "Uit dit bestand valt niets uit te lezen.",
    };
  }

  const actieveCategorieen = await db
    .select({ naam: categories.naam })
    .from(categories)
    .where(eq(categories.actief, true));

  const resultaat = await analyseerBon(
    bron,
    actieveCategorieen.map((c) => c.naam),
  );
  return resultaat.ok
    ? { bon: resultaat.bon, fout: null }
    : { bon: null, fout: resultaat.fout };
}

/** Een PDF gaat als tekst naar het model, een foto als plaatje. */
async function kiesBron(
  mime: string,
  url: string,
  voorbeeldUrl: string | null,
): Promise<AnalyseBron | null> {
  if (mime === "application/pdf") {
    const tekst = await pdfTekst(url);
    return tekst ? { soort: "tekst", tekst } : null;
  }
  // Liever de al verkleinde kopie: die is klaar en scheelt het origineel opnieuw halen.
  const base64 = await voorbeeldBase64(voorbeeldUrl ?? url);
  return base64 ? { soort: "afbeelding", base64 } : null;
}
