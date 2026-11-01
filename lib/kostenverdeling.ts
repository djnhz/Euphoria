/**
 * Een bon kan regels op meerdere posten hebben: een bouwmarktbon met een tuinslang en
 * een keukenmesje. De begroting rekent per regel en klopt dus altijd; het kostenscherm
 * rekende per bon en hing de hele bon aan de post met de grootste regel. Dan telt een
 * bon van 163,90 helemaal als Interieur terwijl 25,90 daarvan Exterieur was, en lopen
 * de twee schermen uit elkaar.
 *
 * Dit bestand is het stuk dat per regel rekent, zonder database of React erbij zodat
 * `node --test` het draait.
 */

/** Het deel van één bon dat op één post staat. */
export type Deel = {
  postNaam: string;
  postKleur: string;
  hoofdpostNaam: string;
  hoofdpostKleur: string;
  cent: number;
};

export type BonMetDelen = {
  totaalCent: number;
  post: string;
  postKleur: string;
  hoofdpost: string;
  hoofdpostKleur: string;
  delen: Deel[];
};

/**
 * Een bon opgedeeld naar post of hoofdpost: één rij per groep waar hij geld in heeft,
 * elk met alleen dat bedrag. Zo staat een gemengde bon in elke groep met zijn eigen
 * deel, en tellen de groepen precies op tot wat er is uitgegeven.
 *
 * Een bon zonder regels blijft één rij.
 */
export function opgedeeld<T extends BonMetDelen>(
  rij: T,
  niveau: "post" | "hoofdpost",
): T[] {
  const perGroep = new Map<string, { cent: number; grootste: Deel }>();
  for (const deel of rij.delen) {
    const naam = niveau === "post" ? deel.postNaam : deel.hoofdpostNaam;
    const huidig = perGroep.get(naam);
    perGroep.set(naam, {
      cent: (huidig?.cent ?? 0) + deel.cent,
      // De naam en kleur van de grootste regel in die groep, voor het label.
      grootste:
        huidig && huidig.grootste.cent >= deel.cent ? huidig.grootste : deel,
    });
  }
  if (perGroep.size === 0) return [rij];

  return [...perGroep.values()]
    .sort((a, b) => b.cent - a.cent)
    .map(({ cent, grootste }) => ({
      ...rij,
      totaalCent: cent,
      post: grootste.postNaam,
      postKleur: grootste.postKleur,
      hoofdpost: grootste.hoofdpostNaam,
      hoofdpostKleur: grootste.hoofdpostKleur,
    }));
}

/** Per hoofdpost opgeteld uit de regels zelf, voor de grafiek naast de lijst. */
export function perHoofdpost(
  rijen: readonly { delen: readonly Deel[] }[],
): { naam: string; kleur: string; cent: number }[] {
  const per = new Map<string, { kleur: string; cent: number }>();
  for (const rij of rijen) {
    for (const deel of rij.delen) {
      const huidig = per.get(deel.hoofdpostNaam);
      per.set(deel.hoofdpostNaam, {
        kleur: deel.hoofdpostKleur,
        cent: (huidig?.cent ?? 0) + deel.cent,
      });
    }
  }
  return [...per.entries()]
    .map(([naam, { kleur, cent }]) => ({ naam, kleur, cent }))
    .sort((a, b) => b.cent - a.cent);
}
