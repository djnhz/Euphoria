"use client";

import { useActionState } from "react";
import { zetPinAction, type MeldingState } from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

const invoer =
  "cijfers rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm tracking-widest sm:w-28";

export default function PincodeBeheer({
  gebruikers,
}: {
  gebruikers: { id: number; naam: string }[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {gebruikers.map((gebruiker) => (
        <li key={gebruiker.id}>
          <Regel id={gebruiker.id} naam={gebruiker.naam} />
        </li>
      ))}
    </ul>
  );
}

function Regel({ id, naam }: { id: number; naam: string }) {
  const [state, zet, bezig] = useActionState<MeldingState, FormData>(
    zetPinAction,
    null,
  );

  return (
    // Op een telefoon de naam op een eigen regel; anders duwt hij het veld en de
    // knop uit elkaar over drie regels.
    <form action={zet} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={id} />
      <span className="w-full text-sm sm:w-auto sm:min-w-32 sm:flex-1 sm:truncate">
        {naam}
      </span>
      <div className="flex w-full items-center gap-3 sm:w-auto">
        <input
          name="nieuw"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          required
          aria-label={`Nieuwe pincode voor ${naam}`}
          placeholder="••••"
          className={`${invoer} flex-1 sm:flex-none`}
        />
        <button
          disabled={bezig}
          className="shrink-0 rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
        >
          Instellen
        </button>
      </div>
      <Melding state={state} />
    </form>
  );
}
