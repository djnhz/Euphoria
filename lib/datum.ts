export const MAANDEN = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

/** Vandaag als `YYYY-MM-DD` in lokale tijd. */
export function vandaag(): string {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
}

export function formatDatum(iso: string): string {
  const [jaar, maand, dag] = iso.split("-");
  return `${Number(dag)} ${MAANDEN[Number(maand) - 1]} ${jaar}`;
}

/**
 * Het seizoen waarin gevaren wordt, als je niets anders instelt: maart tot en met
 * oktober. Op het seizoensscherm kun je per jaar een eigen begin en einde kiezen.
 */
export type SeizoenGrenzen = { start: string; eind: string };

export function standaardSeizoen(jaar: number): SeizoenGrenzen {
  return { start: `${jaar}-03-01`, eind: `${jaar}-10-31` };
}

function alsDatum(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function alsIso(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

export function plusDagen(iso: string, dagen: number): string {
  const datum = alsDatum(iso);
  datum.setUTCDate(datum.getUTCDate() + dagen);
  return alsIso(datum);
}

/**
 * ISO-weeknummer. Week 1 is de week met de eerste donderdag van het jaar erin, dus
 * eind december kan al week 1 van het volgende jaar zijn en andersom.
 */
export function isoWeek(iso: string): number {
  const donderdag = alsDatum(iso);
  // Naar de donderdag van dezelfde week schuiven; die bepaalt bij welk jaar hij hoort.
  // getUTCDay geeft zondag als 0; in ISO-telling is zondag dag 7.
  const dagNummer = donderdag.getUTCDay() || 7;
  donderdag.setUTCDate(donderdag.getUTCDate() + 4 - dagNummer);
  const eersteJanuari = new Date(Date.UTC(donderdag.getUTCFullYear(), 0, 1));
  const dagen = (donderdag.getTime() - eersteJanuari.getTime()) / 86_400_000;
  return Math.ceil((dagen + 1) / 7);
}

/** De maandag van de week waarin deze datum valt. */
export function maandagVanWeek(iso: string): string {
  const datum = alsDatum(iso);
  const verschuiving = (datum.getUTCDay() + 6) % 7;
  return plusDagen(iso, -verschuiving);
}

/**
 * Alle dagen van het seizoen: van de eerste maandag op of na het begin tot en met de
 * laatste zondag op of voor het einde. Zo bestaat het seizoen altijd uit hele weken --
 * wat de even-onevenverdeling eenduidig maakt -- en loopt het nooit buiten de
 * gekozen datums. Zonder grenzen is het maart tot en met oktober.
 */
export function dagenInSeizoen(
  jaar: number,
  grenzen: SeizoenGrenzen = standaardSeizoen(jaar),
): string[] {
  let dag = maandagVanWeek(grenzen.start);
  if (dag < grenzen.start) dag = plusDagen(dag, 7);

  let laatsteZondag = plusDagen(maandagVanWeek(grenzen.eind), 6);
  if (laatsteZondag > grenzen.eind) laatsteZondag = plusDagen(laatsteZondag, -7);

  const dagen: string[] = [];
  while (dag <= laatsteZondag) {
    dagen.push(dag);
    dag = plusDagen(dag, 1);
  }
  return dagen;
}

/**
 * Is dit een bruikbaar seizoen voor dit jaar? Beide datums in dat jaar, en minstens
 * één hele week ertussen -- anders valt er niets te verdelen. Geeft de reden terug,
 * of null als het goed is.
 */
export function seizoenFout(jaar: number, grenzen: SeizoenGrenzen): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(grenzen.start) || !iso.test(grenzen.eind)) {
    return "Vul een begin- en einddatum in.";
  }
  if (!grenzen.start.startsWith(`${jaar}-`) || !grenzen.eind.startsWith(`${jaar}-`)) {
    return `Begin en einde moeten allebei in ${jaar} vallen.`;
  }
  if (grenzen.eind <= grenzen.start) return "Het einde moet na het begin liggen.";
  if (dagenInSeizoen(jaar, grenzen).length < 7) {
    return "Daartussen past geen hele week (maandag tot en met zondag).";
  }
  return null;
}

const DAGNAMEN = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

export function dagnaam(iso: string): string {
  return DAGNAMEN[alsDatum(iso).getUTCDay()];
}

/** "vrijdag 26 mrt 2027" — handig als het uitmaakt welke dag van de week het is. */
export function formatDatumMetDag(iso: string): string {
  return `${dagnaam(iso)} ${formatDatum(iso)}`;
}

/** Elke dag van `van` tot en met `tot`, als ISO-datums. */
export function dagenTotEnMet(van: string, tot: string): string[] {
  const dagen: string[] = [];
  let dag = van;
  while (dag <= tot) {
    dagen.push(dag);
    dag = plusDagen(dag, 1);
  }
  return dagen;
}

/**
 * Losse dagen samenvoegen tot aaneengesloten blokken. Een gat splitst het blok, en
 * dat is precies wat er moet gebeuren als iemand een dag midden uit een reservering
 * vrijgeeft: er blijven dan twee reserveringen over in plaats van één.
 */
export function aaneengeslotenBlokken(
  dagen: readonly string[],
): { van: string; tot: string }[] {
  const uniek = [...new Set(dagen)].sort();
  const blokken: { van: string; tot: string }[] = [];
  for (const dag of uniek) {
    const laatste = blokken[blokken.length - 1];
    if (laatste && plusDagen(laatste.tot, 1) === dag) laatste.tot = dag;
    else blokken.push({ van: dag, tot: dag });
  }
  return blokken;
}

/**
 * Zes weken van maandag tot zondag, met lege plekken voor en na de maand. Zowel de
 * grote kalender als de kleine in de periodekiezer tekent hiermee, zodat een dag op
 * beide plekken op dezelfde plek in het raster staat.
 */
export function maandRaster(
  jaar: number,
  maand: number,
): { sleutel: string; datum: string | null }[] {
  const eersteDag = new Date(Date.UTC(jaar, maand - 1, 1));
  // getUTCDay geeft zondag als 0; wij beginnen op maandag.
  const verschuiving = (eersteDag.getUTCDay() + 6) % 7;
  const dagenInMaand = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();

  const cellen: { sleutel: string; datum: string | null }[] = [];
  for (let i = 0; i < verschuiving; i++) {
    cellen.push({ sleutel: `leeg-voor-${i}`, datum: null });
  }
  for (let dag = 1; dag <= dagenInMaand; dag++) {
    const datum = `${jaar}-${String(maand).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
    cellen.push({ sleutel: datum, datum });
  }
  while (cellen.length % 7 !== 0) {
    cellen.push({ sleutel: `leeg-na-${cellen.length}`, datum: null });
  }
  return cellen;
}

/** Een maand terug of vooruit, met de jaarwissel erin verwerkt. */
export function verschuifMaand(
  jaar: number,
  maand: number,
  stappen: number,
): { jaar: number; maand: number } {
  const totaal = jaar * 12 + (maand - 1) + stappen;
  return { jaar: Math.floor(totaal / 12), maand: (totaal % 12) + 1 };
}
