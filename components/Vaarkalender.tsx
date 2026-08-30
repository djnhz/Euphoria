"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { Reservering } from "@/lib/agenda";
import { formatDatum } from "@/lib/datum";
import {
  annuleerAction,
  reserveerAction,
  type ReserveerState,
} from "@/app/(app)/vaarplanning/actions";

const MAANDNAMEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const DAGKOPPEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Kleur per huishouden, zodat je in één oogopslag ziet wie er vaart. */
const KLEUREN = ["#0ea5e9", "#f97316"];

export default function Vaarkalender({
  jaar,
  maand,
  vandaag,
  reserveringen,
  huishoudens,
  eigenUserId,
}: {
  jaar: number;
  maand: number;
  vandaag: string;
  reserveringen: Reservering[];
  huishoudens: { id: number; naam: string; volgorde: number }[];
  eigenUserId: number;
}) {
  const [state, reserveer, bezig] = useActionState<ReserveerState, FormData>(
    reserveerAction,
    null,
  );
  const [van, setVan] = useState(vandaag);
  const [totEnMet, setTotEnMet] = useState(vandaag);

  const kleurVan = useMemo(() => {
    const perId = new Map<number, string>();
    huishoudens.forEach((h, i) => perId.set(h.id, KLEUREN[i] ?? "#8b5cf6"));
    return perId;
  }, [huishoudens]);

  const dagen = useMemo(() => maandRaster(jaar, maand), [jaar, maand]);
  const perDag = useMemo(() => {
    const kaart = new Map<string, Reservering[]>();
    for (const reservering of reserveringen) {
      for (const dag of dagenTussen(reservering.van, reservering.tot)) {
        kaart.set(dag, [...(kaart.get(dag) ?? []), reservering]);
      }
    }
    return kaart;
  }, [reserveringen]);

  const vorige = maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
  const volgende = maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };

  // Na een overlapwaarschuwing is de tweede druk op de knop de bevestiging.
  const tochDoorgaan = state?.soort === "overlap" ? "ja" : "nee";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-rand bg-paneel p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/vaarplanning?jaar=${vorige.jaar}&maand=${vorige.maand}`}
            className="rounded-lg border border-rand px-3 py-1.5 text-sm"
            aria-label="Vorige maand"
          >
            ←
          </Link>
          <h2 className="text-sm font-medium">
            {MAANDNAMEN[maand - 1]} {jaar}
          </h2>
          <Link
            href={`/vaarplanning?jaar=${volgende.jaar}&maand=${volgende.maand}`}
            className="rounded-lg border border-rand px-3 py-1.5 text-sm"
            aria-label="Volgende maand"
          >
            →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gedempt">
          {DAGKOPPEN.map((dag) => (
            <div key={dag} className="py-1">
              {dag}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dagen.map((dag) => {
            const geboekt = dag.datum ? (perDag.get(dag.datum) ?? []) : [];
            return (
              <div
                key={dag.sleutel}
                className={`min-h-14 rounded-lg border p-1 text-xs ${
                  dag.datum
                    ? dag.datum === vandaag
                      ? "border-accent"
                      : "border-rand"
                    : "border-transparent"
                }`}
              >
                {dag.datum && (
                  <>
                    <span className="cijfers text-gedempt">
                      {Number(dag.datum.slice(8))}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {geboekt.map((reservering) => (
                        <span
                          key={reservering.id + dag.datum}
                          title={`${reservering.titel}${reservering.opmerking ? ` — ${reservering.opmerking}` : ""}`}
                          className="truncate rounded px-1 text-[10px] text-white"
                          style={{
                            background:
                              kleurVan.get(reservering.coupleId ?? -1) ?? "#8b5cf6",
                          }}
                        >
                          {reservering.titel}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-3 flex flex-wrap gap-3 text-xs text-gedempt">
          {huishoudens.map((huishouden) => (
            <li key={huishouden.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ background: kleurVan.get(huishouden.id) }}
              />
              {huishouden.naam}
            </li>
          ))}
        </ul>
      </section>

      <form
        action={reserveer}
        className="grid gap-3 rounded-xl border border-rand bg-paneel p-4 sm:grid-cols-[1fr_1fr_2fr_auto]"
      >
        <input type="hidden" name="tochDoorgaan" value={tochDoorgaan} />
        <Veld label="Van">
          <input
            type="date"
            name="van"
            value={van}
            onChange={(e) => setVan(e.target.value)}
            required
            className={invoer}
          />
        </Veld>
        <Veld label="Tot en met">
          <input
            type="date"
            name="totEnMet"
            value={totEnMet}
            min={van}
            onChange={(e) => setTotEnMet(e.target.value)}
            required
            className={invoer}
          />
        </Veld>
        <Veld label="Opmerking">
          <input
            name="opmerking"
            placeholder="Bijvoorbeeld: weekend Zeeland"
            className={invoer}
          />
        </Veld>
        <div className="flex items-end">
          <button
            disabled={bezig}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig
              ? "Bezig…"
              : state?.soort === "overlap"
                ? "Toch reserveren"
                : "Reserveren"}
          </button>
        </div>

        {state && (
          <p
            className={`text-sm sm:col-span-4 ${
              state.soort === "fout"
                ? "text-slecht"
                : state.soort === "overlap"
                  ? "text-tekst"
                  : "text-goed"
            }`}
          >
            {state.melding}
          </p>
        )}
      </form>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-3 text-sm font-medium">
          Reserveringen in {MAANDNAMEN[maand - 1]}
        </h2>
        {reserveringen.length === 0 ? (
          <p className="text-sm text-gedempt">Niemand vaart deze maand.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reserveringen.map((reservering) => (
              <li
                key={reservering.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-rand p-3"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded"
                  style={{
                    background:
                      kleurVan.get(reservering.coupleId ?? -1) ?? "#8b5cf6",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{reservering.titel}</p>
                  <p className="truncate text-sm text-gedempt">
                    {formatDatum(reservering.van)}
                    {reservering.tot !== reservering.van &&
                      ` tot en met ${formatDatum(reservering.tot)}`}
                    {reservering.opmerking && ` · ${reservering.opmerking}`}
                  </p>
                </div>
                {/* Alleen wat via de app geboekt is kun je hier weghalen; de rest
                    beheer je in Google Agenda zelf. */}
                {reservering.userId === eigenUserId && (
                  <form action={annuleerAction}>
                    <input type="hidden" name="id" value={reservering.id} />
                    <button className="text-sm text-slecht underline">
                      annuleren
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const invoer = "w-full rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

function Veld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gedempt">{label}</span>
      {children}
    </label>
  );
}

/** Zes weken van maandag tot zondag, met lege plekken buiten de maand. */
function maandRaster(jaar: number, maand: number) {
  const eersteDag = new Date(Date.UTC(jaar, maand - 1, 1));
  // getUTCDay geeft zondag als 0; wij beginnen op maandag.
  const verschuiving = (eersteDag.getUTCDay() + 6) % 7;
  const dagenInMaand = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();

  const cellen: { sleutel: string; datum: string | null }[] = [];
  for (let i = 0; i < verschuiving; i++) {
    cellen.push({ sleutel: `leeg-voor-${i}`, datum: null });
  }
  for (let dag = 1; dag <= dagenInMaand; dag++) {
    const datum = `${jaar}-${String(maand).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
    cellen.push({ sleutel: datum, datum });
  }
  while (cellen.length % 7 !== 0) {
    cellen.push({ sleutel: `leeg-na-${cellen.length}`, datum: null });
  }
  return cellen;
}

function dagenTussen(van: string, tot: string): string[] {
  const dagen: string[] = [];
  const [j, m, d] = van.split("-").map(Number);
  const loper = new Date(Date.UTC(j, m - 1, d));
  const einde = new Date(`${tot}T00:00:00Z`);
  // Ruime bovengrens: een reservering van meer dan een jaar is een invoerfout.
  while (loper <= einde && dagen.length < 400) {
    dagen.push(loper.toISOString().slice(0, 10));
    loper.setUTCDate(loper.getUTCDate() + 1);
  }
  return dagen;
}
