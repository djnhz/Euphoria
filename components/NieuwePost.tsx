"use client";

import { useState } from "react";
import type { BegrotingsPost } from "@/lib/begroting";
import { POSTKLEUREN } from "@/lib/kleuren";

/**
 * Een post erbij. Staat op de plek van het detailblad, zodat je hem meteen ziet
 * verschijnen op de plaats waar hij daarna te bewerken is.
 *
 * "Plek" bepaalt of het een eigen hoofdpost wordt of een subpost onder een bestaande.
 * Dieper dan twee lagen kan niet, dus een subpost staat er niet tussen.
 */
export default function NieuwePost({
  jaar,
  hoofdposten,
  beginOuderId = null,
  toevoegen,
  annuleer,
  fout,
  terug,
}: {
  jaar: number;
  hoofdposten: BegrotingsPost[];
  beginOuderId?: number | null;
  toevoegen: (invoer: {
    naam: string;
    kleur: string;
    ouderId: number | null;
    bedrag: string;
  }) => Promise<void>;
  annuleer: () => void;
  fout: string | null;
  /** Alleen op een telefoon: de weg terug naar de lijst. */
  terug?: () => void;
}) {
  const [naam, zetNaam] = useState("");
  const [kleur, zetKleur] = useState<string>(POSTKLEUREN[1]);
  const [ouderId, zetOuderId] = useState<number | null>(beginOuderId);
  const [bedrag, zetBedrag] = useState("");
  const [bezig, zetBezig] = useState(false);

  async function opslaan() {
    if (naam.trim() === "" || bezig) return;
    zetBezig(true);
    await toevoegen({ naam, kleur, ouderId, bedrag });
    zetBezig(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-rand bg-paneel">
      {terug && (
        <div className="border-b border-rand pl-1">
          <button
            type="button"
            onClick={terug}
            className="min-h-11 px-3 text-[15px] text-link"
          >
            ‹ Begroting
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 px-5 py-5 lg:px-6">
        <div>
          <div className="bovenschrift">Nieuwe post</div>
          <div className="titel mt-1 text-[26px] leading-tight">
            Wat wil je begroten?
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-[12.5px] text-gedempt">
          Naam
          <input
            value={naam}
            autoFocus
            onChange={(e) => zetNaam(e.target.value)}
            maxLength={60}
            placeholder="bijv. Zeilen en tuigage"
            className="min-h-11 rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px] text-tekst"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-[12.5px] text-gedempt">
          Kleur
          <div className="flex flex-wrap gap-2">
            {POSTKLEUREN.map((optie) => {
              const aan = optie.toLowerCase() === kleur.toLowerCase();
              return (
                <button
                  key={optie}
                  type="button"
                  onClick={() => zetKleur(optie)}
                  aria-label={`Kleur ${optie}`}
                  aria-pressed={aan}
                  style={{ background: optie }}
                  className={`h-8 w-8 rounded-lg transition ${
                    aan
                      ? "ring-2 ring-inkt ring-offset-1"
                      : "opacity-70 hover:opacity-100"
                  }`}
                />
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-[12.5px] text-gedempt">
          Plek
          <select
            value={ouderId ?? 0}
            onChange={(e) => zetOuderId(Number(e.target.value) || null)}
            className="min-h-11 rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px] text-tekst"
          >
            <option value={0}>Eigen hoofdpost</option>
            {hoofdposten
              .filter((post) => post.ouderId === null)
              .map((post) => (
                <option key={post.id} value={post.id}>
                  Subpost onder {post.naam}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[12.5px] text-gedempt">
          Begroot voor {jaar} (mag leeg)
          <input
            value={bedrag}
            inputMode="decimal"
            onChange={(e) => zetBedrag(e.target.value)}
            placeholder="—"
            className="cijfers min-h-11 w-full rounded-xl border border-rand-sterk bg-verzonken px-3.5 py-3 text-right text-base text-tekst sm:w-[180px]"
          />
        </label>

        {fout && <p className="text-sm text-slecht text-pretty">{fout}</p>}

        <div className="mt-1 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => void opslaan()}
            disabled={bezig || naam.trim() === ""}
            className="min-h-11 rounded-xl bg-inkt px-5 text-sm font-semibold text-linnen disabled:opacity-50"
          >
            Toevoegen
          </button>
          <button
            type="button"
            onClick={annuleer}
            className="min-h-11 rounded-xl border border-rand-sterk bg-paneel px-4 text-sm"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
