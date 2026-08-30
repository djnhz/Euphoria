"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { uitloggenAction } from "@/app/login/actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/uitgaven", label: "Uitgaven" },
  { href: "/verrekening", label: "Verrekening" },
  { href: "/vaarplanning", label: "Vaarplanning" },
  { href: "/documenten", label: "Documenten" },
  { href: "/vaste-lasten", label: "Vaste lasten" },
  { href: "/instellingen", label: "Instellingen" },
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
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Euphoria
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-gedempt sm:inline">
            {naam} · {huishouden}
          </span>
          <form action={uitloggenAction}>
            <button className="text-gedempt underline">uitloggen</button>
          </form>
        </div>
      </div>
      <nav className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
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
    </header>
  );
}
