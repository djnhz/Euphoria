"use client";

import { formatEuro } from "@/lib/geld";

/**
 * Wat een rij in de lijst laat zien. De bedragen komen uit het scherm en niet uit de
 * database, zodat de lijst meteen meebeweegt terwijl je rechts zit te typen.
 */
export type LijstRij = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  /** Begroot inclusief de subposten; null betekent "nog niets ingevuld". */
  begrootCent: number | null;
  besteedCent: number;
  subs: {
    id: number;
    naam: string;
    begrootCent: number | null;
    besteedCent: number;
  }[];
};

/**
 * De postenlijst: links op een laptop, bovenaan op een telefoon. Bewust zonder
 * invoervelden -- dit is het overzicht, bewerken gebeurt in het detailblad.
 *
 * Eén rij doet op beide schermen iets anders, maar wel met dezelfde klik. Op een
 * laptop kiest hij de post die rechts opengaat; op een telefoon klapt hij uit met de
 * cijfers erbij en een weg naar het blad. Dat scheelt een tweede lijstcomponent, en
 * het verschil zit puur in wat CSS laat zien.
 */
export default function PostLijst({
  jaar,
  rijen,
  gekozenId,
  uitgeklapt,
  kies,
  naarDetail,
  nieuw,
}: {
  jaar: number;
  rijen: LijstRij[];
  gekozenId: number | null;
  /** De post die op een telefoon openstaat; er staat er hooguit één open. */
  uitgeklapt: number | null;
  kies: (id: number) => void;
  naarDetail: (id: number) => void;
  nieuw: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-rand bg-paneel">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-rand px-4">
        <span className="bovenschrift">Posten {jaar}</span>
        <button
          type="button"
          onClick={nieuw}
          className="min-h-11 text-[12.5px] font-semibold text-link transition hover:text-inkt"
        >
          + Nieuwe post
        </button>
      </div>

      {rijen.length === 0 && (
        <p className="px-4 py-5 text-sm text-gedempt text-pretty">
          Geen posten in beeld. Zet hieronder &ldquo;Alle posten tonen&rdquo;
          aan, of maak er een.
        </p>
      )}

      {rijen.map((rij) => (
        <Rij
          key={rij.id}
          rij={rij}
          gekozen={rij.id === gekozenId}
          open={rij.id === uitgeklapt}
          kies={() => kies(rij.id)}
          naarDetail={() => naarDetail(rij.id)}
        />
      ))}
    </div>
  );
}

