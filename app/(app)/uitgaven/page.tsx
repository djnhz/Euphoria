import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { beschikbareJaren, uitgavenLijst } from "@/lib/data";
import { isSortering } from "@/lib/sorteren";
import { formatEuro } from "@/lib/geld";
import { MAANDEN, formatDatum } from "@/lib/datum";
import UitgaveFilters from "@/components/UitgaveFilters";

type Rij = Awaited<ReturnType<typeof uitgavenLijst>>[number];

/** Waarop je de lijst kunt opdelen; de sleutel staat in de URL. */
const GROEPEN = {
  geen: "Geen groepering",
  maand: "Per maand",
  categorie: "Per categorie",
  huishouden: "Per huishouden",
} as const;

type Groep = keyof typeof GROEPEN;

function groepsnaam(rij: Rij, groep: Groep): string {
  switch (groep) {
    case "maand":
      return `${MAANDEN[Number(rij.datum.slice(5, 7)) - 1]} ${rij.datum.slice(0, 4)}`;
    case "categorie":
      return rij.hoofdcategorie;
    case "huishouden":
      return rij.coupleNaam;
    default:
      return "";
  }
}

/** Groepen in de volgorde waarin de rijen binnenkomen; sorteren blijft zo leidend. */
function groepeer(rijen: Rij[], groep: Groep) {
  const kaart = new Map<string, Rij[]>();
  for (const rij of rijen) {
    const naam = groepsnaam(rij, groep);
    kaart.set(naam, [...(kaart.get(naam) ?? []), rij]);
  }
  return [...kaart.entries()];
}

export default async function UitgavenPagina({
  searchParams,
}: PageProps<"/uitgaven">) {
  await vereisGebruiker();
  const params = await searchParams;

  const [jaren, categorieLijst, huishoudens] = await Promise.all([
    beschikbareJaren(),
    db
      .select({ id: categories.id, naam: categories.naam })
      .from(categories)
      .where(eq(categories.actief, true))
      .orderBy(asc(categories.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  const gekozenJaar = Number(params.jaar);
  const jaar = jaren.includes(gekozenJaar) ? gekozenJaar : undefined;
  const categoryId = Number(params.categorie) || undefined;
  const coupleId = Number(params.huishouden) || undefined;

  const sorteerParam = String(params.sortering ?? "");
  const sortering = isSortering(sorteerParam) ? sorteerParam : "datum-nieuw";
  const groepParam = String(params.groep ?? "");
  const groep: Groep = groepParam in GROEPEN ? (groepParam as Groep) : "geen";

  const rijen = await uitgavenLijst({ jaar, categoryId, coupleId, sortering });
  const totaal = rijen.reduce((som, r) => som + r.totaalCent, 0);
  const groepen = groep === "geen" ? [] : groepeer(rijen, groep);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Uitgaven</h1>
        <Link
          href="/uitgaven/nieuw"
          className="ml-auto rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          + Bon
        </Link>
      </div>

      <UitgaveFilters
        jaren={jaren}
        categorieen={categorieLijst}
        huishoudens={huishoudens}
        groepen={Object.entries(GROEPEN)}
      />

      <p className="text-sm text-gedempt">
        {rijen.length} uitgave{rijen.length === 1 ? "" : "n"}, samen{" "}
        <span className="cijfers text-tekst">{formatEuro(totaal)}</span>
      </p>

      {rijen.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-6 text-center text-sm text-gedempt">
          Niets gevonden met deze filters.
        </p>
      ) : groep === "geen" ? (
        <Lijst rijen={rijen} />
      ) : (
        <div className="flex flex-col gap-5">
          {groepen.map(([naam, groepsrijen]) => (
            <section key={naam} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium">{naam}</h2>
                <span className="cijfers text-sm text-gedempt">
                  {formatEuro(
                    groepsrijen.reduce((som, r) => som + r.totaalCent, 0),
                  )}
                </span>
              </div>
              <Lijst rijen={groepsrijen} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Lijst({ rijen }: { rijen: Rij[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rijen.map((rij) => (
        <li key={rij.id}>
          <Link
            href={`/uitgaven/${rij.id}`}
            className="flex items-center gap-3 rounded-xl border border-rand bg-paneel p-4 transition hover:border-accent"
          >
            <span
              aria-hidden
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ background: rij.categorieKleur }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {rij.leverancier || "Zonder leverancier"}
              </p>
              <p className="truncate text-sm text-gedempt">
                {formatDatum(rij.datum)} · {rij.hoofdcategorie} · {rij.coupleNaam}
                {rij.heeftBon && " · bon"}
              </p>
            </div>
            <span className="cijfers shrink-0 font-medium">
              {formatEuro(rij.totaalCent)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
