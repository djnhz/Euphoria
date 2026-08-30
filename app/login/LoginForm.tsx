"use client";

import { useActionState, useState } from "react";
import { inloggenAction, type LoginState } from "./actions";

export type LoginGebruiker = {
  id: number;
  naam: string;
  coupleNaam: string;
};

export default function LoginForm({
  gebruikers,
}: {
  gebruikers: LoginGebruiker[];
}) {
  const [gekozen, setGekozen] = useState<LoginGebruiker | null>(null);
  const [pin, setPin] = useState("");
  const [state, verstuur, bezig] = useActionState<LoginState, FormData>(
    inloggenAction,
    null,
  );

  if (!gekozen) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {gebruikers.map((gebruiker) => (
          <button
            key={gebruiker.id}
            onClick={() => setGekozen(gebruiker)}
            className="rounded-xl border border-rand bg-paneel p-4 text-left transition hover:border-accent"
          >
            <span className="block text-lg font-medium">{gebruiker.naam}</span>
            <span className="block text-sm text-gedempt">
              {gebruiker.coupleNaam}
            </span>
          </button>
        ))}
      </div>
    );
  }

  /** Vier cijfers is genoeg informatie om te versturen; geen aparte knop nodig. */
  function tikCijfer(cijfer: string) {
    const nieuw = (pin + cijfer).slice(0, 4);
    if (nieuw.length < 4) {
      setPin(nieuw);
      return;
    }
    const velden = new FormData();
    velden.set("userId", String(gekozen!.id));
    velden.set("pin", nieuw);
    verstuur(velden);
    setPin("");
  }

  const toets =
    "cijfers rounded-xl border border-rand bg-paneel py-4 text-2xl disabled:opacity-40";
  const hulptoets =
    "rounded-xl border border-rand py-4 text-sm text-gedempt disabled:opacity-40";

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-lg font-medium">{gekozen.naam}</p>
        <button
          type="button"
          onClick={() => {
            setGekozen(null);
            setPin("");
          }}
          className="text-sm text-accent underline"
        >
          iemand anders
        </button>
      </div>

      <div className="flex justify-center gap-3" aria-live="polite">
        {[0, 1, 2, 3].map((positie) => (
          <span
            key={positie}
            className={`h-4 w-4 rounded-full border-2 border-rand ${
              positie < pin.length ? "border-accent bg-accent" : ""
            }`}
          />
        ))}
      </div>

      {state?.fout && (
        <p className="text-center text-sm text-slecht" role="alert">
          {state.fout}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((cijfer) => (
          <button
            key={cijfer}
            type="button"
            disabled={bezig}
            onClick={() => tikCijfer(cijfer)}
            className={toets}
          >
            {cijfer}
          </button>
        ))}
        <button
          type="button"
          disabled={bezig}
          onClick={() => setPin("")}
          className={hulptoets}
        >
          wis
        </button>
        <button
          type="button"
          disabled={bezig}
          onClick={() => tikCijfer("0")}
          className={toets}
        >
          0
        </button>
        <button
          type="button"
          disabled={bezig}
          onClick={() => setPin((p) => p.slice(0, -1))}
          className={hulptoets}
        >
          terug
        </button>
      </div>

      {bezig && <p className="text-center text-sm text-gedempt">Controleren…</p>}
    </div>
  );
}