function Rij({
  rij,
  gekozen,
  open,
  kies,
  naarDetail,
}: {
  rij: LijstRij;
  gekozen: boolean;
  open: boolean;
  kies: () => void;
  naarDetail: () => void;
}) {
  const stand = standVan(rij.begrootCent, rij.besteedCent, rij.kleur);

  return (
    <div className="border-b border-rand last:border-b-0">
      <button
        type="button"
        onClick={kies}
        aria-expanded={open}
        className={`block min-h-16 w-full px-4 py-3 text-left transition hover:bg-verzonken ${
          gekozen
            ? "lg:bg-marine-tint lg:shadow-[inset_3px_0_0_var(--inkt)]"
            : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: rij.kleur }}
          />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold lg:text-sm">
            {rij.naam}
            {!rij.actief && (
              <span className="ml-1.5 text-xs font-normal text-gedempt">
                inactief
              </span>
            )}
          </span>
          <span
            className={`cijfers shrink-0 text-[13px] ${
              rij.begrootCent === null ? "text-link" : ""
            }`}
          >
            {rij.begrootCent === null
              ? "nog leeg"
              : formatEuro(rij.begrootCent)}
          </span>
          <span
            aria-hidden
            className="hidden shrink-0 text-sm text-zacht lg:inline"
          >
            ›
          </span>
          <span
            aria-hidden
            className="shrink-0 text-xs text-zacht transition-transform lg:hidden"
            style={{ transform: open ? "rotate(90deg)" : "none" }}
          >
            ▶
          </span>
        </div>

        <div className="mt-2 ml-5 h-1 overflow-hidden rounded-full bg-linnen-diep">
          <div
            className="h-full rounded-full"
            style={{ width: stand.balkBreedte, background: stand.balkKleur }}
          />
        </div>
        <div className="cijfers mt-1.5 ml-5 flex justify-between gap-2 text-[11px] text-gedempt">
          <span className="truncate">
            besteed {formatEuro(rij.besteedCent)}
          </span>
          <span className={`shrink-0 ${stand.verschilKleur}`}>
            {stand.verschilTekst}
          </span>
        </div>
      </button>

      {/* Uitgeklapt op een telefoon: alleen lezen, met één weg naar het blad. */}
      {open && (
        <div className="border-t border-dashed border-rand-sterk bg-verzonken px-3.5 pt-2 pb-2.5 lg:hidden">
          <div className="cijfers grid grid-cols-3 gap-2 pt-2 pb-1">
            <Cijfer label="Begroot" waarde={tekstOfStreep(rij.begrootCent)} />
            <Cijfer label="Besteed" waarde={formatEuro(rij.besteedCent)} />
            <Cijfer
              label="Nog over"
              waarde={stand.verschilKort}
              kleur={stand.verschilKleur}
            />
          </div>

          {rij.subs.map((sub) => (
            <div
              key={sub.id}
              className="flex min-h-9 items-center gap-2.5 text-[13px]"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-zacht"
              />
              <span className="min-w-0 flex-1 truncate text-tekst/75">
                {sub.naam}
              </span>
              <span className="cijfers shrink-0 text-xs text-gedempt">
                {formatEuro(sub.besteedCent)}
              </span>
              <span className="cijfers w-[76px] shrink-0 text-right text-[12.5px]">
                {tekstOfStreep(sub.begrootCent)}
              </span>
            </div>
          ))}

          <button
            type="button"
            onClick={naarDetail}
            className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 border-t border-rand px-0.5 text-left text-[13.5px] font-semibold text-link"
          >
            <span className="min-w-0 truncate">
              Bewerken en alles over {rij.naam}
            </span>
            <span aria-hidden className="shrink-0">
              ›
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function Cijfer({
  label,
  waarde,
  kleur = "",
}: {
  label: string;
  waarde: string;
  kleur?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] tracking-[0.14em] text-gedempt uppercase">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-sm font-medium ${kleur}`}>
        {waarde}
      </div>
    </div>
  );
}

function tekstOfStreep(cent: number | null): string {
  return cent === null ? "—" : formatEuro(cent);
}

/**
 * De balk en de tekst rechts eronder. Zonder begroting geen volle balk: die zou
 * lezen als "helemaal op" terwijl er juist nog niets is ingevuld.
 */
export function standVan(
  begrootCent: number | null,
  besteedCent: number,
  kleur: string,
) {
  if (begrootCent === null || begrootCent === 0) {
    return {
      balkBreedte: "0%",
      balkKleur: kleur,
      verschilTekst: besteedCent > 0 ? "niet begroot" : "—",
      verschilKort: besteedCent > 0 ? "niet begroot" : "—",
      verschilKleur: besteedCent > 0 ? "text-messing-inkt" : "text-gedempt",
      deelTekst: "nog geen bedrag",
    };
  }

  const verschil = begrootCent - besteedCent;
  const deel = besteedCent / begrootCent;
  return {
    balkBreedte: `${Math.min(100, Math.max(0, deel * 100))}%`,
    balkKleur: verschil < 0 ? "var(--messing-inkt)" : kleur,
    verschilTekst:
      verschil < 0
        ? `${formatEuro(-verschil)} te veel`
        : `over ${formatEuro(verschil)}`,
    verschilKort: formatEuro(verschil),
    verschilKleur: verschil < 0 ? "text-messing-inkt" : "text-goed",
    deelTekst: `${Math.round(deel * 100)}% besteed`,
  };
}
