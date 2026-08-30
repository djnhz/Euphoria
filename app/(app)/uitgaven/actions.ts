"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, categories, documents, expenseLines, expenses } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { analyseerBon, maakVoorbeeld, type Bon } from "@/lib/receipt";

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
  // Regels en gekoppelde documentrijen gaan mee via de cascade in het schema.
  await db.delete(expenses).where(eq(expenses.id, id));
  revalidatePath("/");
  revalidatePath("/uitgaven");
  redirect("/uitgaven");
}

export type AnalyseAntwoord = {
  documentId: number;
  voorbeeldUrl: string | null;
  bon: Bon | null;
  fout: string | null;
};

/**
 * Wordt aangeroepen nadat de browser het origineel naar Blob heeft gezet. Slaat het
 * document op, maakt een verkleinde kopie en laat het model de bon lezen.
 */
export async function analyseerUploadAction(bestand: {
  url: string;
  naam: string;
  mime: string;
  grootteBytes: number;
}): Promise<AnalyseAntwoord> {
  const gebruiker = await vereisGebruiker();

  const voorbeeld = bestand.mime.startsWith("image/")
    ? await maakVoorbeeld(bestand.url, bestand.naam.replace(/\.[^.]+$/, ""))
    : null;

  const [document] = await db
    .insert(documents)
    .values({
      naam: bestand.naam,
      map: "bon",
      mime: bestand.mime,
      grootteBytes: bestand.grootteBytes,
      url: bestand.url,
      voorbeeldUrl: voorbeeld?.url ?? null,
      geuploadDoor: gebruiker.id,
    })
    .returning({ id: documents.id });

  if (!voorbeeld) {
    return {
      documentId: document.id,
      voorbeeldUrl: null,
      bon: null,
      fout: "Dit bestand is geen afbeelding, dus vul de regels zelf in.",
    };
  }

  const actieveCategorieen = await db
    .select({ naam: categories.naam })
    .from(categories)
    .where(eq(categories.actief, true));

  const resultaat = await analyseerBon(
    voorbeeld.base64,
    actieveCategorieen.map((c) => c.naam),
  );

  return {
    documentId: document.id,
    voorbeeldUrl: voorbeeld.url,
    bon: resultaat.ok ? resultaat.bon : null,
    fout: resultaat.ok ? null : resultaat.fout,
  };
}
