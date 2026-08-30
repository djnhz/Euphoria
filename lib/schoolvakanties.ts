/**
 * Schoolvakanties en bouwvak, regio **midden**.
 *
 * Anders dan de feestdagen zijn deze data niet te berekenen: ze worden per schooljaar
 * vastgesteld en gepubliceerd. De schoolvakanties komen daarom uit de open data van de
 * rijksoverheid (zie lib/vakantiebron.ts); de tabel hieronder is het vangnet voor als
 * die bron eruit ligt, en de enige bron voor de bouwvak, want daar is geen API voor.
 *
 * Let op: voorjaars- en herfstvakantie zijn adviesdata waar scholen van mogen afwijken,
 * en de bouwvak is sowieso een adviesperiode. Mei-, zomer- en kerstvakantie liggen vast.
 */

export type VakantieSoort = "school" | "bouwvak";

export type Vakantie = {
  naam: string;
  soort: VakantieSoort;
  /** Eerste dag, ISO. */
  van: string;
  /** Laatste dag, inclusief. */
  tot: string;
};

/**
 * Bouwvak regio midden. Geen officiele API, dus met de hand bijgehouden.
 * Bron: bouwvakkalender.nl, opgehaald 30 augustus 2026. 2028 stond toen nog niet
 * officieel vast en ontbreekt daarom bewust.
 */
export const BOUWVAK: Record<number, { van: string; tot: string }> = {
  2026: { van: "2026-08-03", tot: "2026-08-21" },
  2027: { van: "2027-08-02", tot: "2027-08-20" },
};

/**
 * Vangnet voor de schoolvakanties, regio midden, als de open data niet bereikbaar is.
 * Bron: rijksoverheid.nl, overzicht schoolvakanties per schooljaar, 30 augustus 2026.
 */
const RESERVE: Record<number, Vakantie[]> = {
  2026: [
    { naam: "Meivakantie", soort: "school", van: "2026-04-25", tot: "2026-05-03" },
    { naam: "Zomervakantie", soort: "school", van: "2026-07-18", tot: "2026-08-30" },
    { naam: "Herfstvakantie", soort: "school", van: "2026-10-17", tot: "2026-10-25" },
  ],
  2027: [
    { naam: "Meivakantie", soort: "school", van: "2027-04-24", tot: "2027-05-02" },
    { naam: "Zomervakantie", soort: "school", van: "2027-07-17", tot: "2027-08-29" },
    { naam: "Herfstvakantie", soort: "school", van: "2027-10-16", tot: "2027-10-24" },
  ],
  2028: [
    { naam: "Voorjaarsvakantie", soort: "school", van: "2028-02-26", tot: "2028-03-05" },
    { naam: "Meivakantie", soort: "school", van: "2028-04-29", tot: "2028-05-07" },
    { naam: "Zomervakantie", soort: "school", van: "2028-07-08", tot: "2028-08-20" },
    { naam: "Herfstvakantie", soort: "school", van: "2028-10-21", tot: "2028-10-29" },
  ],
};

export function reserveVakanties(jaar: number): Vakantie[] {
  return RESERVE[jaar] ?? [];
}

export function bouwvakIn(jaar: number): Vakantie | null {
  const periode = BOUWVAK[jaar];
  return periode
    ? { naam: "Bouwvak", soort: "bouwvak", van: periode.van, tot: periode.tot }
    : null;
}

/** De vakanties die een periode raken, bouwvak vooraan want die is het opvallendst. */
export function vakantiesRakend(
  vakanties: readonly Vakantie[],
  van: string,
  tot: string,
): Vakantie[] {
  return vakanties
    .filter((vakantie) => vakantie.van <= tot && vakantie.tot >= van)
    .sort((a, b) => (a.soort === "bouwvak" ? -1 : b.soort === "bouwvak" ? 1 : 0));
}

/**
 * Werkdagen bepalen of een week echt vakantie is. De herfstvakantie begint op een
 * zaterdag, dus de week ervoor heeft wel twee vakantiedagen maar geen enkele vrije
 * werkdag — dat is geen vakantieweek.
 */
function isWerkdag(iso: string): boolean {
  const dag = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dag >= 1 && dag <= 5;
}

function loopDagen(van: string, tot: string, doe: (iso: string) => void): void {
  const eind = Date.parse(`${tot}T00:00:00Z`);
  for (
    let punt = Date.parse(`${van}T00:00:00Z`);
    punt <= eind;
    punt += 86_400_000
  ) {
    doe(new Date(punt).toISOString().slice(0, 10));
  }
}

/** Aantal werkdagen in een periode, grenzen inclusief. */
export function werkdagen(van: string, tot: string): number {
  let aantal = 0;
  loopDagen(van, tot, (dag) => {
    if (isWerkdag(dag)) aantal++;
  });
  return aantal;
}

/** Hoeveel werkdagen van een periode in deze vakantie vallen. */
export function werkdagOverlap(
  vakantie: Vakantie,
  van: string,
  tot: string,
): number {
  const start = vakantie.van > van ? vakantie.van : van;
  const eind = vakantie.tot < tot ? vakantie.tot : tot;
  if (start > eind) return 0;
  return werkdagen(start, eind);
}
