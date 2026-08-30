import "server-only";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { bewaarBestand, leesBestand } from "./opslag";
import { openAiModel, openAiSleutel } from "./instellingen";

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
  const bron = await leesBestand(origineelUrl);
  if (!bron) return null;

  const klein = await verklein(bron);
  if (!klein) return null;

  const bewaard = await bewaarBestand(
    `voorbeeld-${basisnaam}.jpg`,
    "image/jpeg",
    klein,
  );
  return { url: bewaard.url, base64: klein.toString("base64") };
}

async function verklein(bron: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bron)
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
    return null; // geen afbeelding, bijvoorbeeld een PDF
  }
}

/** De base64 van de verkleinde kopie, of null als het bestand geen afbeelding is. */
export async function voorbeeldBase64(url: string): Promise<string | null> {
  const inhoud = await leesBestand(url);
  if (!inhoud) return null;
  const klein = await verklein(inhoud);
  return klein?.toString("base64") ?? null;
}

/**
 * Tekst uit een PDF. Een gewone factuur is digitaal opgemaakt, dus die tekst is
 * exact — nauwkeuriger én goedkoper dan de bladzijde als plaatje laten bekijken.
 * Een gescande PDF levert niets op; dat merk je aan een (bijna) lege uitkomst.
 */
export type PdfResultaat =
  | { ok: true; tekst: string }
  | { ok: false; reden: string };

export async function pdfTekst(url: string): Promise<PdfResultaat> {
  const inhoud = await leesBestand(url);
  if (!inhoud) return { ok: false, reden: "Het bestand is niet op te halen." };

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Geen `useSystemFonts`: een serverless omgeving heeft geen lettertypen op schijf,
    // en voor tekst uitlezen is dat ook nergens voor nodig.
    const document = await pdfjs.getDocument({
      data: new Uint8Array(inhoud),
    }).promise;

    const bladzijden: string[] = [];
    for (let nummer = 1; nummer <= document.numPages; nummer++) {
      const bladzijde = await document.getPage(nummer);
      const stukken = await bladzijde.getTextContent();
      bladzijden.push(
        stukken.items.map((stuk) => ("str" in stuk ? stuk.str : "")).join(" "),
      );
    }
    const tekst = bladzijden.join("\n").replace(/\s+/g, " ").trim();

    if (tekst.length <= 20) {
      return {
        ok: false,
        reden:
          "Deze PDF bevat geen tekst, waarschijnlijk een scan. Fotografeer hem of vul de regels zelf in.",
      };
    }
    return { ok: true, tekst };
  } catch (fout) {
    // Bewust niet inslikken: anders lijkt elk probleem op een gescande PDF.
    return { ok: false, reden: `PDF uitlezen mislukte: ${(fout as Error).message}` };
  }
}

export type AnalyseResultaat =
  | { ok: true; bon: Bon }
  | { ok: false; fout: string };

/** Een foto gaat als plaatje naar het model, een PDF als de tekst die erin staat. */
export type AnalyseBron =
  | { soort: "afbeelding"; base64: string }
  | { soort: "tekst"; tekst: string };

export async function analyseerBon(
  bron: AnalyseBron,
  categorieNamen: string[],
): Promise<AnalyseResultaat> {
  const sleutel = await openAiSleutel();
  if (!sleutel) {
    return {
      ok: false,
      fout: "Er is nog geen OpenAI-sleutel ingesteld; dat kan bij Instellingen.",
    };
  }

  const client = new OpenAI({ apiKey: sleutel });
  const prompt = [
    bron.soort === "tekst"
      ? "Hieronder staat de tekst van een kassabon of factuur van een Nederlandse leverancier."
      : "Je leest een kassabon of factuur van een Nederlandse leverancier.",
    "Geef per artikelregel een aparte regel terug. Sla subtotalen, btw-regels,",
    "verzendkosten-uitsplitsingen, kortingen op het totaal, statiegeld-teruggave",
    "en het eindtotaal over.",
    "",
    "Bedragen in hele centen als geheel getal: 12,34 euro wordt 1234.",
    "Gebruik het regelbedrag inclusief btw, dus wat er daadwerkelijk betaald is.",
    "Staan er per regel twee bedragen, een prijs exclusief btw en een subtotaal",
    "inclusief btw, neem dan het bedrag inclusief btw.",
    "De som van je regels hoort gelijk te zijn aan het eindtotaal op de bon.",
    "Bij meerdere stuks is aantal dat aantal en bedragCent het totaal voor die regel,",
    "niet de stuksprijs.",
    "",
    "datum is de bon- of factuurdatum in ISO (JJJJ-MM-DD), niet de besteldatum als",
    "die verschilt. Kun je hem niet lezen, geef dan een lege string.",
    "leverancier is de naam van de winkel of het bedrijf, niet de klant.",
    "",
    "Kies categorieSuggestie uit precies deze lijst:",
    categorieNamen.join(", "),
    "Weet je het niet zeker, kies dan Overig.",
    ...(bron.soort === "tekst" ? ["", "--- begin tekst ---", bron.tekst] : []),
  ].join("\n");

  try {
    const antwoord = await client.chat.completions.parse({
      model: await openAiModel(),
      messages: [
        {
          role: "user",
          content:
            bron.soort === "tekst"
              ? prompt
              : [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${bron.base64}`,
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

export type TestResultaat = { ok: true; melding: string } | { ok: false; fout: string };

/**
 * Controleert sleutel en model zonder een bon te versturen: het ophalen van een model
 * kost geen tokens, maar faalt wel meteen bij een verkeerde sleutel of modelnaam.
 */
export async function testOpenAi(): Promise<TestResultaat> {
  const sleutel = await openAiSleutel();
  if (!sleutel) return { ok: false, fout: "Er is nog geen sleutel ingesteld." };

  const model = await openAiModel();
  try {
    await new OpenAI({ apiKey: sleutel }).models.retrieve(model);
    return { ok: true, melding: "Verbinding werkt en het model " + model + " bestaat." };
  } catch (fout) {
    const status = (fout as { status?: number }).status;
    if (status === 401) return { ok: false, fout: "De sleutel wordt geweigerd." };
    if (status === 404) {
      return {
        ok: false,
        fout: "Het model " + model + " bestaat niet of hoort niet bij dit account.",
      };
    }
    return { ok: false, fout: (fout as Error).message };
  }
}
