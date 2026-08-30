/**
 * Los van lib/data.ts omdat de filterbalk in de browser draait; via data.ts zou de
 * hele databaselaag mee de clientbundel in.
 */
export const SORTERINGEN = {
  "datum-nieuw": "Nieuwste eerst",
  "datum-oud": "Oudste eerst",
  "bedrag-hoog": "Hoogste bedrag",
  "bedrag-laag": "Laagste bedrag",
  leverancier: "Leverancier A-Z",
} as const;

export type Sortering = keyof typeof SORTERINGEN;

export function isSortering(waarde: string): waarde is Sortering {
  return waarde in SORTERINGEN;
}
