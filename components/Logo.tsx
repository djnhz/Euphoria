import Image from "next/image";

/**
 * Het volledige logo staat rechtop, wat in een kopbalk van veertig pixels het
 * woordmerk onleesbaar maakt; daar gebruiken we alleen de boot.
 *
 * `opDonker` kiest de versie met lichte inkt, voor op de marineblauwe balk. De app
 * kent verder maar één thema, dus er wordt niet meer op het systeemthema gelet.
 *
 * De -v2 in de namen is er zodat browsers die het vorige logo in de cache hebben het
 * nieuwe ophalen; bij een gelijke naam blijft het oude plaatje hangen.
 */
const VARIANTEN = {
  volledig: {
    licht: "/euphoria-logo-v2.png",
    donker: "/euphoria-logo-donker-v2.png",
    verhouding: 900 / 642,
  },
  merk: {
    licht: "/euphoria-merk-v2.png",
    donker: "/euphoria-merk-donker-v2.png",
    verhouding: 512 / 499,
  },
} as const;

export default function Logo({
  hoogte,
  variant = "volledig",
  opDonker = false,
  className = "",
}: {
  hoogte: number;
  variant?: keyof typeof VARIANTEN;
  opDonker?: boolean;
  className?: string;
}) {
  const { licht, donker, verhouding } = VARIANTEN[variant];
  const breedte = Math.round(hoogte * verhouding);

  return (
    <span className={`inline-block ${className}`} style={{ height: hoogte }}>
      <Image
        src={opDonker ? donker : licht}
        alt="Euphoria"
        width={breedte}
        height={hoogte}
        priority
        className="h-full w-auto"
      />
    </span>
  );
}
