"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uitloggenAction } from "@/app/login/actions";

/**
 * Instellingen zat in de hoofdnavigatie en maakte die te breed voor een regel. Het
 * hoort ook bij "jij", net als uitloggen, dus staat het hier onder je eigen naam.
 */
export default function GebruikerMenu({
  naam,
  huishouden,
}: {
  naam: string;
  huishouden: string;
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
        className="flex items-center gap-2 rounded-full border border-rand px-3 py-1.5 text-sm transition hover:border-accent"
      >
        <span className="max-w-32 truncate">{naam}</span>
        <span aria-hidden className="text-gedempt">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-rand bg-paneel shadow-lg"
        >
          <div className="border-b border-rand px-4 py-3">
            <p className="truncate text-sm font-medium">{naam}</p>
            <p className="truncate text-xs text-gedempt">{huishouden}</p>
          </div>
          <Link
            href="/instellingen"
            role="menuitem"
            // Sluiten bij het klikken zelf; dat scheelt een effect dat op de route let.
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm transition hover:bg-accent-zacht"
          >
            Instellingen
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
