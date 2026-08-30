"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function UitgaveFilters({
  jaren,
  categorieen,
  huishoudens,
}: {
  jaren: number[];
  categorieen: { id: number; naam: string }[];
  huishoudens: { id: number; naam: string }[];
}) {
  const router = useRouter();
  const pad = usePathname();
  const params = useSearchParams();

  function zet(sleutel: string, waarde: string) {
    const nieuw = new URLSearchParams(params);
    if (waarde) nieuw.set(sleutel, waarde);
    else nieuw.delete(sleutel);
    router.push(nieuw.size ? `${pad}?${nieuw}` : pad);
  }

  const klasse =
    "rounded-lg border border-rand bg-paneel px-3 py-2 text-sm min-w-0";

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Jaar"
        value={params.get("jaar") ?? ""}
        onChange={(e) => zet("jaar", e.target.value)}
        className={klasse}
      >
        <option value="">Alle jaren</option>
        {jaren.map((jaar) => (
          <option key={jaar} value={jaar}>
            {jaar}
          </option>
        ))}
      </select>

      <select
        aria-label="Categorie"
        value={params.get("categorie") ?? ""}
        onChange={(e) => zet("categorie", e.target.value)}
        className={klasse}
      >
        <option value="">Alle categorieën</option>
        {categorieen.map((categorie) => (
          <option key={categorie.id} value={categorie.id}>
            {categorie.naam}
          </option>
        ))}
      </select>

      <select
        aria-label="Betaald door"
        value={params.get("huishouden") ?? ""}
        onChange={(e) => zet("huishouden", e.target.value)}
        className={klasse}
      >
        <option value="">Beide huishoudens</option>
        {huishoudens.map((huishouden) => (
          <option key={huishouden.id} value={huishouden.id}>
            {huishouden.naam}
          </option>
        ))}
      </select>
    </div>
  );
}
