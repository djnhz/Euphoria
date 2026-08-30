import "server-only";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { put } from "@vercel/blob";

/**
 * De hele koppeling met het model zit in dit bestand, achter een functie. Wil je later
 * naar een andere aanbieder of een lokaal model, dan is dat dit ene bestand. Geen
 * provider-abstractie, geen interface met een implementatie.
 */

/**
 * Vision-modellen schalen alles boven ongeveer deze maat zelf terug. Groter
 * aanleveren kost uploadtijd en tokens en levert geen extra scherpte. Het origineel
 * wordt níet aangeraakt; dit geldt alleen voor de kopie die naar het model gaat.
 */
const MAX_ZIJDE_PX = 2576;

const BonSchema = z.object({
  leverancier: z.string(),
  /** ISO-datum, of leeg als hij niet leesbaar is. */
  datum: z.string(),
  regels: z.array(
    z.object({
      omschrijving: z.string(),
      aantal: z.number(),
      bedragCent: z.number().int(),
      categorieSuggestie: z.string(),
    }),
  ),
});

export type Bon = z.infer<typeof BonSchema>;

/** Verkleinde JPEG-kopie, ook gebruikt als voorbeeldweergave in lijsten. */
export async function maakVoorbeeld(
  origineelUrl: string,
  basisnaam: string,
): Promise<{ url: string; base64: string } | null> {
  const antwoord = await fetch(origineelUrl);
  if (!antwoord.ok) return null;
  const bron = Buffer.from(await antwoord.arrayBuffer());

  let klein: Buffer;
  try {
    klein = await sharp(bron)
      .rotate() // respecteer de EXIF-oriëntatie van de telefoon
      .resize({
        width: MAX_ZIJDE_PX,
        height: MAX_ZIJDE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null; // geen afbeelding (bijvoorbeeld een PDF)
  }

  const blob = await put(`voorbeeld/${basisnaam}.jpg`, klein, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });
  return { url: blob.url, base64: klein.toString("base64") };
}

export type AnalyseResultaat =
  | { ok: true; bon: Bon }
  | { ok: false; fout: string };

export async function analyseerBon(
  afbeeldingBase64: string,
  categorieNamen: string[],
): Promise<AnalyseResultaat> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, fout: "OPENAI_API_KEY ontbreekt." };
  }

  const client = new OpenAI();
  const prompt = [
    "Je leest een kassabon of factuur van een Nederlandse leverancier.",
    "Geef per artikelregel een aparte regel terug. Sla subtotalen, btw-regels,",
    "kortingen op het totaal, statiegeld-teruggave en het eindtotaal over.",
    "",
    "Bedragen in hele centen als geheel getal: 12,34 euro wordt 1234.",
    "Gebruik het regelbedrag inclusief btw, dus wat er daadwerkelijk betaald is.",
    "Bij meerdere stuks is bedragCent het totaal voor die regel, niet de stuksprijs.",
    "",
    "datum is ISO (JJJJ-MM-DD). Kun je hem niet lezen, geef dan een lege string.",
    "",
    "Kies categorieSuggestie uit precies deze lijst:",
    categorieNamen.join(", "),
    "Weet je het niet zeker, kies dan Overig.",
  ].join("\n");

  try {
    const antwoord = await client.chat.completions.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${afbeeldingBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(BonSchema, "bon"),
    });

    const bon = antwoord.choices[0]?.message.parsed;
    if (!bon) return { ok: false, fout: "Het model gaf geen bruikbaar antwoord." };
    return { ok: true, bon };
  } catch (fout) {
    return { ok: false, fout: (fout as Error).message };
  }
}
