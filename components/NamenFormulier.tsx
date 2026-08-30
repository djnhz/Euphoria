"use client";

import { useActionState } from "react";
import {
  wijzigNamenAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

export default function NamenFormulier({
  huishoudens,
  gebruikers,
}: {
  huishoudens: { id: number; naam: string; volgorde: number }[];
  gebruikers: { id: number; naam: string; coupleId: number }[];
}) {
  const [state, formAction, bezig] = useActionState<MeldingState, FormData>(
    wijzigNamenAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {huishoudens.map((huishouden) => (
        <fieldset key={huishouden.id} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gedempt">
              Huishouden {huishouden.volgorde}
            </span>
            <input
              name={`huishouden-${huishouden.id}`}
              defaultValue={huishouden.naam}
              className={invoer}
            />
          </label>
          <div className="grid gap-2 pl-4 sm:grid-cols-2">
            {gebruikers
              .filter((g) => g.coupleId === huishouden.id)
              .map((gebruiker) => (
                <label
                  key={gebruiker.id}
                  className="flex flex-col gap-1 text-sm"
                >
                  <span className="text-gedempt">Naam</span>
                  <input
                    name={`gebruiker-${gebruiker.id}`}
                    defaultValue={gebruiker.naam}
                    className={invoer}
                  />
                </label>
              ))}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <button
          disabled={bezig}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Opslaan
        </button>
        <Melding state={state} />
      </div>
    </form>
  );
}
