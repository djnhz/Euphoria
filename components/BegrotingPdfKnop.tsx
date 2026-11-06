"use client";

import { useState } from "react";
import { exporteerPdfAction } from "@/app/(app)/begroting/actions";

/**
 * Downloadt de begroting van het gekozen jaar als PDF. Een echte download in plaats
 * van "afdrukken als PDF": met één tik klaar, ook op een telefoon.
 */
export default function BegrotingPdfKnop({ jaar }: { jaar: number }) {
  const [bezig, zetBezig] = useState(false);
  const [fout, zetFout] = useState<string | null>(null);

  async function downloaden() {
    if (bezig) return;
    zetBezig(true);
    zetFout(null);
    const uitkomst = await exporteerPdfAction(jaar);
    zetBezig(false);
    if ("fout" in uitkomst) {
      zetFout(uitkomst.fout);
      return;
    }

    const bytes = Uint8Array.from(atob(uitkomst.base64), (teken) =>
      teken.charCodeAt(0),
    );
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = uitkomst.naam;
    document.body.append(link);
    link.click();
    link.remove();
    // Even laten staan: sommige browsers lezen de URL pas na de klik uit.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void downloaden()}
        disabled={bezig}
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-rand-sterk bg-paneel px-3 text-[13px] font-medium whitespace-nowrap transition hover:border-inkt disabled:opacity-60 lg:min-h-10"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {bezig ? "Maken…" : "PDF"}
      </button>
      {fout && (
        <p className="absolute top-full right-0 z-10 mt-1 w-56 rounded-lg bg-paneel p-2 text-xs text-slecht shadow-md">
          {fout}
        </p>
      )}
    </div>
  );
}
