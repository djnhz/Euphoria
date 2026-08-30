import Link from "next/link";
import type { Reservering } from "@/lib/agenda";
import { formatDatum, vandaag } from "@/lib/datum";

/**
 * De eerstvolgende reserveringen op het dashboard. Kort en zonder knoppen: wie iets
 * wil wijzigen gaat naar de vaarplanning zelf.
 */
export default function DashboardAgenda({
  reserveringen,
  huishoudens,
  gekoppeld,
  fout,
}: {
  reserveringen: Reservering[];
  huishoudens: { id: number; naam: string; kleur: string }[];
  gekoppeld: boolean;
  fout: string | null;
}) {
  const kleurVan = new Map(huishoudens.map((h) => [h.id, h.kleur]));
  const nu = vandaag();

  return (
    <section className="rounded-xl border border-rand bg-paneel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Komende drie weken</h2>
        <Link href="/vaarplanning" className="text-sm text-accent underline">
          hele planning
        </Link>
      </div>

      {!gekoppeld ? (
        <p className="text-sm text-gedempt">
          De Google-agenda is nog niet gekoppeld.{" "}
          <Link href="/instellingen" className="text-accent underline">
            Instellingen
          </Link>
        </p>
      ) : fout ? (
        <p className="text-sm text-slecht">{fout}</p>
      ) : reserveringen.length === 0 ? (
        <p className="text-sm text-gedempt">
          Niemand vaart de komende drie weken.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reserveringen.map((reservering) => {
            const loopt = reservering.van <= nu && reservering.tot >= nu;
            return (
              <li
                key={reservering.id}
                className="flex items-center gap-3 rounded-lg border border-rand p-2"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded"
                  style={{
                    background:
                      kleurVan.get(reservering.coupleId ?? -1) ?? "#8b5cf6",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {reservering.titel}
                    {loopt && (
                      <span className="ml-2 rounded-full bg-accent-zacht px-2 py-0.5 text-xs text-accent">
                        nu
                      </span>
                    )}
                  </p>
                  <p className="cijfers truncate text-sm text-gedempt">
                    {formatDatum(reservering.van)}
                    {reservering.tot !== reservering.van &&
                      ` t/m ${formatDatum(reservering.tot)}`}
                    {reservering.opmerking && ` · ${reservering.opmerking}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
