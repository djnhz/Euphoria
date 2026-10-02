"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORTERINGEN } from "@/lib/sorteren";
import Keuzelijst, { type Optie } from "./Keuzelijst";

/**
 * De filterbalk, in twee groepen met een streepje ertussen. Links wat je *selecteert*
 * -- welk jaar, welke post, wie betaalde -- en rechts hoe je het *bekijkt*: groeperen
 * en sorteren. Die twee stonden eerst door elkaar, en een pil als "Per hoofdpost"
 * zei niet of hij de lijst filterde of opdeelde.
 *
 * Een keuze die afwijkt van de standaard kleurt donker, zodat je in één blik ziet dat
 * je naar een selectie kijkt en niet naar alles.
 */
export default function UitgaveFilters({
  jaren,
  posten,
  huishoudens,
  groepen,
}: {
  jaren: number[];
  posten: {
    id: number;
    naam: string;
    ouderId: number | null;
    kleur: string;
  }[];
  huishoudens: { id: number; naam: string }[];
  groepen: { waarde: string; label: string; uitleg?: string }[];
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

  /** Alleen de filters wissen; hoe je de lijst bekijkt blijft zoals je het had. */
  function wisFilters() {
    const nieuw = new URLSearchParams(params);
    for (const sleutel of ["jaar", "post", "huishouden"]) nieuw.delete(sleutel);
    router.push(nieuw.size ? `${pad}?${nieuw}` : pad);
  }

  const jaar = params.get("jaar") ?? "";
  const post = params.get("post") ?? "";
  const huishouden = params.get("huishouden") ?? "";
  const sortering = params.get("sortering") ?? "datum-nieuw";
  const groep = params.get("groep") ?? "maand";
  const ietsGefilterd = jaar !== "" || post !== "" || huishouden !== "";

  // Hoofdposten met hun subposten eronder; kiezen van een hoofdpost pakt de subposten mee.
  const postOpties: Optie<string>[] = [
    { waarde: "", label: "Alle posten" },
    ...posten
      .filter((p) => p.ouderId === null)
      .flatMap((hoofd) => [
        { waarde: String(hoofd.id), label: hoofd.naam, kleur: hoofd.kleur },
        ...posten
          .filter((p) => p.ouderId === hoofd.id)
          .map((sub) => ({
            waarde: String(sub.id),
            label: sub.naam,
            kleur: sub.kleur,
            inspringen: true,
          })),
      ]),
  ];

  return (
    <div className="-mx-[18px] flex items-center gap-1.5 overflow-x-auto px-[18px] pb-0.5">
      <Keuzelijst
        variant="pil"
        label="Jaar"
        waarde={jaar}
        gekozen={jaar !== ""}
        opties={[
          { waarde: "", label: "Alle jaren" },
          ...jaren.map((j) => ({ waarde: String(j), label: String(j) })),
        ]}
        onKies={(v) => zet("jaar", v)}
      />
      <Keuzelijst
        variant="pil"
        label="Post"
        waarde={post}
        gekozen={post !== ""}
        opties={postOpties}
        onKies={(v) => zet("post", v)}
      />
      <Keuzelijst
        variant="pil"
        label="Betaald door"
        waarde={huishouden}
        gekozen={huishouden !== ""}
        opties={[
          { waarde: "", label: "Beide huishoudens" },
          ...huishoudens.map((h) => ({
            waarde: String(h.id),
            label: h.naam,
          })),
        ]}
        onKies={(v) => zet("huishouden", v)}
      />

      {ietsGefilterd && (
        <button
          type="button"
          onClick={wisFilters}
          className="min-h-10 shrink-0 px-2 text-xs whitespace-nowrap text-gedempt underline transition hover:text-inkt"
        >
          Filters wissen
        </button>
      )}

      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-rand-sterk" />

      <Keuzelijst
        variant="pil"
        label="Groeperen"
        voorvoegsel="Groeperen:"
        waarde={groep}
        gekozen={groep !== "maand"}
        opties={groepen.map((g) => ({
          waarde: g.waarde,
          label: g.label,
          uitleg: g.uitleg,
        }))}
        onKies={(v) => zet("groep", v === "maand" ? "" : v)}
      />
      <Keuzelijst
        variant="pil"
        label="Sorteren"
        voorvoegsel="Sorteren:"
        waarde={sortering}
        gekozen={sortering !== "datum-nieuw"}
        opties={Object.entries(SORTERINGEN).map(([waarde, label]) => ({
          waarde,
          label,
        }))}
        onKies={(v) => zet("sortering", v === "datum-nieuw" ? "" : v)}
      />
    </div>
  );
}
