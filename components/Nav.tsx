"use client";

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  // Escape sluit het menu, net als bij het gebruikersmenu.
  useEffect(() => {
    if (!open) return;
    function toets(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [open]);

  function isActief(href: string) {
    return href === "/" ? pad === "/" : pad.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-rand bg-paneel/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2">
        {/* Op telefoonformaat past het menu niet naast het logo, dus zit het achter
            deze knop. Vanaf lg staat het gewoon uitgeklapt in het midden. */}
        <button
          type="button"
          onClick={() => setOpen((huidig) => !huidig)}
          aria-expanded={open}
          aria-controls="hoofdmenu"
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          className="shrink-0 rounded-lg border border-rand p-2 transition hover:border-accent lg:hidden"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        <Link href="/" aria-label="Euphoria" className="shrink-0">
          <Logo hoogte={54} />
        </Link>

        <nav className="hidden lg:flex lg:flex-1 lg:justify-center lg:gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
                isActief(link.href)
                  ? "bg-accent-zacht text-accent"
                  : "text-gedempt hover:text-tekst"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto lg:ml-0">
          <GebruikerMenu naam={naam} huishouden={huishouden} />
        </div>
      </div>

      {open && (
        <nav
          id="hoofdmenu"
          className="border-t border-rand lg:hidden"
          onClick={() => setOpen(false)}
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block border-b border-rand px-4 py-3 text-center text-sm transition last:border-0 ${
                isActief(link.href)
                  ? "bg-accent-zacht font-medium text-accent"
                  : "hover:bg-accent-zacht"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
