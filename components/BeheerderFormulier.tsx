"use client";

import { useActionState } from "react";
import {
  wisselBeheerderAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

export default function BeheerderFormulier({
  gebruikers,
}: {
  gebruikers: { id: number; naam: string; beheerder: boolean }[];
}) {
  const [state, wissel, bezig] = useActionState<MeldingState, FormData>(
    wisselBeheerderAction,
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {gebruikers.map((gebruiker) => (
          <li key={gebruiker.id}>
            <form action={wissel} className="flex items-center gap-3 text-sm">
              <input type="hidden" name="userId" value={gebruiker.id} />
              <input
                type="hidden"
                name="aan"
                value={gebruiker.beheerder ? "nee" : "ja"}
              />
              <span className="min-w-0 flex-1 truncate">{gebruiker.naam}</span>
              <span className="text-gedempt">
                {gebruiker.beheerder ? "beheerder" : "geen beheerder"}
              </span>
              <button
                disabled={bezig}
                className="rounded-lg border border-rand px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {gebruiker.beheerder ? "intrekken" : "aanwijzen"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Melding state={state} />
    </div>
  );
}
