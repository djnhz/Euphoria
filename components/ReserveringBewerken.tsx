"use client";

import { useActionState, useMemo, useState } from "react";
import type { Reservering } from "@/lib/agenda";
import { dagenTotEnMet } from "@/lib/datum";
import {
  geefDagenVrijAction,
  type VrijgeefState,
} from "@/app/(app)/vaarplanning/actions";

const DAGKOPPEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/**
 * Een reservering krimpen of opdelen door dagen vrij te geven. Vink je alles aan,
 * dan gaat hij helemaal weg -- dat is dezelfde handeling, dus dezelfde knop, in
 * plaats van een aparte annuleerknop ernaast.
 *
 * Staat zowel onder de kalender als bij de komende reserveringen op het overzicht,
 * en is daarom een eigen component: twee kopieën van dit formulier gaan uiteenlopen.
 */
export default function ReserveringBewerken({
  reservering,
  compact = false,
}: {
  reservering: Reservering;
  /** Op het overzicht is de ruimte krap; daar volstaat een klein knopje. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, vrijgeven, bezig] = useActionState<VrijgeefState, FormData>(
    geefDagenVrijAction,
    null,
  );
  const [gekozen, setGekozen] = useState<string[]>([]);
  const dagen = useMemo(
    () => dagenTotEnMet(reservering.van, reservering.tot),
    [reservering.van, reservering.tot],
  );
  const alles = gekozen.length === dagen.length;

  // Gelukt? Dan is de lijst eronder al bijgewerkt en hoeft dit niet open te
  // blijven. Tijdens het renderen bijstellen in plaats van in een effect: dat
  // scheelt een tweede beeld waarin het blok nog even openstaat.
  const [verwerkt, setVerwerkt] = useState<VrijgeefState>(null);
  if (state?.gelukt && state !== verwerkt) {
    setVerwerkt(state);
    setOpen(false);
    setGekozen([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? "Reservering aanpassen" : undefined}
        className={
          compact
            ? "shrink-0 rounded-lg border border-rand-sterk p-1.5 text-gedempt transition hover:border-inkt hover:text-inkt"
            : "shrink-0 rounded-xl border border-rand-sterk px-3 py-2 text-sm transition hover:border-inkt"
        }
      >
        {compact ? <Potlood /> : "Aanpassen"}
      </button>
    );
  }

  return (
    <form action={vrijgeven} className="w-full">
      <input type="hidden" name="id" value={reservering.id} />

      <div className="mt-1 rounded-xl border border-rand bg-verzonken p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="bovenschrift">Welke dagen geef je vrij?</p>
          <button
            type="button"
            onClick={() => setGekozen(alles ? [] : dagen)}
            className="text-xs text-link underline"
          >
            {alles ? "geen enkele" : "alle dagen"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dagen.map((dag) => {
            const aan = gekozen.includes(dag);
            return (
              <label
                key={dag}
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  aan
                    ? "border-transparent bg-inkt font-semibold text-linnen"
                    : "border-rand-sterk bg-paneel hover:border-inkt"
                }`}
              >
                <input
                  type="checkbox"
                  name="dag"
                  value={dag}
                  checked={aan}
                  onChange={(e) =>
                    setGekozen((huidig) =>
                      e.target.checked
                        ? [...huidig, dag]
                        : huidig.filter((d) => d !== dag),
                    )
                  }
                  className="sr-only"
                />
                <span className="cijfers">{kortDag(dag)}</span>
              </label>
            );
          })}
        </div>

        {!reservering.uitApp && (
          <p className="mt-2.5 text-xs text-gedempt text-pretty">
            Deze afspraak is rechtstreeks in Google Agenda gezet, dus de app
            weet niet van wie hij is.
          </p>
        )}

        {/* Een blok uit de seizoensplanning mag je hier bijschaven, maar het is
            goed om te weten dat opnieuw publiceren het terugzet zoals het was. */}
        {reservering.bron === "euphoria-seizoen" && (
          <p className="mt-2.5 text-xs text-messing-inkt text-pretty">
            Deze week komt uit de seizoensplanning. Publiceert de beheerder het
            seizoen opnieuw, dan staat hij er weer helemaal in.
          </p>
        )}

        {gekozen.length > 0 && (
          <p className="mt-2.5 text-xs text-gedempt text-pretty">
            {alles
              ? "Alles aangevinkt: de hele reservering verdwijnt."
              : `Er ${dagen.length - gekozen.length === 1 ? "blijft" : "blijven"} ${dagen.length - gekozen.length} ${dagen.length - gekozen.length === 1 ? "dag" : "dagen"} staan.`}
          </p>
        )}

        {state?.fout && (
          <p className="mt-2 text-sm text-slecht">{state.fout}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            disabled={bezig || gekozen.length === 0}
            className="rounded-xl bg-inkt px-3.5 py-2.5 text-sm font-semibold text-linnen disabled:opacity-40"
          >
            {bezig
              ? "Bezig…"
              : alles
                ? "Reservering weghalen"
                : "Dagen vrijgeven"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setGekozen([]);
            }}
            className="text-sm text-gedempt underline"
          >
            laat maar
          </button>
        </div>
      </div>
    </form>
  );
}

/** "wo 12" -- kort genoeg om er zeven naast elkaar te zetten op een telefoon. */
function kortDag(iso: string): string {
  const dag = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return `${DAGKOPPEN[(dag + 6) % 7]} ${Number(iso.slice(8))}`;
}

function Potlood() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
