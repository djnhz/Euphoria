"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORTERINGEN } from "@/lib/sorteren";

export default function UitgaveFilters({
  jaren,
  posten,
  huishoudens,
  groepen,
}: {
  jaren: number[];
  posten: { id: number; naam: string; ouderId: number | null }[];
  huishoudens: { id: number; naam: string }[];
  /** Paren van sleutel en label, zoals de pagina ze definieert. */
  groepen: [string, string][];
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

  // Hoofdposten met hun subposten eronder; kiezen van een hoofdpost pakt de subposten mee.
  const keuzes = posten
    .filter((p) => p.ouderId === null)
    .flatMap((hoofd) => [
      { id: hoofd.id, label: hoofd.naam },
      ...posten
        .filter((p) => p.ouderId === hoofd.id)
        .map((sub) => ({ id: sub.id, label: `— ${sub.naam}` })),
    ]);

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
        aria-label="Post"
        value={params.get("post") ?? ""}
        onChange={(e) => zet("post", e.target.value)}
        className={klasse}
      >
        <option value="">Alle posten</option>
        {keuzes.map((keuze) => (
          <option key={keuze.id} value={keuze.id}>
            {keuze.label}
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

      <select
        aria-label="Sorteren"
        value={params.get("sortering") ?? "datum-nieuw"}
        onChange={(e) => zet("sortering", e.target.value)}
        className={klasse}
      >
        {Object.entries(SORTERINGEN).map(([sleutel, label]) => (
          <option key={sleutel} value={sleutel}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Groeperen"
        value={params.get("groep") ?? "geen"}
        onChange={(e) =>
          zet("groep", e.target.value === "geen" ? "" : e.target.value)
        }
        className={klasse}
      >
        {groepen.map(([sleutel, label]) => (
          <option key={sleutel} value={sleutel}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
