"use client";

import { useActionState } from "react";
import {
  nieuwSeizoenAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

/** Een suggestie, geen dwang: "Seizoen 2026/2027" dekt een winter die over de
 * jaarwisseling heen loopt net zo goed als een los jaartal. */
function suggestie(): string {
  const jaar = new Date().getFullYear();
  return `Seizoen ${jaar}/${jaar + 1}`;
}

export default function NieuwSeizoenFormulier({
  huidig,
}: {
  huidig: string | null;
}) {
  const [state, formAction, bezig] = useActionState<MeldingState, FormData>(
    nieuwSeizoenAction,
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Huidig seizoen:{" "}
        <span className="font-medium">{huidig ?? "nog geen bon ingediend"}</span>
      </p>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-gedempt">Naam van het nieuwe seizoen</span>
          <input
            name="naam"
            placeholder={suggestie()}
            maxLength={60}
            required
            className="rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm"
          />
        </label>
        <button
          disabled={bezig}
          className="rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen disabled:opacity-50"
        >
          Nieuw seizoen starten
        </button>
      </form>
      <Melding state={state} />
    </div>
  );
}
