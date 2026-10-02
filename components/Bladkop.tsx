"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useVuil } from "./Wijzigingen";

const geen = () => () => {};

/** De lijst waar je vandaan kwam, mits dat een pad binnen de app is. */
function onthouden(sleutel: string | undefined, standaard: string): string {
  if (!sleutel) return standaard;
  try {
    const waarde = sessionStorage.getItem(sleutel);
    return waarde && waarde.startsWith("/") && !waarde.startsWith("//")
      ? waarde
      : standaard;
  } catch {
    return standaard;
  }
}

/**
 * De kop van een blad: links de uitweg, in het midden waar je mee bezig bent.
 * De opslaanknop staat niet hier maar in de voet, bij het totaal.
 *
 * Een uitweg zonder meer is "Terug". Pas als er iets is ingevuld dat nog niet is
 * opgeslagen wordt het "Annuleren", want dan gooi je iets weg.
 *
 * Met `onthoud` brengt "Terug" je naar de lijst zoals je hem had achtergelaten, met
 * dezelfde filters en groepering (zie `LijstOnthouden`).
 */
export function Bladkop({
  terug,
  titel,
  onthoud,
}: {
  terug: string;
  titel: string;
  onthoud?: string;
}) {
  const vuil = useVuil();
  const href = useSyncExternalStore(
    geen,
    () => onthouden(onthoud, terug),
    () => terug,
  );
  const uitweg = vuil ? "Annuleren" : "‹ Terug";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rand px-[18px] py-3.5 lg:px-8">
      <Link href={href} className="text-[15px] text-gedempt">
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
