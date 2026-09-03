"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORTERINGEN } from "@/lib/sorteren";

/**
 * De filters staan als pillen op één rij die opzij schuift. Een keuze die afwijkt
 * van de standaard kleurt donker, zodat je in één blik ziet dat je naar een selectie
 * kijkt en niet naar alles.
 */
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
    <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] pb-0.5">
      <Pil
        label="Jaar"
        waarde={params.get("jaar") ?? ""}
        standaard=""
        opties={[
          { waarde: "", label: "Alle jaren" },
          ...jaren.map((j) => ({ waarde: String(j), label: String(j) })),
        ]}
        kies={(v) => zet("jaar", v)}
      />
      <Pil
        label="Post"
        waarde={params.get("post") ?? ""}
        standaard=""
        opties={[
          { waarde: "", label: "Alle posten" },
          ...keuzes.map((k) => ({ waarde: String(k.id), label: k.label })),
        ]}
        kies={(v) => zet("post", v)}
      />
      <Pil
        label="Betaald door"
        waarde={params.get("huishouden") ?? ""}
        standaard=""
        opties={[
          { waarde: "", label: "Beide huishoudens" },
          ...huishoudens.map((h) => ({
            waarde: String(h.id),
            label: h.naam,
          })),
        ]}
        kies={(v) => zet("huishouden", v)}
      />
      <Pil
        label="Sorteren"
        waarde={params.get("sortering") ?? "datum-nieuw"}
        standaard="datum-nieuw"
        opties={Object.entries(SORTERINGEN).map(([waarde, label]) => ({
          waarde,
          label,
        }))}
        kies={(v) => zet("sortering", v === "datum-nieuw" ? "" : v)}
      />
      <Pil
        label="Groeperen"
        waarde={params.get("groep") ?? "maand"}
        standaard="maand"
        opties={groepen.map(([waarde, label]) => ({ waarde, label }))}
        kies={(v) => zet("groep", v === "maand" ? "" : v)}
      />
    </div>
  );
}

/**
 * Een select die eruitziet als een pil. Het blijft een echte select, want de
 * keuzelijst van de telefoon zelf werkt met één duim beter dan wat we zelf bouwen.
 */
function Pil({
  label,
  waarde,
  standaard,
  opties,
  kies,
}: {
  label: string;
  waarde: string;
  standaard: string;
  opties: { waarde: string; label: string }[];
  kies: (waarde: string) => void;
}) {
  const aan = waarde !== standaard;
  const tekst =
    opties.find((o) => o.waarde === waarde)?.label ?? opties[0]?.label ?? "";

  return (
    <span
      className={`relative shrink-0 rounded-full px-3.5 py-2 text-xs whitespace-nowrap ${
        aan
          ? "bg-inkt font-semibold text-linnen"
          : "border border-rand-sterk bg-paneel text-inkt"
      }`}
    >
      {tekst} ⌄
      <select
        aria-label={label}
        value={waarde}
        onChange={(e) => kies(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {opties.map((optie) => (
          <option key={optie.waarde} value={optie.waarde}>
            {optie.label}
          </option>
        ))}
      </select>
    </span>
  );
}
