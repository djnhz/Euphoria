"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BestandTegel from "./BestandTegel";
import { verwijderDocumentAction } from "@/app/(app)/documenten/actions";

export type DocumentRij = {
  id: number;
  naam: string;
  map: string;
  mime: string;
  grootteBytes: number;
  url: string;
  voorbeeldUrl: string | null;
  expenseId: number | null;
  leverancier: string | null;
  geuploadOp: string;
  geuploadDoor: string;
};

function formatGrootte(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentLijst({ rijen }: { rijen: DocumentRij[] }) {
  const [zoek, setZoek] = useState("");
  const [map, setMap] = useState("");

  const mappen = useMemo(
    () => [...new Set(rijen.map((r) => r.map))].sort(),
    [rijen],
  );

  // Zoeken gebeurt in de browser: bij een paar honderd documenten is een
  // extra query naar de server pure overhead.
  const zichtbaar = rijen.filter((rij) => {
    if (map && rij.map !== map) return false;
    if (!zoek) return true;
    const term = zoek.toLowerCase();
    return (
      rij.naam.toLowerCase().includes(term) ||
      (rij.leverancier ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam of leverancier"
          className="min-w-0 flex-1 rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm"
        />
        <select
          aria-label="Map"
          value={map}
          onChange={(e) => setMap(e.target.value)}
          className="rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm"
        >
          <option value="">Alle mappen</option>
          {mappen.map((naam) => (
            <option key={naam} value={naam}>
              {naam}
            </option>
          ))}
        </select>
      </div>

      {zichtbaar.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-6 text-center text-sm text-gedempt">
          Geen documenten gevonden.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zichtbaar.map((rij) => (
            <li
              key={rij.id}
              className="flex items-start gap-3 rounded-xl border border-rand bg-paneel p-3"
            >
              <a href={rij.url} target="_blank" rel="noreferrer" className="shrink-0">
                <BestandTegel
                  naam={rij.naam}
                  mime={rij.mime}
                  voorbeeldUrl={rij.voorbeeldUrl}
                  zijde={56}
                />
              </a>
              <div className="min-w-0 flex-1">
                {/* Bestandsnamen zijn lang en zeggen pas iets aan het eind; afkappen
                    laat je met "Factuur_12205989..." zitten. Liever twee regels. */}
                <a
                  href={rij.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block leading-snug font-medium break-words"
                >
                  {rij.naam}
                </a>
                <p className="mt-0.5 text-sm text-gedempt">
                  {rij.map} · {formatGrootte(rij.grootteBytes)} ·{" "}
                  {rij.geuploadDoor}
                  {rij.expenseId && (
                    <>
                      {" · "}
                      <Link
                        href={`/uitgaven/${rij.expenseId}`}
                        className="text-link underline"
                      >
                        {rij.leverancier || "uitgave"}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <form action={verwijderDocumentAction} className="shrink-0">
                <input type="hidden" name="id" value={rij.id} />
                <button className="text-sm text-gedempt underline">
                  verwijder
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
