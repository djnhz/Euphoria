"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Onthoudt in welke stand je een lijst had -- welk jaar, welke post, hoe gegroepeerd --
 * zodat "Terug" vanuit een detailpagina daar weer uitkomt in plaats van op de
 * ongefilterde lijst. Het staat per tabblad in sessionStorage en verdwijnt dus vanzelf.
 */
export default function LijstOnthouden({ sleutel }: { sleutel: string }) {
  const pad = usePathname();
  const zoek = useSearchParams().toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(sleutel, zoek ? `${pad}?${zoek}` : pad);
    } catch {
      // Opslag geblokkeerd: Terug gaat dan naar de lijst zonder filters.
    }
  }, [sleutel, pad, zoek]);
  return null;
}
