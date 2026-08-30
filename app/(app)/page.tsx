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
import { haalReserveringen } from "@/lib/agenda";
import { agendaStatus } from "@/lib/instellingen";
import { plusDagen, vandaag } from "@/lib/datum";
import DashboardGrafieken from "@/components/DashboardGrafieken";
import DashboardAgenda from "@/components/DashboardAgenda";
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

  const nu = vandaag();
  const [alleRegels, jaarRegels, budget, huishoudens, agenda] = await Promise.all([
    haalRegels(),
    haalRegels(jaar),
    budgetOverzicht(jaar),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    agendaStatus(),
  ]);

  // Drie weken vooruit; zonder koppeling heeft ophalen geen zin.
  const reserveringen = agenda.gekoppeld
    ? await haalReserveringen(nu, plusDagen(nu, 20))
    : ([] as Awaited<ReturnType<typeof haalReserveringen>>);

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
        <div className="ml-auto">
          <JaarKiezer jaren={jaren} huidig={jaar} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Snelknop
          href="/uitgaven/nieuw"
          titel="Bon indienen"
          uitleg="Foto maken, laten uitlezen, verdelen"
        />
        <Snelknop
          href="/vaarplanning"
          titel="Boot reserveren"
          uitleg="Dagen vastleggen in de gedeelde agenda"
        />
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

      <DashboardAgenda
        reserveringen={"fout" in reserveringen ? [] : reserveringen}
        huishoudens={huishoudens.map((h, i) => ({
          id: h.id,
          naam: h.naam,
          kleur: HUISHOUDKLEUREN[i] ?? "#8b5cf6",
        }))}
        gekoppeld={agenda.gekoppeld}
        fout={"fout" in reserveringen ? reserveringen.fout : null}
      />

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
                  {/* Zonder budget geen balk: een lege balk leest als nul procent besteed. */}
                  {deel !== null && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-rand">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, deel * 100)}%`,
                          background: over ? "var(--slecht)" : rij.kleur,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Zelfde kleuren als de vaarkalender en de seizoensplanner. */
const HUISHOUDKLEUREN = ["#0ea5e9", "#f97316"];

function Snelknop({
  href,
  titel,
  uitleg,
}: {
  href: "/uitgaven/nieuw" | "/vaarplanning";
  titel: string;
  uitleg: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-rand bg-paneel p-4 transition hover:border-accent"
    >
      <span className="block font-medium">{titel}</span>
      <span className="block text-sm text-gedempt">{uitleg}</span>
    </Link>
  );
}
