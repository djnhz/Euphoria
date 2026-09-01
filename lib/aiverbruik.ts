import "server-only";
import { gte, sql } from "drizzle-orm";
import { db, aiGebruik } from "@/db";
import { openAiPrijzen } from "./instellingen";

export type Verbruikstand = {
  aantal: number;
  tokensIn: number;
  tokensUit: number;
  /** Geschat, in centen; null zolang de prijs per miljoen tokens niet is ingevuld. */
  kostenCent: number | null;
};

export type VerbruikOverzicht = {
  totaal: Verbruikstand;
  dezeMaand: Verbruikstand;
  prijzen: { inCentPerMiljoen: number | null; uitCentPerMiljoen: number | null };
};

/**
 * Wat de app aan het model heeft uitgegeven. OpenAI geeft geen saldo terug, dus dit
 * telt op wat we zelf bij elke uitgelezen bon hebben genoteerd -- alleen van deze app,
 * en dus niet van al het andere dat op dezelfde sleutel draait.
 */
export async function verbruikOverzicht(): Promise<VerbruikOverzicht> {
  const eersteVanDeMaand = new Date();
  eersteVanDeMaand.setDate(1);
  eersteVanDeMaand.setHours(0, 0, 0, 0);

  const velden = {
    aantal: sql<number>`count(*)::int`,
    tokensIn: sql<number>`coalesce(sum(${aiGebruik.tokensIn}), 0)::int`,
    tokensUit: sql<number>`coalesce(sum(${aiGebruik.tokensUit}), 0)::int`,
  };

  const [[alles], [maand], prijzen] = await Promise.all([
    db.select(velden).from(aiGebruik),
    db.select(velden).from(aiGebruik).where(gte(aiGebruik.gebeurdOp, eersteVanDeMaand)),
    openAiPrijzen(),
  ]);

  function metKosten(rij: {
    aantal: number;
    tokensIn: number;
    tokensUit: number;
  }): Verbruikstand {
    const { inCentPerMiljoen, uitCentPerMiljoen } = prijzen;
    const kostenCent =
      inCentPerMiljoen === null || uitCentPerMiljoen === null
        ? null
        : (rij.tokensIn * inCentPerMiljoen + rij.tokensUit * uitCentPerMiljoen) /
          1_000_000;
    return { ...rij, kostenCent };
  }

  return {
    totaal: metKosten(alles),
    dezeMaand: metKosten(maand),
    prijzen,
  };
}
