"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { maakMapAction } from "@/app/(app)/documenten/actions";

/** Inline knop die openklapt tot een naamveld -- zelfde patroon als "+ Subpost
 * toevoegen" bij de begroting: je bent al in de juiste map, er valt dus niets te
 * kiezen behalve de naam. */
export default function MapToevoegen({ ouderId }: { ouderId: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function aanmaken() {
    if (naam.trim() === "" || bezig) return;
    setBezig(true);
    setFout(null);
    const resultaat = await maakMapAction(naam, ouderId);
    setBezig(false);
    if (resultaat?.fout) {
      setFout(resultaat.fout);
      return;
    }
    setNaam("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-rand-sterk px-3.5 text-[13.5px] text-link transition hover:border-inkt hover:text-inkt sm:min-h-10"
      >
        + Nieuwe map
      </button>
    );
  }

  return (
    <div className="col-span-full flex flex-col gap-2 rounded-xl border border-rand bg-marine-tint p-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          value={naam}
          autoFocus
          onChange={(e) => setNaam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void aanmaken()}
          maxLength={60}
          placeholder="Naam van de map"
          aria-label="Naam van de map"
          className="min-h-11 min-w-0 rounded-[10px] border border-rand-sterk bg-paneel px-3 text-[15px] sm:min-h-0 sm:py-2 sm:text-[13px]"
        />
        {fout && <p className="text-xs text-slecht text-pretty">{fout}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void aanmaken()}
          disabled={bezig || naam.trim() === ""}
          className="min-h-11 shrink-0 rounded-[10px] bg-inkt px-4 text-sm font-semibold text-linnen disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-[13px]"
        >
          Aanmaken
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setFout(null);
            setNaam("");
          }}
          className="min-h-11 shrink-0 px-1 text-sm text-gedempt sm:min-h-0 sm:text-[13px]"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
