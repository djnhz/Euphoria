"use client";

import { useActionState } from "react";
import {
  nieuweCategorieAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

export default function NieuweCategorie() {
  const [state, formAction, bezig] = useActionState<MeldingState, FormData>(
    nieuweCategorieAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="color"
        name="kleur"
        defaultValue="#64748b"
        aria-label="Kleur"
        className="h-9 w-9 shrink-0 rounded border border-rand bg-transparent"
      />
      <input
        name="naam"
        required
        placeholder="Nieuwe categorie"
        className={`${invoer} min-w-0 flex-1`}
      />
      <button
        disabled={bezig}
        className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Toevoegen
      </button>
      <Melding state={state} />
    </form>
  );
}
