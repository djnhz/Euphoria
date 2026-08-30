import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { haalReserveringen } from "@/lib/agenda";
import { agendaStatus } from "@/lib/instellingen";
import { vandaag } from "@/lib/datum";
import Vaarkalender from "@/components/Vaarkalender";

/** Eerste en laatste dag van de maand, plus de maand ervoor en erna voor de pijltjes. */
function maandGrenzen(jaar: number, maand: number) {
  const eerste = `${jaar}-${String(maand).padStart(2, "0")}-01`;
  const laatsteDag = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  const laatste = `${jaar}-${String(maand).padStart(2, "0")}-${laatsteDag}`;
  return { eerste, laatste };
}

export default async function VaarplanningPagina({
  searchParams,
}: PageProps<"/vaarplanning">) {
  const gebruiker = await vereisGebruiker();
  const params = await searchParams;

  const nu = vandaag();
  const jaar = Number(params.jaar) || Number(nu.slice(0, 4));
  const maand = Number(params.maand) || Number(nu.slice(5, 7));
  const { eerste, laatste } = maandGrenzen(jaar, maand);

  const [status, huishoudens] = await Promise.all([
    agendaStatus(),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  if (!status.gekoppeld || !status.agendaId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Vaarplanning</h1>
        <p className="rounded-xl border border-rand bg-paneel p-6 text-sm text-gedempt">
          De Google-agenda is nog niet gekoppeld. Dat regel je bij{" "}
          <Link href="/instellingen" className="text-accent underline">
            Instellingen
          </Link>
          .
        </p>
      </div>
    );
  }

  const resultaat = await haalReserveringen(eerste, laatste);
  const fout = "fout" in resultaat ? resultaat.fout : null;
  const reserveringen = "fout" in resultaat ? [] : resultaat;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vaarplanning</h1>
      {fout && (
        <p className="rounded-xl border border-rand bg-paneel p-4 text-sm text-slecht">
          {fout}
        </p>
      )}
      <Vaarkalender
        jaar={jaar}
        maand={maand}
        vandaag={nu}
        reserveringen={reserveringen}
        huishoudens={huishoudens.map((h) => ({
          id: h.id,
          naam: h.naam,
          volgorde: h.volgorde,
        }))}
        eigenUserId={gebruiker.id}
      />
    </div>
  );
}
