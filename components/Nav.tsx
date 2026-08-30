"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import GebruikerMenu from "./GebruikerMenu";

/** Instellingen staat bewust niet hier maar onder je eigen naam in het gebruikersmenu. */
const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/uitgaven", label: "Uitgaven" },
  { href: "/verrekening", label: "Verrekening" },
  { href: "/vaarplanning", label: "Vaarplanning" },
  { href: "/documenten", label: "Documenten" },
  { href: "/vaste-lasten", label: "Vaste lasten" },
] as const;

export default function Nav({
  naam,
  huishouden,
}: {
  naam: string;
  huishouden: string;
}) {
  const pad = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-rand bg-paneel/95 backdrop-blur">
      {/*
        Op een breed scherm past alles op een regel: het volledige logo links, het menu
        in het midden, jouw naam rechts. Daaronder zakt het menu naar een eigen regel,
        want zes menu-items zijn samen breder dan wat er dan overblijft.
      */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/" aria-label="Euphoria" className="shrink-0">
          <Logo hoogte={54} />
        </Link>

        <nav className="order-3 flex w-full justify-center gap-2 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0">
          {LINKS.map((link) => {
            const actief =
              link.href === "/" ? pad === "/" : pad.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
                  actief
                    ? "bg-accent-zacht text-accent"
                    : "text-gedempt hover:text-tekst"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto lg:ml-0">
          <GebruikerMenu naam={naam} huishouden={huishouden} />
        </div>
      </div>
    </header>
  );
}
