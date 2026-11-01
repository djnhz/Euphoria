import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, couples, seizoenen } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { agendaStatus } from "@/lib/instellingen";
import { feestdagenIn } from "@/lib/feestdagen";
import { MAANDEN, standaardSeizoen, vandaag } from "@/lib/datum";
import { haalVakanties } from "@/lib/vakantiebron";
import { leesPlan } from "@/lib/seizoenplan";
import Seizoensplanner from "@/components/Seizoensplanner";
import { Schermbody, Schermkop, Segment } from "@/components/Scherm";
import { PLANNING_TABS } from "@/components/planningTabs";

export default async function SeizoenPagina({
  searchParams,
}: PageProps<"/vaarplanning/seizoen">) {
  await vereisGebruiker();
  const params = await searchParams;

  const huidigJaar = Number(vandaag().slice(0, 4));
  const gekozen = Number(params.jaar);
  // Standaard het komende seizoen, want daar plan je meestal voor.
  const jaar =
    Number.isInteger(gekozen) && gekozen >= 2020 && gekozen <= 2100
      ? gekozen
      : huidigJaar + 1;

  const [huishoudens, status, vakanties, bewaard] = await Promise.all([
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    agendaStatus(),
    haalVakanties(jaar),
    db.select().from(seizoenen).where(eq(seizoenen.jaar, jaar)),
  ]);
  const plan = leesPlan(bewaard[0]?.plan);
  const standaard = standaardSeizoen(jaar);
  const kort = (iso: string) =>
    `${Number(iso.slice(8))} ${MAANDEN[Number(iso.slice(5, 7)) - 1]}`;
  const periode = `${kort(plan?.start ?? standaard.start)} t/m ${kort(plan?.eind ?? standaard.eind)}`;

  return (
    <>
      <Schermkop
        titel={`Seizoen ${jaar}`}
        onderschrift={`${plan ? "vastgelegd" : "concept"} · ${periode}`}
        tabs={<Segment items={PLANNING_TABS} actief="/vaarplanning/seizoen" />}
      />

      <Schermbody>
        {!status.gekoppeld && (
          <p className="rounded-2xl border border-dashed border-rand-sterk p-4 text-sm text-gedempt text-pretty">
            De Google-agenda is nog niet gekoppeld, dus publiceren lukt niet. Je kunt
            hieronder wel verdelen en kijken hoe het uitpakt.{" "}
            <Link href="/instellingen" className="text-link underline">
              Koppelen
            </Link>
          </p>
        )}

        {/* Een eigen key per jaar: anders houdt React bij het wisselen van jaar de
            instellingen van het vorige jaar vast, en worden die bij het nieuwe bewaard. */}
        <Seizoensplanner
          key={jaar}
          jaar={jaar}
          huishoudens={huishoudens.map((h) => ({ id: h.id, naam: h.naam }))}
          feestdagen={feestdagenIn(jaar)}
          vakanties={vakanties.vakanties}
          vakantieHerkomst={vakanties.herkomst}
          plan={plan}
          kanPubliceren={status.gekoppeld && status.agendaId !== null}
        />
      </Schermbody>
    </>
  );
}
