/**
 * Wie welk soort melding mag krijgen. Los van het versturen gehouden zodat de regel
 * te testen is zonder database of pushdienst -- en omdat het scherm en de server
 * hem allebei nodig hebben, elk aan hun eigen kant.
 */

export type MeldingSoort = "bon" | "taak" | "vrijgave";

export const MELDING_SOORTEN: readonly MeldingSoort[] = [
  "bon",
  "taak",
  "vrijgave",
] as const;

/**
 * Een bon en een taak gaan naar de beheerder: die houdt de boekhouding en de
 * klussenlijst bij. Een vrijgegeven dag raakt iedereen, want daar komt boot van vrij.
 */
export function magOntvangen(
  soort: MeldingSoort,
  gebruiker: { beheerder: boolean },
): boolean {
  return soort === "vrijgave" ? true : gebruiker.beheerder;
}

/** De keuzes die je deze gebruiker in het scherm mag voorleggen. */
export function keuzesVoor(gebruiker: { beheerder: boolean }): MeldingSoort[] {
  return MELDING_SOORTEN.filter((soort) => magOntvangen(soort, gebruiker));
}

export const MELDING_LABELS: Record<
  MeldingSoort,
  { titel: string; uitleg: string }
> = {
  bon: {
    titel: "Nieuwe bon",
    uitleg: "Als iemand een uitgave indient.",
  },
  taak: {
    titel: "Taken",
    uitleg: "Een nieuwe klus, of iemand meldt zich aan om samen op te pakken.",
  },
  vrijgave: {
    titel: "Vrijgegeven dagen",
    uitleg:
      "Als iemand dagen uit een reservering haalt, en de boot dus vrij is.",
  },
};
