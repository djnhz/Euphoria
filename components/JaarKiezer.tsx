"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
    <select
      value={huidig}
      aria-label="Jaar"
      onChange={(e) => {
        const nieuw = new URLSearchParams(params);
        nieuw.set("jaar", e.target.value);
        router.push(`${pad}?${nieuw}`);
      }}
      className="cijfers rounded-lg border border-rand bg-paneel px-3 py-2 text-sm"
    >
      {jaren.map((jaar) => (
        <option key={jaar} value={jaar}>
          {jaar === 0 ? (allesLabel ?? "Alles") : jaar}
        </option>
      ))}
    </select>
  );
}
