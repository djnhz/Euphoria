import { z } from "zod";

/**
 * Wat je op het seizoensscherm hebt ingesteld. Dit is de invoer, niet de uitkomst:
 * de blokken worden er telkens uit gerekend door `lib/seizoen.ts`.
 */
export const SeizoenPlan = z.object({
  onevenCoupleId: z.number().int().positive(),
  /** Feestdagcode naar huishouden; wat er niet in staat volgt het even-onevenpatroon. */
  feestdagen: z.record(z.string().max(20), z.number().int().positive()),
  periodes: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        vanMaandag: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        totMaandag: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        coupleId: z.number().int().positive(),
        naam: z.string().max(80),
      }),
    )
    .max(60),
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
