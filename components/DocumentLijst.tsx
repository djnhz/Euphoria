"use client";

import { useState } from "react";
import Link from "next/link";
import BestandTegel from "./BestandTegel";
import { verwijderDocumentAction } from "@/app/(app)/documenten/actions";

export type DocumentRij = {
  id: number;
  naam: string;
  mime: string;
  grootteBytes: number;
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

/** De documenten in deze ene map; welke map dat is, bepaalt het scherm eromheen. */
export default function DocumentLijst({ rijen }: { rijen: DocumentRij[] }) {
  const [zoek, setZoek] = useState("");

  // Zoeken gebeurt in de browser: bij een paar honderd documenten is een
  // extra query naar de server pure overhead.
  const zichtbaar = rijen.filter((rij) => {
    if (!zoek) return true;
    const term = zoek.toLowerCase();
    return (
      rij.naam.toLowerCase().includes(term) ||
      (rij.leverancier ?? "").toLowerCase().includes(term)
    );
  });

  if (rijen.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        placeholder="Zoek op naam of leverancier"
        className="min-w-0 rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm"
      />

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
              {/* De kale Blob-URL komt zo nooit in de pagina terecht: deze route geeft
                  de inhoud door en vraagt zelf om een sessie. */}
              <a
                href={`/api/document/${rij.id}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
              >
                <BestandTegel
                  naam={rij.naam}
                  mime={rij.mime}
                  voorbeeldUrl={
                    rij.voorbeeldUrl ? `/api/document/${rij.id}?voorbeeld=1` : null
                  }
                  zijde={56}
                />
              </a>
              <div className="min-w-0 flex-1">
                {/* Bestandsnamen zijn lang en zeggen pas iets aan het eind; afkappen
                    laat je met "Factuur_12205989..." zitten. Liever twee regels. */}
                <a
                  href={`/api/document/${rij.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block leading-snug font-medium break-words"
                >
                  {rij.naam}
                </a>
                <p className="mt-0.5 text-sm text-gedempt">
                  {formatGrootte(rij.grootteBytes)} · {rij.geuploadDoor}
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
                  Verwijderen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
