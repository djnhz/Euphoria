import "server-only";
import {
  bouwvakIn,
  reserveVakanties,
  type Vakantie,
} from "./schoolvakanties";

/**
 * Schoolvakanties ophalen uit de open data van de rijksoverheid, zodat een nieuw jaar
 * er vanzelf bij komt zodra het gepubliceerd is. De bron dekt zes schooljaren vooruit.
 *
 * Lukt het ophalen niet, dan valt hij terug op de tabel in schoolvakanties.ts. Dat is
 * bewust: liever de data van vorig jaar dan een leeg scherm, en het verschil is
 * zichtbaar via `herkomst`.
 */
const BRON =
  "https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays?output=json";

const REGIO = "midden";

/** Een week cache: deze data verandert hooguit een paar keer per jaar. */
const CACHE_SECONDEN = 60 * 60 * 24 * 7;

type ApiRegio = { region?: string; startdate?: string; enddate?: string };
type ApiVakantie = { type?: string; regions?: ApiRegio[] };
type ApiInhoud = { schoolyear?: string; vacations?: ApiVakantie[] };
type ApiRecord = { content?: ApiInhoud[] };

export type Vakantiegegevens = {
  vakanties: Vakantie[];
  herkomst: "rijksoverheid" | "reserve" | "geen";
  /** Gevuld als het ophalen misging, zodat het scherm eerlijk kan zijn. */
  fout: string | null;
};

/** De API stopt er tabs en regeleinden in; die willen we niet op het scherm. */
function schoon(tekst: string): string {
  return tekst.replace(/\s+/g, " ").trim();
}

/**
 * De einddatum komt als tijdstip vlak voor middernacht in de lokale zone. De datum
 * ervoor is de laatste vakantiedag, dus we nemen simpelweg het datumdeel.
 */
function datumDeel(waarde: string): string {
  return waarde.slice(0, 10);
}

export async function haalVakanties(jaar: number): Promise<Vakantiegegevens> {
  const bouwvak = bouwvakIn(jaar);
  const erbij = (school: Vakantie[]) =>
    bouwvak ? [...school, bouwvak] : school;

  try {
    const antwoord = await fetch(BRON, {
      next: { revalidate: CACHE_SECONDEN },
    });
    if (!antwoord.ok) throw new Error(`status ${antwoord.status}`);

    const data = (await antwoord.json()) as ApiRecord[];
    const gevonden: Vakantie[] = [];

    for (const record of data) {
      for (const inhoud of record.content ?? []) {
        for (const vakantie of inhoud.vacations ?? []) {
          const regio =
            vakantie.regions?.find(
              (r) => schoon(r.region ?? "").toLowerCase() === REGIO,
            ) ??
            // Sommige vakanties gelden landelijk en hebben maar één regel.
            (vakantie.regions?.length === 1 ? vakantie.regions[0] : undefined);
          if (!regio?.startdate || !regio.enddate) continue;

          const van = datumDeel(regio.startdate);
          const tot = datumDeel(regio.enddate);
          // Alleen wat dit kalenderjaar raakt; een schooljaar loopt eroverheen.
          if (!van.startsWith(String(jaar)) && !tot.startsWith(String(jaar))) {
            continue;
          }
          gevonden.push({
            naam: schoon(vakantie.type ?? "Vakantie"),
            soort: "school",
            van,
            tot,
          });
        }
      }
    }

    if (gevonden.length === 0) throw new Error("geen vakanties voor dit jaar");

    // Dubbele periodes kunnen voorkomen omdat schooljaren overlappen.
    const uniek = new Map(gevonden.map((v) => [`${v.naam}|${v.van}`, v]));
    return {
      vakanties: erbij([...uniek.values()].sort((a, b) => a.van.localeCompare(b.van))),
      herkomst: "rijksoverheid",
      fout: null,
    };
  } catch (fout) {
    const reserve = reserveVakanties(jaar);
    return {
      vakanties: erbij(reserve),
      herkomst: reserve.length > 0 ? "reserve" : "geen",
      fout: `Schoolvakanties ophalen mislukte: ${(fout as Error).message}`,
    };
  }
}
