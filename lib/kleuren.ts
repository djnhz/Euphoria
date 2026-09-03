/**
 * De twee huishoudens hebben overal dezelfde kleur: het eerste marineblauw, het
 * tweede messing -- de twee kleuren uit het logo. Op de kalender, in de planning en
 * in de grafieken, zodat een kleur altijd hetzelfde gezin betekent.
 */
export const HUISHOUDKLEUREN = ["#2F5C8A", "#C9A662"] as const;

export function huishoudKleur(index: number): string {
  return HUISHOUDKLEUREN[index] ?? "#3F6B54";
}

/** Voor grafieken met meer dan twee reeksen, in de volgorde van het ontwerp. */
export const REEKSKLEUREN = [
  "#16283F",
  "#2F5C8A",
  "#C9A662",
  "#8A6A2F",
  "#9DB4CE",
  "#3F6B54",
  "#C7C0B2",
] as const;
