"use client";

import { useActionState } from "react";
import { zetPinAction, type MeldingState } from "@/app/(app)/instellingen/actions";
import Melding from "./Melding";

const invoer =
  "cijfers w-28 rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm tracking-widest";

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
    <form action={zet} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={id} />
      <span className="min-w-32 flex-1 truncate text-sm">{naam}</span>
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
        className={invoer}
      />
      <button
        disabled={bezig}
        className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
      >
        Instellen
      </button>
      <Melding state={state} />
    </form>
  );
}
