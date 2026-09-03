"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uitloggenAction } from "@/app/login/actions";

/**
 * De knop rechts in de kopbalk. Documenten en Instellingen zaten in het
 * hoofdmenu, maar dat is nu een balk met vier vaste plekken; ze horen hier, bij
 * "jij", net als uitloggen.
 */
export default function GebruikerMenu({
  naam,
  huishouden,
  beheerder,
}: {
  naam: string;
  huishouden: string;
  beheerder: boolean;
}) {
  const [open, setOpen] = useState(false);
  const houder = useRef<HTMLDivElement>(null);

  // Sluiten bij een klik ernaast of op Escape; anders blijft het menu hangen.
  useEffect(() => {
    if (!open) return;
    function klikBuiten(event: PointerEvent) {
      if (!houder.current?.contains(event.target as Node)) setOpen(false);
    }
    function toets(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", klikBuiten);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("pointerdown", klikBuiten);
      document.removeEventListener("keydown", toets);
    };
  }, [open]);

  return (
    <div ref={houder} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((huidig) => !huidig)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={naam}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-linnen/35 text-[11px] font-semibold text-linnen transition hover:bg-linnen/10"
      >
        {initialen(naam)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-rand bg-paneel shadow-xl"
        >
          <div className="border-b border-rand px-4 py-3">
            <p className="truncate text-sm font-semibold">{naam}</p>
            <p className="truncate text-xs text-gedempt">{huishouden}</p>
          </div>
          <Link
            href="/documenten"
            role="menuitem"
            // Sluiten bij het klikken zelf; dat scheelt een effect dat op de route let.
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm transition hover:bg-accent-zacht"
          >
            Documenten
          </Link>
          <Link
            href="/instellingen"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-t border-rand px-4 py-3 text-sm transition hover:bg-accent-zacht"
          >
            {beheerder ? "Instellingen" : "Mijn pincode"}
          </Link>
          <form action={uitloggenAction} className="border-t border-rand">
            <button
              role="menuitem"
              className="w-full px-4 py-3 text-left text-sm text-gedempt transition hover:bg-accent-zacht"
            >
              Uitloggen
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Twee letters: de eerste van de voornaam en van de achternaam, of anders één. */
export function initialen(naam: string): string {
  const delen = naam.trim().split(/[\s-]+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}
