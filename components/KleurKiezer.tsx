"use client";

import { useState } from "react";

/**
 * De kleuren uit het ontwerp als vaste keuze, met de eigen kiezer ernaast. Zonder
 * dit krijgt elke post de kleur die de systeemkiezer toevallig bovenaan zet, en
 * daar valt een marineblauw scherm meteen uit elkaar.
 */
const PALET = [
  "#16283F",
  "#2F5C8A",
  "#9DB4CE",
  "#C9A662",
  "#8A6A2F",
  "#3F6B54",
  "#C7C0B2",
];

export default function KleurKiezer({
  naam = "kleur",
  begin,
  label,
  onKies,
}: {
  naam?: string;
  begin: string;
  label: string;
  /** Voor een blad dat zijn eigen staat bijhoudt in plaats van een formulier op te sturen. */
  onKies?: (kleur: string) => void;
}) {
  const [kleur, zetKleur] = useState(begin);
  const setKleur = (nieuw: string) => {
    zetKleur(nieuw);
    onKies?.(nieuw);
  };

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {!onKies && <input type="hidden" name={naam} value={kleur} />}
      {PALET.map((optie) => (
        <button
          key={optie}
          type="button"
          onClick={() => setKleur(optie)}
          aria-label={`Kleur ${optie}`}
          aria-pressed={kleur.toLowerCase() === optie.toLowerCase()}
          style={{ background: optie }}
          className={`h-8 w-8 rounded-md transition ${
            kleur.toLowerCase() === optie.toLowerCase()
              ? "ring-2 ring-inkt ring-offset-1"
              : "opacity-70 hover:opacity-100"
          }`}
        />
      ))}
      <input
        type="color"
        value={kleur}
        onChange={(e) => setKleur(e.target.value)}
        aria-label={label}
        className="h-8 w-8 shrink-0 rounded-md border border-rand bg-transparent"
      />
    </span>
  );
}
