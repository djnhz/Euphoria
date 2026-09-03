"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GebruikerMenu from "./GebruikerMenu";
import Logo from "./Logo";

/**
 * Vier bestemmingen onderin, geen hamburgermenu meer. Wat eerst losse items waren
 * -- Verrekening en Begroting -- zijn tabbladen binnen Kosten geworden, en
 * Documenten en Instellingen horen bij "jij" en staan onder de initialen.
 */
const TABS = [
  { href: "/", label: "Overzicht", icoon: Kompas },
  { href: "/vaarplanning", label: "Planning", icoon: Kalender },
  { href: "/taken", label: "Taken", icoon: Vinkje },
  {
    href: "/uitgaven",
    label: "Kosten",
    icoon: Bon,
    ook: ["/begroting", "/verrekening"],
  },
] as const;

export default function Nav({
  naam,
  huishouden,
  beheerder,
}: {
  naam: string;
  huishouden: string;
  beheerder: boolean;
}) {
  const pad = usePathname();

  /**
   * Invoerschermen zijn bladen: ze hebben onderin hun eigen voet met het totaal en
   * de opslaanknop. Daar hoort geen tabbalk overheen -- je bent ergens mee bezig en
   * maakt dat eerst af.
   */
  const isBlad = pad.endsWith("/nieuw") || pad.endsWith("/bewerken");

  function isActief(tab: (typeof TABS)[number]) {
    if (tab.href === "/") return pad === "/";
    if (pad.startsWith(tab.href)) return true;
    return "ook" in tab && tab.ook.some((p) => pad.startsWith(p));
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-inkt-diep">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-6 px-[18px] py-3">
          {/* Het eigen logo, in de versie met lichte inkt: de balk is marineblauw. */}
          <Link href="/" aria-label="Euphoria" className="flex shrink-0">
            <Logo hoogte={46} opDonker />
          </Link>

          {/* Vanaf een tabletbreedte is er ruimte naast het woordmerk, en dan hoort
              de navigatie daar: een balk onderaan een breed scherm is een reep
              lucht met vier woorden erin. */}
          {!isBlad && (
            <nav className="hidden flex-1 justify-center gap-1 lg:flex">
              {TABS.map((tab) => {
                const actief = isActief(tab);
                const Icoon = tab.icoon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={actief ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition ${
                      actief
                        ? "bg-linnen/12 font-semibold text-linnen"
                        : "text-linnen/60 hover:text-linnen"
                    }`}
                  >
                    <Icoon />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-2.5">
            {/* Een bon indienen is waarvoor de app het vaakst opengaat, dus staat
                hij op elk scherm binnen één tik -- in messing, want dat is hier de
                kleur van "doe dit". */}
            {!isBlad && (
              <Link
                href="/uitgaven/nieuw"
                className="flex items-center gap-2 rounded-full bg-messing px-3 py-2 text-[13px] font-semibold text-inkt transition hover:brightness-105 sm:px-4"
              >
                <BonPlus />
                <span className="hidden sm:inline">Bon indienen</span>
                <span className="sm:hidden">Bon</span>
              </Link>
            )}
            <GebruikerMenu
              naam={naam}
              huishouden={huishouden}
              beheerder={beheerder}
            />
          </div>
        </div>
      </header>

      {/* Op een telefoon zit de balk vast onderin, binnen duimbereik; de pagina
          houdt er ruimte voor vrij. Op een breed scherm staat hij bovenin. */}
      {!isBlad && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-rand bg-linnen pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex w-full max-w-5xl px-1.5 pt-2 pb-2.5">
            {TABS.map((tab) => {
              const actief = isActief(tab);
              const Icoon = tab.icoon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={actief ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 transition ${
                    actief ? "text-inkt" : "text-zacht hover:text-gedempt"
                  }`}
                >
                  <Icoon />
                  <span
                    className={`text-[10px] ${actief ? "font-semibold" : ""}`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

/**
 * Lijnpictogrammen in plaats van de tekentekens uit het ontwerp: die vallen per
 * toestel anders uit en staan zelden op de lijn.
 */
const lijn = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Kompas() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="12" cy="12" r="8.5" {...lijn} />
      <path d="M15 9l-2 4-4 2 2-4z" {...lijn} />
    </svg>
  );
}

function Kalender() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...lijn} />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" {...lijn} />
    </svg>
  );
}

function Vinkje() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="12" cy="12" r="8.5" {...lijn} />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" {...lijn} />
    </svg>
  );
}

/** De bon met een plusje: de knop in de kopbalk. */
function BonPlus() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M4.5 3.5h10v17l-1.7-1.4-1.6 1.4-1.7-1.4-1.7 1.4-1.6-1.4-1.7 1.4z"
        {...lijn}
      />
      <path d="M18.5 9v7M15 12.5h7" {...lijn} />
    </svg>
  );
}

function Bon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M5.5 3.5h13v17l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4z"
        {...lijn}
      />
      <path d="M9 8.5h6M9 12.5h6" {...lijn} />
    </svg>
  );
}
