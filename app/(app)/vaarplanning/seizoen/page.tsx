import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisBeheerder } from "@/lib/auth";
import { agendaStatus } from "@/lib/instellingen";
import { feestdagenIn } from "@/lib/feestdagen";
import { vandaag } from "@/lib/datum";
import Seizoensplanner from "@/components/Seizoensplanner";

export default async function SeizoenPagina({
  searchParams,
}: PageProps<"/vaarplanning/seizoen">) {
  await vereisBeheerder();
  const params = await searchParams;

  const huidigJaar = Number(vandaag().slice(0, 4));
  const gekozen = Number(params.jaar);
  // Standaard het komende seizoen, want daar plan je meestal voor.
  const jaar =
    Number.isInteger(gekozen) && gekozen >= 2020 && gekozen <= 2100
      ? gekozen
      : huidigJaar + 1;

  const [huishoudens, status] = await Promise.all([
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    agendaStatus(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/vaarplanning" className="text-sm text-accent underline">
          ← Vaarplanning
        </Link>
        <h1 className="ml-auto text-2xl font-semibold tracking-tight sm:ml-0">
          Seizoensplanning
        </h1>
      </div>

      {!status.gekoppeld && (
        <p className="rounded-xl border border-rand bg-paneel p-4 text-sm text-gedempt">
          De Google-agenda is nog niet gekoppeld, dus publiceren lukt niet. Je kunt
          hieronder wel rekenen en kijken hoe het uitpakt.{" "}
          <Link href="/instellingen" className="text-accent underline">
            Koppelen
          </Link>
        </p>
      )}

      <Seizoensplanner
        jaar={jaar}
        huishoudens={huishoudens.map((h) => ({ id: h.id, naam: h.naam }))}
        feestdagen={feestdagenIn(jaar)}
        kanPubliceren={status.gekoppeld && status.agendaId !== null}
      />
    </div>
  );
}
