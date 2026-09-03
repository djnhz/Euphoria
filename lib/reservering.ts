import { aaneengeslotenBlokken, dagenTotEnMet } from "./datum";

/**
 * Wat er met een reservering moet gebeuren als je er dagen uit haalt. Los van
 * Google Agenda gehouden, want dit is het stuk waar de fout in gaat zitten: een dag
 * uit het midden hoort twee afspraken op te leveren, en een dag aan de rand hoort de
 * bestaande afspraak alleen korter te maken.
 */
export type VrijgeefPlan =
  | { soort: "verwijderen" }
  | {
      soort: "inkorten";
      /** Het eerste overgebleven stuk; dat blijft dezelfde afspraak. */
      houden: { van: string; tot: string };
      /** Verdere stukken worden nieuwe afspraken. Leeg als er niet gesplitst wordt. */
      extra: { van: string; tot: string }[];
    };

/**
 * `van` en `tot` zijn de eerste en laatste vaardag, dus inclusief -- niet de
 * einddatum zoals Google die hanteert.
 */
export function plandVrijgeven(
  van: string,
  tot: string,
  vrij: readonly string[],
): VrijgeefPlan {
  const weg = new Set(vrij);
  const over = dagenTotEnMet(van, tot).filter((dag) => !weg.has(dag));
  if (over.length === 0) return { soort: "verwijderen" };

  const [eerste, ...rest] = aaneengeslotenBlokken(over);
  return { soort: "inkorten", houden: eerste, extra: rest };
}

/**
 * Mag deze gebruiker deze reservering bijstellen? Zonder huishouden is de afspraak
 * rechtstreeks in Google Agenda gezet; die hoort niemand toe, en daar kan iedereen
 * ook in de agenda zelf bij.
 */
export function magBewerken(
  reservering: { coupleId: number | null },
  eigenCoupleId: number,
): boolean {
  return (
    reservering.coupleId === null || reservering.coupleId === eigenCoupleId
  );
}
