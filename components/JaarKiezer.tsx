"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Keuzelijst from "./Keuzelijst";

export default function JaarKiezer({
  jaren,
  huidig,
  allesLabel,
}: {
  jaren: number[];
  huidig: number;
  /** Tekst voor de waarde 0, als "alle jaren" een geldige keuze is. */
  allesLabel?: string;
}) {
  const router = useRouter();
  const pad = usePathname();
  const params = useSearchParams();

  return (
    <Keuzelijst
      label="Jaar"
      waarde={huidig}
      breed={false}
      className="cijfers min-w-[7rem]"
      opties={jaren.map((jaar) => ({
        waarde: jaar,
        label: jaar === 0 ? (allesLabel ?? "Alles") : String(jaar),
      }))}
      onKies={(jaar) => {
        const nieuw = new URLSearchParams(params);
        nieuw.set("jaar", String(jaar));
        router.push(`${pad}?${nieuw}`);
      }}
    />
  );
}
