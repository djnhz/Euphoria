import Image from "next/image";

/**
 * Twee varianten, want het logo is donkerblauw op wit. Op het donkere thema zou dat
 * een wit blok of onleesbare inkt worden, dus daar hangt een lichte versie klaar.
 */
export default function Logo({
  hoogte,
  className = "",
}: {
  hoogte: number;
  className?: string;
}) {
  const breedte = Math.round(hoogte * (900 / 217));
  return (
    <span className={`inline-block ${className}`} style={{ height: hoogte }}>
      <Image
        src="/euphoria-logo.png"
        alt="Euphoria"
        width={breedte}
        height={hoogte}
        priority
        className="h-full w-auto dark:hidden"
      />
      <Image
        src="/euphoria-logo-donker.png"
        alt="Euphoria"
        width={breedte}
        height={hoogte}
        priority
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
