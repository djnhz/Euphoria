export const MAANDEN = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
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

/** Het seizoen waarin gevaren wordt. Weken lopen maandag tot en met zondag. */
export const SEIZOEN_START_MAAND = 3; // maart
export const SEIZOEN_EIND_MAAND = 10; // oktober

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
 * Alle dagen van het seizoen: van de eerste maandag op of na 1 maart tot en met de
 * laatste zondag op of voor 31 oktober. Zo bestaat het seizoen altijd uit hele weken —
 * wat de even-onevenverdeling eenduidig maakt — en loopt het niet buiten de afgesproken
 * maanden. Het aantal weken verschilt daardoor per jaar, meestal 34 of 35.
 */
export function dagenInSeizoen(jaar: number): string[] {
  const eersteMaart = `${jaar}-${String(SEIZOEN_START_MAAND).padStart(2, "0")}-01`;
  let dag = maandagVanWeek(eersteMaart);
  if (dag < eersteMaart) dag = plusDagen(dag, 7);

  const laatsteOktober = `${jaar}-${SEIZOEN_EIND_MAAND}-31`;
  let laatsteZondag = plusDagen(maandagVanWeek(laatsteOktober), 6);
  if (laatsteZondag > laatsteOktober) laatsteZondag = plusDagen(laatsteZondag, -7);

  const dagen: string[] = [];
  while (dag <= laatsteZondag) {
    dagen.push(dag);
    dag = plusDagen(dag, 1);
  }
  return dagen;
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
