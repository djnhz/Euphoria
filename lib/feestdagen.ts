/**
 * Nederlandse feestdagen zijn rekenbaar, dus geen lijst die elk jaar bijgewerkt moet
 * worden. Pasen via het algoritme van Meeus; Hemelvaart is Pasen plus 39 dagen,
 * Pinksteren plus 49.
 */

export type FeestdagCode = "pasen" | "hemelvaart" | "pinksteren" | "koningsdag";

export type Feestdag = {
  code: FeestdagCode;
  naam: string;
  /** Eerste dag van het lange weekend, ISO `JJJJ-MM-DD`. */
  van: string;
  /** Laatste dag, inclusief. Loopt tot en met de maandag waar die er is. */
  tot: string;
};

function isoVan(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

function plusDagen(datum: Date, dagen: number): Date {
  const nieuw = new Date(datum);
  nieuw.setUTCDate(nieuw.getUTCDate() + dagen);
  return nieuw;
}

/** Eerste paasdag. Algoritme van Meeus, Jones en Butcher voor de gregoriaanse kalender. */
export function pasen(jaar: number): string {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return isoVan(new Date(Date.UTC(jaar, maand - 1, dag)));
}

export function koningsdag(jaar: number): string {
  const zevenentwintig = new Date(Date.UTC(jaar, 3, 27));
  return isoVan(
    zevenentwintig.getUTCDay() === 0
      ? plusDagen(zevenentwintig, -1)
      : zevenentwintig,
  );
}

/**
 * De lange weekenden van een jaar, op datumvolgorde. Elk blok loopt tot en met de
 * maandag als die erbij hoort; Hemelvaart eindigt op zondag en Koningsdag is één dag.
 */
export function feestdagenIn(jaar: number): Feestdag[] {
  const eerstePaasdag = new Date(`${pasen(jaar)}T00:00:00Z`);

  const dagen: Feestdag[] = [
    {
      code: "pasen",
      naam: "Pasen",
      // Goede Vrijdag tot en met Tweede Paasdag.
      van: isoVan(plusDagen(eerstePaasdag, -2)),
      tot: isoVan(plusDagen(eerstePaasdag, 1)),
    },
    {
      code: "hemelvaart",
      naam: "Hemelvaart",
      // Donderdag tot en met zondag; de maandag erna is geen vrije dag.
      van: isoVan(plusDagen(eerstePaasdag, 39)),
      tot: isoVan(plusDagen(eerstePaasdag, 42)),
    },
    {
      code: "pinksteren",
      naam: "Pinksteren",
      // Zaterdag tot en met Tweede Pinksterdag.
      van: isoVan(plusDagen(eerstePaasdag, 48)),
      tot: isoVan(plusDagen(eerstePaasdag, 50)),
    },
    {
      code: "koningsdag",
      naam: "Koningsdag",
      // Valt 27 april op een zondag, dan wordt Koningsdag een dag eerder gevierd.
      van: koningsdag(jaar),
      tot: koningsdag(jaar),
    },
  ];

  return dagen.sort((a, b) => a.van.localeCompare(b.van));
}

/**
 * De feestdagen die binnen een blok vallen, ook als het blok maar een deel ervan
 * raakt. Gebruikt om ze in het weekoverzicht te laten zien: ook een week die je niet
 * aan een feestdag hebt toegewezen kan er een bevatten, en dat wil je zien.
 */
export function feestdagenRakend(
  feestdagen: readonly Feestdag[],
  van: string,
  tot: string,
): Feestdag[] {
  return feestdagen.filter((dag) => dag.van <= tot && dag.tot >= van);
}
