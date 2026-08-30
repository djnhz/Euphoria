/**
 * Losse module, geen `"use server"`-bestand: daar mogen alleen async functies uit,
 * en een geexporteerde constante wordt dan een serverreferentie in plaats van een array.
 */
export const MAPPEN = [
  "bon",
  "factuur",
  "verzekering",
  "onderhoud",
  "registratie",
  "handleiding",
  "overig",
] as const;

export type DocumentMap = (typeof MAPPEN)[number];
