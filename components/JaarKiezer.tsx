"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function JaarKiezer({
  jaren,
  huidig,
}: {
  jaren: number[];
  huidig: number;
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
          {jaar}
        </option>
      ))}
    </select>
  );
}
