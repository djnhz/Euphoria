"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { verwijderMapAction } from "@/app/(app)/documenten/actions";

/** Eén submap: een tegel om in te klikken, met een verwijderknop die pas verschijnt
 * als je er met de muis op staat -- op een telefoon gewoon altijd zichtbaar. */
export default function MapTegel({
  id,
  naam,
}: {
  id: number;
  naam: string;
}) {
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);

  function verwijderen() {
    if (!confirm(`Map "${naam}" verwijderen?`)) return;
    start(async () => {
      const resultaat = await verwijderMapAction(id);
      if (resultaat?.fout) setFout(resultaat.fout);
    });
  }

  return (
    <div className="group relative">
      <Link
        href={`/documenten/${id}`}
        className="flex min-h-[72px] flex-col justify-between rounded-xl border border-rand bg-paneel p-3 transition hover:border-inkt hover:bg-verzonken"
      >
        <MapIcoon />
        <span className="truncate text-[13.5px] font-medium">{naam}</span>
      </Link>
      <button
        type="button"
        onClick={verwijderen}
        disabled={bezig}
        aria-label={`Map ${naam} verwijderen`}
        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-gedempt opacity-100 transition hover:bg-rand hover:text-inkt disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
      >
        ×
      </button>
      {fout && (
        <p className="absolute top-full right-0 left-0 z-10 mt-1 rounded-lg bg-paneel p-2 text-[11px] text-slecht shadow-md">
          {fout}
        </p>
      )}
    </div>
  );
}

function MapIcoon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="text-gedempt">
      <path
        d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
