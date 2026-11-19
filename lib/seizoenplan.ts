import { z } from "zod";
import { plusDagen } from "./datum";

const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Een klokmoment, "12:00". */
export const Tijd = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Hoe laat er bij een vakantie gewisseld wordt: de afspraak, aan te passen. */
export const STANDAARD_WISSELTIJD = "12:00";

function isZaterdag(iso: unknown): boolean {
  return (
    typeof iso === "string" &&
    Iso.safeParse(iso).success &&
    new Date(`${iso}T00:00:00Z`).getUTCDay() === 6
  );
}

/**
 * Een ingeplande periode. `van` is de eerste dag, `tot` de dag erna waarop het weer
 * van een ander is: gerekend wordt in nachten, van `van` tot en met de dag vóór `tot`.
 *
 * Een vakantie heeft `tijden`: wanneer je aan boord komt en wanneer je op `tot` weer
 * van boord gaat, standaard zaterdag 12:00 tot zaterdag 12:00. Op die wisseldag kan
 * de ander vanaf dat moment meteen weer aan boord. Zonder `tijden` -- een omgezette
 * week -- gaat het gewoon om hele dagen, zonder wisselmoment.
 */
export const VakantiePeriode = z.preprocess(
  (ruw) => {
    if (!ruw || typeof ruw !== "object") return ruw;
    const rij = { ...(ruw as Record<string, unknown>) };
    // Plannen van voor de exacte datums kenden alleen hele weken: van de maandag van
    // de eerste week tot en met de maandag van de laatste. Dat zijn precies de nachten
    // van die maandag tot de maandag na de laatste week, in hele dagen.
    if ("vanMaandag" in rij && "totMaandag" in rij && !("van" in rij)) {
      const { vanMaandag, totMaandag, ...rest } = rij;
      return {
        ...rest,
        van: vanMaandag,
        tot:
          typeof totMaandag === "string" && Iso.safeParse(totMaandag).success
            ? plusDagen(totMaandag, 7)
            : totMaandag,
        tijden: null,
      };
    }
    // Kort bestonden er periodes met datums maar nog zonder tijden. Zaterdag tot
    // zaterdag was een vakantie met de wissel om 12:00; de rest kwam van "omzetten".
    if (!("tijden" in rij)) {
      rij.tijden =
        isZaterdag(rij.van) && isZaterdag(rij.tot)
          ? { van: STANDAARD_WISSELTIJD, tot: STANDAARD_WISSELTIJD }
          : null;
    }
    return rij;
  },
  z
    .object({
      id: z.string().min(1).max(80),
      van: Iso,
      tot: Iso,
      coupleId: z.number().int().positive(),
      naam: z.string().max(80),
      tijden: z.object({ van: Tijd, tot: Tijd }).nullable(),
    })
    .refine((p) => p.tot > p.van, "De laatste dag moet na de eerste dag liggen."),
);

export type VakantiePeriode = z.infer<typeof VakantiePeriode>;

/**
 * Wat je op het seizoensscherm hebt ingesteld. Dit is de invoer, niet de uitkomst:
 * de blokken worden er telkens uit gerekend door `lib/seizoen.ts`.
 */
export const SeizoenPlan = z.object({
  onevenCoupleId: z.number().int().positive(),
  /** Feestdagcode naar huishouden; wat er niet in staat volgt het even-onevenpatroon. */
  feestdagen: z.record(z.string().max(20), z.number().int().positive()),
  periodes: z.array(VakantiePeriode).max(60),
  /**
   * Eigen begin en einde van het seizoen. Optioneel, zodat plannen van voor deze
   * instelling gewoon blijven werken: die vallen terug op maart tot en met oktober.
   */
  start: Iso.optional(),
  eind: Iso.optional(),
});

export type SeizoenPlan = z.infer<typeof SeizoenPlan>;

/**
 * Een bewaard plan teruglezen. Een rij die niet meer bij de code past levert null op
 * in plaats van een kapot scherm; je begint dan gewoon opnieuw.
 */
export function leesPlan(ruw: string | null | undefined): SeizoenPlan | null {
  if (!ruw) return null;
  try {
    const gelezen = SeizoenPlan.safeParse(JSON.parse(ruw));
    return gelezen.success ? gelezen.data : null;
  } catch {
    return null;
  }
}
