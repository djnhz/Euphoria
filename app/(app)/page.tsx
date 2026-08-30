import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import {
  beschikbareJaren,
  budgetOverzicht,
  genereerVasteLasten,
  haalRegels,
  perMaandPerHuishouden,
  saldoPerMaand,
  totaalPerCategorie,
} from "@/lib/data";
import { formatEuro, saldoCent } from "@/lib/geld";
import DashboardGrafieken from "@/components/DashboardGrafieken";
import JaarKiezer from "@/components/JaarKiezer";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const gebruiker = await vereisGebruiker();

  // Vaste lasten worden hier lui aangemaakt; zie genereerVasteLasten.
  await genereerVasteLasten(gebruiker.id);

  const params = await searchParams;
  const jaren = await beschikbareJaren();
  const gekozenJaar = Number(params.jaar);
  const jaar = jaren.includes(gekozenJaar)
    ? gekozenJaar
    : new Date().getFullYear();

  const [alleRegels, jaarRegels, budget, huishoudens] = await Promise.all([
    haalRegels(),
    haalRegels(jaar),
    budgetOverzicht(jaar),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  const namen = {
    a: huishoudens[0]?.naam ?? "Huishouden A",
    b: huishoudens[1]?.naam ?? "Huishouden B",
  };
  const saldo = saldoCent(alleRegels);
  const totaalJaar = jaarRegels.reduce((som, r) => som + r.bedragCent, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="ml-auto flex items-center gap-3">
          <JaarKiezer jaren={jaren} huidig={jaar} />
          <Link
            href="/uitgaven/nieuw"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            + Bon
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-rand bg-paneel p-5">
        <p className="text-sm text-gedempt">Onderling openstaand</p>
        {saldo === 0 ? (
          <p className="mt-1 text-2xl font-semibold">Jullie staan gelijk</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold">
            <span className="cijfers">{formatEuro(Math.abs(saldo))}</span>
            <span className="ml-2 text-base font-normal text-gedempt">
              van {saldo > 0 ? namen.b : namen.a} naar{" "}
              {saldo > 0 ? namen.a : namen.b}
            </span>
          </p>
        )}
        <p className="mt-3 text-sm text-gedempt">
          Uitgaven in {jaar}:{" "}
          <span className="cijfers text-tekst">{formatEuro(totaalJaar)}</span>
        </p>
      </section>

      <DashboardGrafieken
        data={{
          categorieen: totaalPerCategorie(jaarRegels),
          perMaand: perMaandPerHuishouden(jaarRegels),
          saldoVerloop: saldoPerMaand(jaarRegels),
          namen,
        }}
      />

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-3 text-sm font-medium">Budget {jaar}</h2>
        {budget.length === 0 ? (
          <p className="text-sm text-gedempt">
            Nog geen budgetten ingesteld. Dat kan bij{" "}
            <Link href="/instellingen" className="text-accent underline">
              Instellingen
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {budget.map((rij) => {
              const budgetCent = rij.budgetJaarCent;
              const deel =
                budgetCent && budgetCent > 0
                  ? rij.werkelijkCent / budgetCent
                  : null;
              const over = deel !== null && deel > 1;
              return (
                <li key={rij.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{rij.naam}</span>
                    <span className="cijfers text-gedempt">
                      {formatEuro(rij.werkelijkCent)}
                      {budgetCent !== null && ` van ${formatEuro(budgetCent)}`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-rand">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (deel ?? 0) * 100)}%`,
                        background: over ? "var(--slecht)" : rij.kleur,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
