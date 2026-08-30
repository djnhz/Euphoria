import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { beschikbareJaren, uitgavenLijst } from "@/lib/data";
import { formatEuro } from "@/lib/geld";
import { formatDatum } from "@/lib/datum";
import UitgaveFilters from "@/components/UitgaveFilters";

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

  const rijen = await uitgavenLijst({ jaar, categoryId, coupleId });
  const totaal = rijen.reduce((som, r) => som + r.totaalCent, 0);

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
      />

      <p className="text-sm text-gedempt">
        {rijen.length} uitgave{rijen.length === 1 ? "" : "n"}, samen{" "}
        <span className="cijfers text-tekst">{formatEuro(totaal)}</span>
      </p>

      {rijen.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-6 text-center text-sm text-gedempt">
          Niets gevonden met deze filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rijen.map((rij) => (
            <li key={rij.id}>
              <Link
                href={`/uitgaven/${rij.id}`}
                className="flex items-center gap-3 rounded-xl border border-rand bg-paneel p-4 transition hover:border-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {rij.leverancier || "Zonder leverancier"}
                  </p>
                  <p className="truncate text-sm text-gedempt">
                    {formatDatum(rij.datum)} · {rij.coupleNaam} ·{" "}
                    {rij.regelCount} regel{rij.regelCount === 1 ? "" : "s"}
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
      )}
    </div>
  );
}
