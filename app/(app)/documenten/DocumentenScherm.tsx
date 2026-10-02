import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, isNull } from "drizzle-orm";
import { db, documents, expenses, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { alleMappen, haalMap, kruimelpad } from "@/lib/mappen";
import { heeftBlob } from "@/lib/opslag";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentLijst from "@/components/DocumentLijst";
import MapTegel from "@/components/MapTegel";
import MapToevoegen from "@/components/MapToevoegen";
import { Schermbody, Schermkop } from "@/components/Scherm";

/**
 * Eén map: zijn submappen, zijn documenten, en het kruimelpad erboven om terug te
 * kunnen. Zowel de bovenste laag (`mapId: null`) als een echte map tonen hetzelfde
 * scherm; alleen wat erin zit verschilt.
 */
export default async function DocumentenScherm({
  mapId,
}: {
  mapId: number | null;
}) {
  await vereisGebruiker();

  const [huidig, alle, rijen] = await Promise.all([
    mapId === null ? null : haalMap(mapId),
    alleMappen(),
    db
      .select({
        id: documents.id,
        naam: documents.naam,
        mime: documents.mime,
        grootteBytes: documents.grootteBytes,
        voorbeeldUrl: documents.voorbeeldUrl,
        expenseId: documents.expenseId,
        leverancier: expenses.leverancier,
        geuploadOp: documents.geuploadOp,
        geuploadDoor: users.naam,
      })
      .from(documents)
      .innerJoin(users, eq(documents.geuploadDoor, users.id))
      .leftJoin(expenses, eq(documents.expenseId, expenses.id))
      .where(mapId === null ? isNull(documents.mapId) : eq(documents.mapId, mapId))
      .orderBy(desc(documents.geuploadOp)),
  ]);

  if (mapId !== null && !huidig) notFound();

  const submappen = alle
    .filter((m) => m.ouderId === mapId)
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  const pad = mapId === null ? [] : kruimelpad(mapId, alle);

  return (
    <>
      <Schermkop
        titel={huidig?.naam ?? "Documenten"}
        onderschrift={
          mapId === null ? "bonnen bij een uitgave staan hier ook" : undefined
        }
      />
      <Schermbody>
        {/* Boven aan een echte map staat de weg terug; bovenaan is er niets om naar
            terug te gaan. */}
        {pad.length > 0 && (
          <nav className="-mt-1 flex flex-wrap items-center gap-1 text-[13px] text-gedempt">
            <Link href="/documenten" className="text-link hover:text-inkt">
              Documenten
            </Link>
            {pad.map((map, i) => (
              <span key={map.id} className="flex items-center gap-1">
                <span aria-hidden>›</span>
                {i === pad.length - 1 ? (
                  <span className="text-inkt">{map.naam}</span>
                ) : (
                  <Link
                    href={`/documenten/${map.id}`}
                    className="text-link hover:text-inkt"
                  >
                    {map.naam}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {submappen.map((map) => (
            <MapTegel key={map.id} id={map.id} naam={map.naam} />
          ))}
          <MapToevoegen ouderId={mapId} />
        </div>

        <DocumentUpload heeftBlob={heeftBlob()} mapId={mapId} />
        <DocumentLijst
          rijen={rijen.map((rij) => ({
            ...rij,
            geuploadOp: rij.geuploadOp.toISOString(),
          }))}
        />
      </Schermbody>
    </>
  );
}
