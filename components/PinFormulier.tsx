"use client";

import { useActionState } from "react";
import {
  wijzigPinAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

const invoer =
  "cijfers rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm tracking-widest";

export default function PinFormulier() {
  const [state, formAction, bezig] = useActionState<MeldingState, FormData>(
    wijzigPinAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {[
        { naam: "huidig", label: "Huidige pincode" },
        { naam: "nieuw", label: "Nieuwe pincode" },
        { naam: "herhaal", label: "Herhaal nieuwe" },
      ].map((veld) => (
        <label
          key={veld.naam}
          className="flex min-w-32 flex-1 flex-col gap-1 text-sm sm:flex-none"
        >
          <span className="text-gedempt">{veld.label}</span>
          <input
            name={veld.naam}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4}"
            maxLength={4}
            required
            className={`${invoer} w-full sm:w-28`}
          />
        </label>
      ))}
      <button
        disabled={bezig}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Wijzigen
      </button>
      <Melding state={state} />
    </form>
  );
}
