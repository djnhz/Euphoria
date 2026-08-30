import Link from "next/link";
import BestandTegel from "@/components/BestandTegel";
import { notFound } from "next/navigation";
import { asc, inArray } from "drizzle-orm";
import { db, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { uitgaveMetRegels } from "@/lib/data";
import { formatEuro, verdeelRegel } from "@/lib/geld";
import { formatDatum } from "@/lib/datum";
import { verwijderUitgaveAction } from "../actions";

export default async function UitgaveDetail({
  params,
}: PageProps<"/uitgaven/[id]">) {
  await vereisGebruiker();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const uitgave = await uitgaveMetRegels(id);
  if (!uitgave) notFound();

  const huishoudens = await db
    .select()
    .from(couples)
    .orderBy(asc(couples.volgorde));
  const betaler = huishoudens.find((h) => h.id === uitgave.coupleId);
  const naamA = huishoudens[0]?.naam ?? "A";
  const naamB = huishoudens[1]?.naam ?? "B";

  const categorieNamen = new Map(
    (
      await db
        .select({ id: categories.id, naam: categories.naam })
        .from(categories)
        .where(
          inArray(
            categories.id,
            uitgave.regels.map((r) => r.categoryId),
          ),
        )
    ).map((c) => [c.id, c.naam]),
  );

  const totaal = uitgave.regels.reduce((som, r) => som + r.bedragCent, 0);
  const deelA = uitgave.regels.reduce(
    (som, r) => som + verdeelRegel(r.bedragCent, r.aandeelAPct).deelA,
    0,
  );

  const verwijder = verwijderUitgaveAction.bind(null, id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/uitgaven" className="text-sm text-accent underline">
          ← Uitgaven
        </Link>
        <div className="ml-auto flex gap-3">
          <Link
            href={`/uitgaven/${id}/bewerken`}
            className="rounded-lg border border-rand px-3 py-2 text-sm"
          >
            Bewerken
          </Link>
          <form action={verwijder}>
            <button className="rounded-lg border border-rand px-3 py-2 text-sm text-slecht">
              Verwijderen
            </button>
          </form>
        </div>
      </div>

      <header className="rounded-xl border border-rand bg-paneel p-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {uitgave.leverancier || "Zonder leverancier"}
        </h1>
        <p className="mt-1 text-sm text-gedempt">
          {formatDatum(uitgave.datum)} · voorgeschoten door{" "}
          {betaler?.naam ?? "onbekend"} · ingevoerd door {uitgave.invoerder}
        </p>
        {uitgave.opmerking && (
          <p className="mt-3 text-sm">{uitgave.opmerking}</p>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="inline text-gedempt">Totaal: </dt>
            <dd className="cijfers inline font-medium">
              {formatEuro(totaal)}
            </dd>
          </div>
          <div>
            <dt className="inline text-gedempt">{naamA}: </dt>
            <dd className="cijfers inline">{formatEuro(deelA)}</dd>
          </div>
          <div>
            <dt className="inline text-gedempt">{naamB}: </dt>
            <dd className="cijfers inline">{formatEuro(totaal - deelA)}</dd>
          </div>
        </dl>
      </header>

      <section className="overflow-x-auto rounded-xl border border-rand bg-paneel">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-rand text-left text-gedempt">
            <tr>
              <th className="p-3 font-normal">Omschrijving</th>
              <th className="p-3 font-normal">Categorie</th>
              <th className="p-3 text-right font-normal">Aantal</th>
              <th className="p-3 text-right font-normal">Bedrag</th>
              <th className="p-3 text-right font-normal">Verdeling</th>
            </tr>
          </thead>
          <tbody>
            {uitgave.regels.map((regel) => (
              <tr key={regel.id} className="border-b border-rand last:border-0">
                <td className="p-3">
                  {regel.omschrijving}
                  {regel.bron === "ai" && (
                    <span className="ml-2 rounded-full bg-accent-zacht px-2 py-0.5 text-xs text-accent">
                      uit bon
                    </span>
                  )}
                </td>
                <td className="p-3 text-gedempt">
                  {categorieNamen.get(regel.categoryId) ?? "—"}
                </td>
                <td className="cijfers p-3 text-right">{regel.aantal}</td>
                <td className="cijfers p-3 text-right">
                  {formatEuro(regel.bedragCent)}
                </td>
                <td className="cijfers p-3 text-right text-gedempt">
                  {regel.aandeelAPct}/{100 - regel.aandeelAPct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {uitgave.bonnen.length > 0 && (
        <section className="rounded-xl border border-rand bg-paneel p-4">
          <h2 className="mb-3 text-sm font-medium">Bonnen en bijlagen</h2>
          <ul className="flex flex-wrap gap-3">
            {uitgave.bonnen.map((bon) => (
              <li key={bon.id}>
                <a href={bon.url} target="_blank" rel="noreferrer">
                  <BestandTegel
                    naam={bon.naam}
                    mime={bon.mime}
                    voorbeeldUrl={bon.voorbeeldUrl}
                    zijde={176}
                  />
                </a>
                <p className="mt-1 text-xs text-gedempt">origineel openen</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
