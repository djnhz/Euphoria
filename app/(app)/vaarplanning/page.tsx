import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { haalReserveringen } from "@/lib/agenda";
import { agendaStatus } from "@/lib/instellingen";
import { MAANDEN, vandaag } from "@/lib/datum";
import Vaarkalender from "@/components/Vaarkalender";
import { Schermbody, Schermkop, Segment } from "@/components/Scherm";
import { PLANNING_TABS } from "@/components/planningTabs";

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

  const kop = (
    <Schermkop
      titel="Planning"
      onderschrift={`${MAANDEN[maand - 1]} ${jaar}`}
      tabs={<Segment items={PLANNING_TABS} actief="/vaarplanning" />}
    />
  );

  if (!status.gekoppeld || !status.agendaId) {
    return (
      <>
        {kop}
        <Schermbody>
          <p className="rounded-2xl border border-dashed border-rand-sterk p-5 text-sm text-gedempt text-pretty">
            De Google-agenda is nog niet gekoppeld, dus reserveringen kunnen we niet
            ophalen. Dat regel je bij{" "}
            <Link href="/instellingen" className="text-link underline">
              Instellingen
            </Link>
            . {/* Ook zonder agenda kun je een seizoen uitrekenen; alleen publiceren
                   lukt dan niet, en dat zegt dat scherm zelf. */}
            Het seizoen verdelen kan wel.
          </p>
          <Link
            href="/vaarplanning/seizoen"
            className="rounded-xl border border-rand-sterk bg-paneel px-4 py-3.5 text-center text-sm font-semibold transition hover:border-inkt"
          >
            Seizoen verdelen
          </Link>
        </Schermbody>
      </>
    );
  }

  const resultaat = await haalReserveringen(eerste, laatste);
  const fout = "fout" in resultaat ? resultaat.fout : null;
  const reserveringen = "fout" in resultaat ? [] : resultaat;

  return (
    <>
      {kop}
      <Schermbody>
        {fout && (
          <p className="rounded-2xl border border-rand bg-paneel p-4 text-sm text-slecht">
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
          eigenNaam={gebruiker.naam}
        />
      </Schermbody>
    </>
  );
}
