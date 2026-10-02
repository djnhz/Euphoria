"use client";

import Link from "next/link";
import { useVuil } from "./Wijzigingen";

/**
 * De kop van een blad: links de uitweg, in het midden waar je mee bezig bent.
 * De opslaanknop staat niet hier maar in de voet, bij het totaal.
 *
 * Een uitweg zonder meer is "Terug". Pas als er iets is ingevuld dat nog niet is
 * opgeslagen wordt het "Annuleren", want dan gooi je iets weg.
 */
export function Bladkop({ terug, titel }: { terug: string; titel: string }) {
  const vuil = useVuil();
  const uitweg = vuil ? "Annuleren" : "‹ Terug";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rand px-[18px] py-3.5 lg:px-8">
      <Link href={terug} className="text-[15px] text-gedempt">
        {uitweg}
      </Link>
      <span className="titel text-lg">{titel}</span>
      {/* Even breed als de uitweg, zodat de titel echt in het midden staat. */}
      <span aria-hidden className="invisible text-[15px]">
        {uitweg}
      </span>
    </div>
  );
}
