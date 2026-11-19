import { z } from "zod";
import { plusDagen } from "./datum";

const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Een ingeplande vakantie. `van` is de dag waarop je aan boord komt, `tot` de dag
 * waarop je weer van boord gaat -- de wisseldag. De afspraak is van zaterdag 12:00
 * tot zaterdag 12:00, dus op de wisseldag kan de ander vanaf 12:00 meteen weer aan
 * boord, ook voor een eigen vakantie. Gerekend wordt in nachten: de vakantie is van
 * `van` tot en met de dag vóór `tot`.
 */
export const VakantiePeriode = z.preprocess(
  (ruw) => {
    // Plannen van voor de exacte datums kenden alleen hele weken: van de maandag van
    // de eerste week tot en met de maandag van de laatste. Dat zijn precies de nachten
    // van die maandag tot de maandag na de laatste week.
    if (
      ruw &&
      typeof ruw === "object" &&
      "vanMaandag" in ruw &&
      "totMaandag" in ruw &&
      !("van" in ruw)
    ) {
      const { vanMaandag, totMaandag, ...rest } = ruw as Record<string, unknown>;
      return {
        ...rest,
        van: vanMaandag,
        tot:
          typeof totMaandag === "string" && Iso.safeParse(totMaandag).success
            ? plusDagen(totMaandag, 7)
            : totMaandag,
      };
    }
    return ruw;
  },
  z
    .object({
      id: z.string().min(1).max(80),
      van: Iso,
      tot: Iso,
      coupleId: z.number().int().positive(),
      naam: z.string().max(80),
    })
    .refine((p) => p.tot > p.van, "De wisseldag moet na de eerste dag liggen."),
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
