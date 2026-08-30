import type { Interval } from "@/db/schema";

export const MAANDEN = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

/** Vandaag als `YYYY-MM-DD` in lokale tijd. */
export function vandaag(): string {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
}

/**
 * Een interval verder. Klemt de dag naar het maandeinde, zodat 31 januari plus een
 * maand op 28 (of 29) februari uitkomt en niet op 3 maart.
 */
export function volgendeDatum(iso: string, interval: Interval): string {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  const stap = interval === "maand" ? 1 : interval === "kwartaal" ? 3 : 12;
  const verschoven = maand - 1 + stap;
  const nieuwJaar = jaar + Math.floor(verschoven / 12);
  const nieuwMaand = (verschoven % 12) + 1;
  const laatsteDag = new Date(Date.UTC(nieuwJaar, nieuwMaand, 0)).getUTCDate();
  const nieuwDag = Math.min(dag, laatsteDag);
  return [
    nieuwJaar,
    String(nieuwMaand).padStart(2, "0"),
    String(nieuwDag).padStart(2, "0"),
  ].join("-");
}

export function formatDatum(iso: string): string {
  const [jaar, maand, dag] = iso.split("-");
  return `${Number(dag)} ${MAANDEN[Number(maand) - 1]} ${jaar}`;
}
