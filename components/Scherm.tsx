import Link from "next/link";
import type { ReactNode } from "react";

/**
 * De vaste opbouw van een scherm: een kop met titel, een regel eronder met de
 * telling, eventueel een rij tabbladen, en daaronder de inhoud met 18 pixels lucht
 * eromheen. Elk scherm gebruikt dit, zodat ze op de pixel gelijk beginnen.
 */
export function Schermkop({
  titel,
  onderschrift,
  rechts,
  tabs,
  children,
}: {
  titel: string;
  onderschrift?: ReactNode;
  rechts?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-rand px-[18px] pt-4 pb-3.5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="titel truncate text-[28px] leading-tight">{titel}</h1>
          {onderschrift && (
            <div className="cijfers mt-0.5 text-xs text-gedempt">
              {onderschrift}
            </div>
          )}
        </div>
        {rechts && <div className="shrink-0">{rechts}</div>}
      </div>
      {tabs}
      {children}
    </div>
  );
}

/** De inhoud onder de kop. */
export function Schermbody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 px-[18px] py-[18px] ${className}`}>
      {children}
    </div>
  );
}

/**
 * De schakelaar tussen verwante schermen -- Uitgaven/Begroting/Verrekening,
 * Open/Winterklaar/Klaar. Links en geen knoppen: elk tabblad is een eigen adres,
 * dus je kunt er rechtstreeks naartoe en terug.
 */
export function Segment({
  items,
  actief,
}: {
  items: readonly { href: string; label: string }[];
  actief: string;
}) {
  return (
    <div className="flex gap-1.5 rounded-xl bg-linnen-diep p-1">
      {items.map((item) => {
        const aan = item.href === actief;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={aan ? "page" : undefined}
            className={`flex-1 rounded-lg py-2 text-center text-[12.5px] transition ${
              aan
                ? "bg-paneel font-semibold text-inkt shadow-sm"
                : "text-gedempt hover:text-inkt"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Een witte kaart met rand; de bouwsteen van vrijwel elk blok. */
export function Paneel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-rand bg-paneel p-4 ${className}`}
    >
      {children}
    </section>
  );
}

/** Het kleine kopje in kapitalen boven een blok. */
export function Bovenschrift({
  children,
  rechts,
  className = "",
}: {
  children: ReactNode;
  rechts?: ReactNode;
  className?: string;
}) {
  if (!rechts) {
    return <div className={`bovenschrift ${className}`}>{children}</div>;
  }
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <div className="bovenschrift">{children}</div>
      <div className="cijfers text-xs text-gedempt">{rechts}</div>
    </div>
  );
}

/** Een lijst in een kaart: rijen met een dunne scheidingslijn ertussen. */
export function Lijst({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={`divide-y divide-rand overflow-hidden rounded-2xl border border-rand bg-paneel ${className}`}
    >
      {children}
    </ul>
  );
}

/**
 * De kop van een invoerblad: links de uitweg, in het midden waar je mee bezig bent.
 * De opslaanknop staat niet hier maar in de voet, bij het totaal.
 */
export function Bladkop({
  terug,
  titel,
}: {
  terug: string;
  titel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rand px-[18px] py-3.5">
      <Link href={terug} className="text-[15px] text-gedempt">
        Annuleren
      </Link>
      <span className="titel text-lg">{titel}</span>
      {/* Even breed als "Annuleren", zodat de titel echt in het midden staat. */}
      <span aria-hidden className="invisible text-[15px]">
        Annuleren
      </span>
    </div>
  );
}
