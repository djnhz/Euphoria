"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { verwijderBestand } from "@/lib/opslag";
import { z } from "zod";
import { db, documents } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { maakVoorbeeld } from "@/lib/receipt";
import { MAPPEN } from "@/lib/mappen";

const DocumentInvoer = z.object({
  url: z.string().min(1).max(2000),
  opslag: z.enum(["blob", "lokaal", "drive"]),
  naam: z.string().trim().min(1).max(300),
  mime: z.string().max(200),
  grootteBytes: z.number().int().min(0),
  map: z.enum(MAPPEN),
  expenseId: z.number().int().positive().nullable(),
});

export async function registreerDocumentAction(
  ruw: z.input<typeof DocumentInvoer>,
) {
  const gebruiker = await vereisGebruiker();
  const invoer = DocumentInvoer.parse(ruw);

  // Alleen afbeeldingen krijgen een verkleinde voorbeeldweergave; een PDF niet.
  const voorbeeld = invoer.mime.startsWith("image/")
    ? await maakVoorbeeld(invoer.url, invoer.naam.replace(/\.[^.]+$/, ""))
    : null;

  await db.insert(documents).values({
    naam: invoer.naam,
    map: invoer.map,
    mime: invoer.mime,
    grootteBytes: invoer.grootteBytes,
    opslag: invoer.opslag,
    url: invoer.url,
    voorbeeldUrl: voorbeeld?.url ?? null,
    expenseId: invoer.expenseId,
    geuploadDoor: gebruiker.id,
  });

  revalidatePath("/documenten");
}

export async function verwijderDocumentAction(formData: FormData) {
  await vereisGebruiker();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const [rij] = await db.select().from(documents).where(eq(documents.id, id));
  if (!rij) return;

  await db.delete(documents).where(eq(documents.id, id));
  // Blob opruimen na de databaserij: mislukt dit, dan blijft er hooguit een
  // ongebruikt bestand achter in plaats van een rij die naar niets wijst.
  const teVerwijderen = [rij.url, rij.voorbeeldUrl].filter(
    (url): url is string => Boolean(url),
  );
  await Promise.allSettled(teVerwijderen.map((url) => verwijderBestand(url)));

  revalidatePath("/documenten");
}
