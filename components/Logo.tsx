import Image from "next/image";

/**
 * Twee redenen voor varianten. Het logo is donkerblauw op wit, dus op het donkere
 * thema zou het een wit blok of onleesbare inkt worden; daar hangt een versie met
 * lichte inkt klaar. En het volledige logo staat rechtop, wat in een kopbalk van
 * veertig pixels het woordmerk onleesbaar maakt; daar gebruiken we alleen de boot.
 *
 * De -v2 in de namen is er zodat browsers die het vorige logo in de cache hebben het
 * nieuwe ophalen; bij een gelijke naam blijft het oude plaatje hangen.
 */
const VARIANTEN = {
  volledig: { licht: "/euphoria-logo-v2.png", donker: "/euphoria-logo-donker-v2.png", verhouding: 900 / 642 },
  merk: { licht: "/euphoria-merk-v2.png", donker: "/euphoria-merk-donker-v2.png", verhouding: 512 / 499 },
} as const;

export default function Logo({
  hoogte,
  variant = "volledig",
  className = "",
}: {
  hoogte: number;
  variant?: keyof typeof VARIANTEN;
  className?: string;
}) {
  const { licht, donker, verhouding } = VARIANTEN[variant];
  const breedte = Math.round(hoogte * verhouding);

  return (
    <span className={`inline-block ${className}`} style={{ height: hoogte }}>
      <Image
        src={licht}
        alt="Euphoria"
        width={breedte}
        height={hoogte}
        priority
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={donker}
        alt="Euphoria"
        width={breedte}
        height={hoogte}
        priority
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
