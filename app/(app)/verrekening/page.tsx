import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { beschikbareJaren, haalRegels, type RegelRij } from "@/lib/data";
import { formatEuro, verdeelRegel, verrekening } from "@/lib/geld";
import { formatDatum } from "@/lib/datum";
import JaarKiezer from "@/components/JaarKiezer";

export default async function VerrekeningPagina({
  searchParams,
}: PageProps<"/verrekening">) {
  await vereisGebruiker();

  const params = await searchParams;
  const jaren = await beschikbareJaren();
  const gekozen = Number(params.jaar);
  const jaar = jaren.includes(gekozen) ? gekozen : undefined;

  const [regels, huishoudens] = await Promise.all([
    haalRegels(jaar),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  const naamA = huishoudens[0]?.naam ?? "Huishouden A";
  const naamB = huishoudens[1]?.naam ?? "Huishouden B";
  const overzicht = verrekening(regels);
  const perUitgave = groepeerPerUitgave(regels);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Verrekening</h1>
        <div className="ml-auto">
          <JaarKiezer jaren={[0, ...jaren]} huidig={jaar ?? 0} allesLabel="Alles" />
        </div>
      </div>

      <section className="rounded-xl border border-rand bg-paneel p-5">
        <p className="text-sm text-gedempt">
          {jaar ? `Stand over ${jaar}` : "Stand over alle jaren"}
        </p>
        {overzicht.saldo === 0 ? (
          <p className="mt-1 text-2xl font-semibold">Jullie staan gelijk</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold">
            <span className="cijfers">{formatEuro(Math.abs(overzicht.saldo))}</span>
            <span className="ml-2 text-base font-normal text-gedempt">
              van {overzicht.saldo > 0 ? naamB : naamA} naar{" "}
              {overzicht.saldo > 0 ? naamA : naamB}
            </span>
          </p>
        )}
        <p className="mt-3 text-xs text-gedempt">
          Onderlinge betalingen worden niet bijgehouden, dus dit bedrag telt door.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            naam: naamA,
            voorgeschoten: overzicht.voorgeschotenA,
            aandeel: overzicht.aandeelA,
          },
          {
            naam: naamB,
            voorgeschoten: overzicht.voorgeschotenB,
            aandeel: overzicht.aandeelB,
          },
        ].map((kant) => {
          const verschil = kant.voorgeschoten - kant.aandeel;
          return (
            <section
              key={kant.naam}
              className="rounded-xl border border-rand bg-paneel p-4"
            >
              <h2 className="text-sm font-medium">{kant.naam}</h2>
              <dl className="mt-3 flex flex-col gap-1 text-sm">
                <Rij label="Voorgeschoten" cent={kant.voorgeschoten} />
                <Rij label="Eigen aandeel" cent={kant.aandeel} />
                <div className="mt-1 flex justify-between border-t border-rand pt-2">
                  <dt className="text-gedempt">
                    {verschil >= 0 ? "Nog te ontvangen" : "Nog te betalen"}
                  </dt>
                  <dd
                    className={`cijfers font-medium ${
                      verschil > 0 ? "text-goed" : verschil < 0 ? "text-slecht" : ""
                    }`}
                  >
                    {formatEuro(Math.abs(verschil))}
                  </dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>

      <section className="overflow-x-auto rounded-xl border border-rand bg-paneel">
        <h2 className="p-4 pb-0 text-sm font-medium">
          Wie betaalde wat{jaar ? ` in ${jaar}` : ""}
        </h2>
        {perUitgave.length === 0 ? (
          <p className="p-4 text-sm text-gedempt">Nog geen uitgaven.</p>
        ) : (
          <table className="mt-3 w-full min-w-[38rem] text-sm">
            <thead className="border-y border-rand text-left text-gedempt">
              <tr>
                <th className="p-3 font-normal">Datum</th>
                <th className="p-3 font-normal">Leverancier</th>
                <th className="p-3 font-normal">Voorgeschoten door</th>
                <th className="p-3 text-right font-normal">Bedrag</th>
                <th className="p-3 text-right font-normal">{naamA}</th>
                <th className="p-3 text-right font-normal">{naamB}</th>
              </tr>
            </thead>
            <tbody>
              {perUitgave.map((uitgave) => (
                <tr
                  key={uitgave.expenseId}
                  className="border-b border-rand last:border-0"
                >
                  <td className="p-3 whitespace-nowrap">
                    {formatDatum(uitgave.datum)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/uitgaven/${uitgave.expenseId}`}
                      className="text-accent underline"
                    >
                      {uitgave.leverancier || "Zonder leverancier"}
                    </Link>
                  </td>
                  <td className="p-3 text-gedempt">
                    {uitgave.betaaldDoorA ? naamA : naamB}
                  </td>
                  <td className="cijfers p-3 text-right">
                    {formatEuro(uitgave.totaal)}
                  </td>
                  <td className="cijfers p-3 text-right text-gedempt">
                    {formatEuro(uitgave.deelA)}
                  </td>
                  <td className="cijfers p-3 text-right text-gedempt">
                    {formatEuro(uitgave.totaal - uitgave.deelA)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Rij({ label, cent }: { label: string; cent: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gedempt">{label}</dt>
      <dd className="cijfers">{formatEuro(cent)}</dd>
    </div>
  );
}

/** Regels horen bij een uitgave; voor dit overzicht tellen we ze per bon op. */
function groepeerPerUitgave(regels: readonly RegelRij[]) {
  const perId = new Map<
    number,
    {
      expenseId: number;
      datum: string;
      leverancier: string;
      betaaldDoorA: boolean;
      totaal: number;
      deelA: number;
    }
  >();

  for (const regel of regels) {
    const huidig = perId.get(regel.expenseId) ?? {
      expenseId: regel.expenseId,
      datum: regel.datum,
      leverancier: regel.leverancier,
      betaaldDoorA: regel.betaaldDoorA,
      totaal: 0,
      deelA: 0,
    };
    huidig.totaal += regel.bedragCent;
    huidig.deelA += verdeelRegel(regel.bedragCent, regel.aandeelAPct).deelA;
    perId.set(regel.expenseId, huidig);
  }

  return [...perId.values()].sort((a, b) => b.datum.localeCompare(a.datum));
}
