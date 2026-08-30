"use server";

import { revalidatePath } from "next/cache";
import { eq, not } from "drizzle-orm";
import { z } from "zod";
import { db, recurring } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { parseEuro } from "@/lib/geld";

const VasteLastInvoer = z.object({
  omschrijving: z.string().trim().min(1).max(200),
  categoryId: z.coerce.number().int().positive(),
  bedragCent: z.number().int().positive(),
  interval: z.enum(["maand", "kwartaal", "jaar"]),
  volgendeDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  coupleId: z.coerce.number().int().positive(),
  aandeelAPct: z.coerce.number().int().min(0).max(100),
});

export type VasteLastState = { fout: string } | null;

export async function bewaarVasteLastAction(
  _vorige: VasteLastState,
  formData: FormData,
): Promise<VasteLastState> {
  await vereisGebruiker();

  const bedragCent = parseEuro(String(formData.get("bedrag") ?? ""));
  if (bedragCent === null || bedragCent <= 0) {
    return { fout: "Vul een geldig bedrag in." };
  }

  const gelezen = VasteLastInvoer.safeParse({
    omschrijving: formData.get("omschrijving"),
    categoryId: formData.get("categoryId"),
    bedragCent,
    interval: formData.get("interval"),
    volgendeDatum: formData.get("volgendeDatum"),
    coupleId: formData.get("coupleId"),
    aandeelAPct: formData.get("aandeelAPct"),
  });
  if (!gelezen.success) {
    return { fout: gelezen.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  await db.insert(recurring).values(gelezen.data);
  revalidatePath("/vaste-lasten");
  return null;
}

export async function wisselVasteLastAction(formData: FormData) {
  await vereisGebruiker();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db
    .update(recurring)
    .set({ actief: not(recurring.actief) })
    .where(eq(recurring.id, id));
  revalidatePath("/vaste-lasten");
}

export async function verwijderVasteLastAction(formData: FormData) {
  await vereisGebruiker();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  // Al aangemaakte uitgaven blijven staan; alleen de terugkerende post verdwijnt.
  await db.delete(recurring).where(eq(recurring.id, id));
  revalidatePath("/vaste-lasten");
}
