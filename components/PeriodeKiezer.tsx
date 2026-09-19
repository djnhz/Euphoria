"use client";

import { useEffect, useRef, useState } from "react";
import { formatDatum, maandRaster, verschuifMaand } from "@/lib/datum";

const DAGKOPPEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

const VOLLE_MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/**
 * Het veld "Wanneer" met een eigen uitklapkalender erachter. Eerst hing de periode
 * alleen aan de grote kalender erboven: het veld liet zien wat je daar had gekozen
 * maar je kon er zelf niets mee. Nu is het een knop die opengaat, met een eigen
 * maandnavigatie -- zo kun je ook een periode in een andere maand pakken zonder
 * eerst de pagina eromheen te verzetten.
 *
 * De grote kalender blijft meedoen: wat je daar aantikt komt hier te staan, en
 * andersom. Twee ingangen naar dezelfde keuze, niet twee keuzes.
 */
export default function PeriodeKiezer({
  van,
  totEnMet,
  kies,
  label = "Wanneer",
}: {
  van: string;
  totEnMet: string;
  kies: (van: string, totEnMet: string) => void;
  label?: string;
}) {
  const [open, zetOpen] = useState(false);
  /** De maand die in de uitklap te zien is; begint bij de gekozen periode. */
  const [zicht, zetZicht] = useState(() => ({
    jaar: Number(van.slice(0, 4)),
    maand: Number(van.slice(5, 7)),
  }));
  /** De eerste tik van een nieuwe keuze; null zodra de periode rond is. */
  const [inBehandeling, zetInBehandeling] = useState<string | null>(null);

  const doos = useRef<HTMLDivElement>(null);

  // Buiten de uitklap tikken of Escape sluit hem. Een uitklap die alleen dichtgaat
  // via zijn eigen knop laat je klemzitten zodra je ernaast mikt.
  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (doos.current && !doos.current.contains(e.target as Node)) {
        zetOpen(false);
        zetInBehandeling(null);
      }
    };
    const toets = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        zetOpen(false);
        zetInBehandeling(null);
      }
    };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("mousedown", buiten);
      document.removeEventListener("keydown", toets);
    };
  }, [open]);

  function tikDag(datum: string) {
    if (inBehandeling === null) {
      zetInBehandeling(datum);
      // Eén dag is ook een geldige periode; blijft het bij deze tik, dan klopt het al.
      kies(datum, datum);
      return;
    }
    const begin = datum < inBehandeling ? datum : inBehandeling;
    const eind = datum < inBehandeling ? inBehandeling : datum;
    kies(begin, eind);
    zetInBehandeling(null);
    zetOpen(false);
  }

  const samenvatting =
    van === totEnMet
      ? formatDatum(van)
      : `${formatDatum(van)} t/m ${formatDatum(totEnMet)}`;

  const dagen = maandRaster(zicht.jaar, zicht.maand);
  const vandaagIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative flex flex-col gap-1 text-sm" ref={doos}>
      <span className="text-gedempt" id="periode-label">
        {label}
      </span>

      <button
        type="button"
        onClick={() => {
          zetZicht({
            jaar: Number(van.slice(0, 4)),
            maand: Number(van.slice(5, 7)),
          });
          zetInBehandeling(null);
          zetOpen((aan) => !aan);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="periode-label"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-rand-sterk bg-paneel px-3.5 text-left text-sm transition hover:border-inkt"
      >
        <span className="min-w-0 truncate">{samenvatting}</span>
        <span aria-hidden className="shrink-0 text-xs text-zacht">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Kies een periode"
          className="absolute top-full left-0 z-30 mt-1.5 w-[min(320px,calc(100vw-36px))] rounded-xl border border-rand-sterk bg-paneel p-3 shadow-[0_18px_40px_-18px_rgba(22,40,63,0.45)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                zetZicht(verschuifMaand(zicht.jaar, zicht.maand, -1))
              }
              aria-label="Vorige maand"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-rand-sterk text-sm transition hover:border-inkt"
            >
              ←
            </button>
            <span className="text-sm font-medium">
              {VOLLE_MAANDEN[zicht.maand - 1]} {zicht.jaar}
            </span>
            <button
              type="button"
              onClick={() =>
                zetZicht(verschuifMaand(zicht.jaar, zicht.maand, 1))
              }
              aria-label="Volgende maand"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-rand-sterk text-sm transition hover:border-inkt"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] text-gedempt">
            {DAGKOPPEN.map((dag) => (
              <div key={dag} className="py-1">
                {dag}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {dagen.map((dag) => {
              if (!dag.datum) return <span key={dag.sleutel} />;
              const datum = dag.datum;
              const binnen =
                inBehandeling === null
                  ? datum >= van && datum <= totEnMet
                  : datum === inBehandeling;
              const uiteinde =
                inBehandeling === null
                  ? datum === van || datum === totEnMet
                  : datum === inBehandeling;
              return (
                <button
                  key={dag.sleutel}
                  type="button"
                  onClick={() => tikDag(datum)}
                  aria-pressed={binnen}
                  aria-label={formatDatum(datum)}
                  className={`cijfers flex h-9 items-center justify-center rounded-lg text-[13px] transition ${
                    uiteinde
                      ? "bg-inkt font-semibold text-linnen"
                      : binnen
                        ? "bg-marine-tint text-inkt"
                        : datum === vandaagIso
                          ? "border border-accent hover:bg-verzonken"
                          : "hover:bg-verzonken"
                  }`}
                >
                  {Number(datum.slice(8))}
                </button>
              );
            })}
          </div>

          <p
            aria-live="polite"
            className="mt-2 border-t border-rand pt-2 text-[11.5px] text-gedempt"
          >
            {inBehandeling === null
              ? "Tik een dag voor het begin, en daarna een tweede voor het eind."
              : `Vanaf ${formatDatum(inBehandeling)} — tik de laatste dag aan.`}
          </p>
        </div>
      )}
    </div>
  );
}
