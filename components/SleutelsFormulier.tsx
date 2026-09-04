"use client";

import { useState, useTransition } from "react";
import {
  maakSleutelsAction,
  type MeldingState,
} from "@/app/(app)/instellingen/meldingen";

/**
 * Eenmalig het sleutelpaar voor de meldingen aanmaken. Het staat apart van het
 * meldingenblok omdat het maar één keer hoeft en alleen de beheerder het doet.
 */
export default function SleutelsFormulier() {
  const [melding, setMelding] = useState<MeldingState>(null);
  const [bezig, start] = useTransition();

  return (
    <div>
      <p className="mb-3 text-sm text-gedempt text-pretty">
        Meldingen lopen via de browser zelf en kosten niets. Daar is eenmalig
        een sleutelpaar voor nodig; de private helft blijft versleuteld op de
        server, net als de OpenAI-sleutel.
      </p>
      <button
        type="button"
        disabled={bezig}
        onClick={() =>
          start(async () => setMelding(await maakSleutelsAction()))
        }
        className="rounded-xl bg-inkt px-3.5 py-2.5 text-sm font-semibold text-linnen transition hover:bg-inkt-hover disabled:opacity-50"
      >
        {bezig ? "Bezig…" : "Sleutels aanmaken"}
      </button>
      {melding?.fout && (
        <p className="mt-2 text-sm text-slecht">{melding.fout}</p>
      )}
      {melding?.gelukt && (
        <p className="mt-2 text-sm text-goed">{melding.gelukt}</p>
      )}
    </div>
  );
}
