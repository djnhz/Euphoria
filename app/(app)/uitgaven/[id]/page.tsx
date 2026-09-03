import Link from "next/link";
import BestandTegel from "@/components/BestandTegel";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, couples, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { uitgaveMetRegels } from "@/lib/data";
import { formatEuro } from "@/lib/geld";
import { formatDatum } from "@/lib/datum";
import { verwijderUitgaveAction } from "../actions";
import Gegevenstabel from "@/components/Gegevenstabel";
import { Bladkop, Bovenschrift, Paneel, Schermbody } from "@/components/Scherm";

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

  const postNamen = new Map(
    (await db.select({ id: posten.id, naam: posten.naam }).from(posten)).map(
      (p) => [p.id, p.naam] as const,
    ),
  );

  const totaal = uitgave.regels.reduce((som, r) => som + r.bedragCent, 0);

  const verwijder = verwijderUitgaveAction.bind(null, id);

  return (
    <>
      <Bladkop terug="/uitgaven" titel="Uitgave" />

      <Schermbody>
        <section className="rounded-2xl bg-inkt p-[18px] text-linnen">
          <p className="bovenschrift !text-messing">
            {formatDatum(uitgave.datum)}
          </p>
          <h1 className="titel mt-1.5 text-[26px] leading-tight text-pretty">
            {uitgave.leverancier || "Zonder leverancier"}
          </h1>
          <p className="titel cijfers mt-2 text-[34px] leading-none">
            {formatEuro(totaal)}
          </p>
          {/* Kosten gaan altijd half om half; ieders aandeel is dus de helft. */}
          <p className="mt-2.5 text-[12.5px] text-linnen/70 text-pretty">
            Voorgeschoten door {betaler?.naam ?? "onbekend"} · ieder{" "}
            <span className="cijfers">
              {formatEuro(Math.round(totaal / 2))}
            </span>
          </p>
          {uitgave.opmerking && (
            <p className="mt-3 text-sm text-linnen/85">{uitgave.opmerking}</p>
          )}
          <p className="mt-3 text-[11px] text-linnen/45">
            ingevoerd door {uitgave.invoerder}
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-rand bg-paneel pb-1">
          <Gegevenstabel
            rijen={uitgave.regels}
            sleutel={(regel) => regel.id}
            leeg="Deze uitgave heeft geen regels."
            kolommen={[
              {
                kop: "Omschrijving",
                titel: true,
                cel: (regel) => (
                  <>
                    {regel.omschrijving}
                    {regel.bron === "ai" && (
                      <span className="ml-2 rounded-md bg-messing-tint px-2 py-1 text-[10.5px] font-semibold text-messing-inkt">
                        uit bon
                      </span>
                    )}
                  </>
                ),
              },
              {
                kop: "Post",
                cel: (regel) => (
                  <span className="text-gedempt">
                    {postNamen.get(regel.postId) ?? "—"}
                  </span>
                ),
              },
              {
                kop: "Aantal",
                rechts: true,
                cel: (regel) => <span className="cijfers">{regel.aantal}</span>,
              },
              {
                kop: "Bedrag",
                rechts: true,
                cel: (regel) => (
                  <span className="cijfers">
                    {formatEuro(regel.bedragCent)}
                  </span>
                ),
              },
            ]}
          />
        </section>

        {uitgave.bonnen.length > 0 && (
          <Paneel>
            <Bovenschrift className="mb-3">Bonnen en bijlagen</Bovenschrift>
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
          </Paneel>
        )}

        <div className="flex gap-2.5">
          <Link
            href={`/uitgaven/${id}/bewerken`}
            className="flex-1 rounded-xl border border-rand-sterk bg-paneel px-4 py-3 text-center text-sm font-semibold transition hover:border-inkt"
          >
            Bewerken
          </Link>
          <form action={verwijder} className="flex-1">
            <button className="w-full rounded-xl border border-rand px-4 py-3 text-sm text-slecht transition hover:border-slecht">
              Verwijderen
            </button>
          </form>
        </div>
      </Schermbody>
    </>
  );
}
