"use client";

import { useActionState } from "react";
import KleurKiezer from "./KleurKiezer";
import {
  nieuwePostAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";

/**
 * Een post erbij. Met `ouderId` gevuld wordt het een subpost van die post, en dan
 * staat de hoofdpost dus al vast -- vandaar geen keuzelijst.
 *
 * Eigen bestand omdat zowel het overzicht als het bewerkblad hem gebruikt; anders
 * zouden die twee elkaar over en weer moeten importeren.
 */
export default function NieuwePost({
  ouderId,
  klaar,
}: {
  ouderId: number | null;
  /** Wordt aangeroepen zodra het toevoegen gelukt is, zodat het blad kan sluiten. */
  klaar?: () => void;
}) {
  const [state, toevoegen, bezig] = useActionState<BegrotingState, FormData>(
    async (vorige, formulier) => {
      const uitkomst = await nieuwePostAction(vorige, formulier);
      if (!uitkomst?.fout) klaar?.();
      return uitkomst;
    },
    null,
  );

  return (
    <form action={toevoegen} className="flex flex-col gap-3">
      {ouderId !== null && <input type="hidden" name="ouder" value={ouderId} />}
      <input
        name="naam"
        required
        maxLength={60}
        placeholder={ouderId === null ? "Nieuwe post" : "Naam van de subpost"}
        className="rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <KleurKiezer begin="#2F5C8A" label="Kleur" />
        <button
          disabled={bezig}
          className="ml-auto rounded-xl bg-inkt px-4 py-3 text-sm font-semibold text-linnen disabled:opacity-50"
        >
          Toevoegen
        </button>
      </div>
      {state?.fout && (
        <p className="text-sm text-slecht text-pretty">{state.fout}</p>
      )}
      {state?.gelukt && <p className="text-sm text-goed">{state.gelukt}</p>}
    </form>
  );
}
