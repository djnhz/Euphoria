"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, aiGebruik, posten, documents, expenseLines, expenses } from "@/db";
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
  /** De post waarop de regel drukt: hoofdpost of subpost. */
  postId: z.number().int().positive(),
  // Geen aandeel: kosten gaan altijd half om half. De kolom houdt zijn standaard 50,
  // zodat de verrekening blijft rekenen zoals ze deed.
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


/** Hexadecimale SHA-256, precies 64 tekens. */
const HashInvoer = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .nullable();

const BestandInvoer = z.object({
  url: z.string().min(1).max(2000),
  opslag: z.enum(["blob", "lokaal", "drive"]),
  naam: z.string().trim().min(1).max(300),
  mime: z.string().max(200),
  grootteBytes: z.number().int().min(0),
  /** SHA-256 uit de browser; null als die het niet kon uitrekenen. */
  hash: HashInvoer,
});

export type BewaardeBon = {
  documentId: number;
  naam: string;
  mime: string;
  url: string;
  voorbeeldUrl: string | null;
  hash: string | null;
  /** Foto of PDF met tekst; een gescande PDF of ander bestand valt af. */
  analyseerbaar: boolean;
};

/** Een bestand met dezelfde inhoud dat al in de app staat. */
export type BestaandeBon = BewaardeBon & {
  map: string;
  geuploadOp: string;
  /** Gevuld zodra het bestand al aan een uitgave hangt. */
  uitgave: { id: number; datum: string; leverancier: string } | null;
};

/** Alleen een foto of een PDF valt uit te lezen; de rest is opslag. */
function isAnalyseerbaar(mime: string, voorbeeldUrl: string | null): boolean {
  return voorbeeldUrl !== null || mime === "application/pdf";
}

/**
 * Zoekt op inhoud, niet op naam: dezelfde foto onder een andere naam is nog steeds
 * dezelfde bon. Wordt aangeroepen vóór het uploaden, zodat een dubbele bon niet eerst
 * de opslag in gaat.
 */
export async function zoekBonAction(
  ruweHash: string,
): Promise<BestaandeBon | null> {
  await vereisGebruiker();
  const gelezen = HashInvoer.safeParse(ruweHash);
  if (!gelezen.success || gelezen.data === null) return null;

  const [rij] = await db
    .select({
      documentId: documents.id,
      naam: documents.naam,
      map: documents.map,
      mime: documents.mime,
      url: documents.url,
      voorbeeldUrl: documents.voorbeeldUrl,
      hash: documents.hash,
      geuploadOp: documents.geuploadOp,
      uitgaveId: expenses.id,
      uitgaveDatum: expenses.datum,
      uitgaveLeverancier: expenses.leverancier,
    })
    .from(documents)
    .leftJoin(expenses, eq(documents.expenseId, expenses.id))
    .where(eq(documents.hash, gelezen.data))
    // De oudste is het origineel; wat daarna binnenkwam is de dubbele.
    .orderBy(asc(documents.id))
    .limit(1);
  if (!rij) return null;

  return {
    documentId: rij.documentId,
    naam: rij.naam,
    map: rij.map,
    mime: rij.mime,
    url: rij.url,
    voorbeeldUrl: rij.voorbeeldUrl,
    hash: rij.hash,
    analyseerbaar: isAnalyseerbaar(rij.mime, rij.voorbeeldUrl),
    geuploadOp: rij.geuploadOp.toISOString(),
    uitgave: rij.uitgaveId
      ? {
          id: rij.uitgaveId,
          datum: rij.uitgaveDatum ?? "",
          leverancier: rij.uitgaveLeverancier ?? "",
        }
      : null,
  };
}

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
      hash: invoer.hash,
      geuploadDoor: gebruiker.id,
    })
    .returning({ id: documents.id });

  revalidatePath("/documenten");
  return {
    documentId: document.id,
    naam: invoer.naam,
    mime: invoer.mime,
    url: invoer.url,
    voorbeeldUrl: voorbeeld?.url ?? null,
    hash: invoer.hash,
    analyseerbaar: isAnalyseerbaar(invoer.mime, voorbeeld?.url ?? null),
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
  if (!bron.ok) return { bon: null, fout: bron.reden };

  const actievePosten = await db
    .select({ naam: posten.naam })
    .from(posten)
    .where(eq(posten.actief, true));

  const resultaat = await analyseerBon(
    bron,
    actievePosten.map((p) => p.naam),
  );
  if (!resultaat.ok) return { bon: null, fout: resultaat.fout };

  // Wat het kostte vastleggen; OpenAI vertelt zelf niet hoeveel tegoed er nog is.
  if (resultaat.verbruik) await db.insert(aiGebruik).values(resultaat.verbruik);

  return { bon: resultaat.bon, fout: null };
}

/**
 * Een PDF gaat als tekst naar het model, een foto als plaatje. Lukt dat niet, dan komt
 * de echte reden mee naar boven in plaats van een algemene melding.
 */
async function kiesBron(
  mime: string,
  url: string,
  voorbeeldUrl: string | null,
): Promise<({ ok: true } & AnalyseBron) | { ok: false; reden: string }> {
  if (mime === "application/pdf") {
    const resultaat = await pdfTekst(url);
    return resultaat.ok
      ? { ok: true, soort: "tekst", tekst: resultaat.tekst }
      : { ok: false, reden: resultaat.reden };
  }
  // Liever de al verkleinde kopie: die is klaar en scheelt het origineel opnieuw halen.
  const base64 = await voorbeeldBase64(voorbeeldUrl ?? url);
  return base64
    ? { ok: true, soort: "afbeelding", base64 }
    : { ok: false, reden: "Uit dit bestand valt geen afbeelding te halen." };
}
