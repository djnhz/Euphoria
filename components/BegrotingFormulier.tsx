"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  bewaarBegrotingAction,
  neemVorigJaarOverAction,
  nieuwOnderdeelAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";

export type Onderdeel = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  begrootCent: number | null;
  werkelijkCent: number;
};

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

function alsTekst(cent: number | null): string {
  return cent === null ? "" : (cent / 100).toFixed(2).replace(".", ",");
}

export default function BegrotingFormulier({
  jaar,
  onderdelen,
}: {
  jaar: number;
  onderdelen: Onderdeel[];
}) {
  const [state, bewaar, bezig] = useActionState<BegrotingState, FormData>(
    bewaarBegrotingAction,
    null,
  );
  const [overnemenState, overnemen, overnemenBezig] = useActionState<
    BegrotingState,
    FormData
  >(neemVorigJaarOverAction, null);

  const [bedragen, setBedragen] = useState<Record<number, string>>(() =>
    Object.fromEntries(onderdelen.map((o) => [o.id, alsTekst(o.begrootCent)])),
  );

  // Tijdens het typen verandert er niets aan de server, dus dit kenmerk blijft gelijk.
  // Wisselt het jaar, of komt er een nieuwe stand terug na opslaan of overnemen, dan
  // wel -- en dan horen de velden die stand te tonen in plaats van de oude invoer.
  const kenmerk = [
    jaar,
    ...onderdelen.map((o) => `${o.id}=${o.begrootCent ?? ""}`),
  ].join("|");
  const [vorigKenmerk, setVorigKenmerk] = useState(kenmerk);
  if (vorigKenmerk !== kenmerk) {
    setVorigKenmerk(kenmerk);
    setBedragen(
      Object.fromEntries(onderdelen.map((o) => [o.id, alsTekst(o.begrootCent)])),
    );
  }

  const totalen = useMemo(() => {
    let begroot = 0;
    for (const onderdeel of onderdelen) {
      begroot += parseEuro(bedragen[onderdeel.id] ?? "") ?? 0;
    }
    const werkelijk = onderdelen.reduce((som, o) => som + o.werkelijkCent, 0);
    return { begroot, werkelijk };
  }, [bedragen, onderdelen]);

  return (
    <div className="flex flex-col gap-4">
      <form action={bewaar} className="rounded-xl border border-rand bg-paneel p-4">
        <input type="hidden" name="jaar" value={jaar} />

        <ul className="flex flex-col">
          <li className="flex items-center gap-3 border-b border-rand pb-2 text-xs text-gedempt">
            <span className="flex-1">Onderdeel</span>
            <span className="w-28 text-right">Begroot</span>
            <span className="hidden w-28 text-right sm:block">Uitgegeven</span>
            <span className="hidden w-28 text-right sm:block">Verschil</span>
          </li>

          {onderdelen.map((onderdeel) => {
            const begrootCent = parseEuro(bedragen[onderdeel.id] ?? "");
            const verschil =
              begrootCent === null ? null : begrootCent - onderdeel.werkelijkCent;
            return (
              <li
                key={onderdeel.id}
                className="flex items-center gap-3 border-b border-rand py-2 last:border-0"
              >
                {/* De naam leidt naar de bonnen achter dit onderdeel, gefilterd op
                    hetzelfde jaar. Zo is te zien waar het bedrag vandaan komt. */}
                <Link
                  href={`/uitgaven?jaar=${jaar}&categorie=${onderdeel.id}`}
                  title={`Uitgaven voor ${onderdeel.naam} in ${jaar}`}
                  className="flex flex-1 items-center gap-2 truncate text-sm hover:text-accent"
                >
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 shrink-0 rounded"
                    style={{ background: onderdeel.kleur }}
                  />
                  <span className="truncate">{onderdeel.naam}</span>
                  {!onderdeel.actief && (
                    <span className="shrink-0 text-xs text-gedempt">(inactief)</span>
                  )}
                </Link>
                <input
                  name={`onderdeel-${onderdeel.id}`}
                  inputMode="decimal"
                  placeholder="—"
                  value={bedragen[onderdeel.id] ?? ""}
                  onChange={(e) =>
                    setBedragen((huidig) => ({
                      ...huidig,
                      [onderdeel.id]: e.target.value,
                    }))
                  }
                  aria-label={`Begroot voor ${onderdeel.naam}`}
                  className={`${invoer} cijfers w-28 text-right`}
                />
                <span className="cijfers hidden w-28 text-right text-sm text-gedempt sm:block">
                  {formatEuro(onderdeel.werkelijkCent)}
                </span>
                <span
                  className={`cijfers hidden w-28 text-right text-sm sm:block ${
                    verschil !== null && verschil < 0 ? "text-slecht" : "text-gedempt"
                  }`}
                >
                  {verschil === null ? "—" : formatEuro(verschil)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex items-center gap-3 border-t border-rand pt-3 text-sm font-medium">
          <span className="flex-1">Totaal</span>
          <span className="cijfers w-28 text-right">
            {formatEuro(totalen.begroot)}
          </span>
          <span className="cijfers hidden w-28 text-right sm:block">
            {formatEuro(totalen.werkelijk)}
          </span>
          <span className="cijfers hidden w-28 text-right sm:block">
            {formatEuro(totalen.begroot - totalen.werkelijk)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled={bezig}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig ? "Bezig…" : "Begroting opslaan"}
          </button>
          <Uitkomst state={state} />
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rand bg-paneel p-4">
        <NieuwOnderdeel />
        <form action={overnemen} className="flex items-center gap-3">
          <input type="hidden" name="jaar" value={jaar} />
          <button
            disabled={overnemenBezig}
            className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
          >
            Overnemen uit {jaar - 1}
          </button>
        </form>
        <Uitkomst state={overnemenState} />
      </div>
    </div>
  );
}

function NieuwOnderdeel() {
  const [state, toevoegen, bezig] = useActionState<BegrotingState, FormData>(
    nieuwOnderdeelAction,
    null,
  );

  return (
    <form action={toevoegen} className="flex flex-1 flex-wrap items-center gap-2">
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
        placeholder="Nieuw onderdeel"
        className={`${invoer} min-w-0 flex-1`}
      />
      <button
        disabled={bezig}
        className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
      >
        Toevoegen
      </button>
      <Uitkomst state={state} />
    </form>
  );
}

function Uitkomst({ state }: { state: BegrotingState }) {
  if (!state) return null;
  if (state.fout) return <p className="text-sm text-slecht">{state.fout}</p>;
  return <p className="text-sm text-goed">{state.gelukt}</p>;
}
