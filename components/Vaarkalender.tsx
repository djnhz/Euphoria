"use client";

import { HUISHOUDKLEUREN } from "@/lib/kleuren";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { Reservering } from "@/lib/agenda";
import { formatDatum } from "@/lib/datum";
import {
  geefDagenVrijAction,
  reserveerAction,
  type ReserveerState,
  type VrijgeefState,
} from "@/app/(app)/vaarplanning/actions";

const MAANDNAMEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];
const DAGKOPPEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Kleur per huishouden, zodat je in één oogopslag ziet wie er vaart. */
const KLEUREN = HUISHOUDKLEUREN;

export default function Vaarkalender({
  jaar,
  maand,
  vandaag,
  reserveringen,
  huishoudens,
  eigenCoupleId,
  eigenNaam,
}: {
  jaar: number;
  maand: number;
  vandaag: string;
  reserveringen: Reservering[];
  huishoudens: { id: number; naam: string; volgorde: number }[];
  /** Weken van je eigen huishouden mag je aanpassen, ook die uit de planning. */
  eigenCoupleId: number;
  /** Standaardtitel voor een nieuwe reservering; je mag hem overschrijven. */
  eigenNaam: string;
}) {
  const [state, reserveer, bezig] = useActionState<ReserveerState, FormData>(
    reserveerAction,
    null,
  );
  const [titel, setTitel] = useState(eigenNaam);
  const [van, setVan] = useState(vandaag);
  const [totEnMet, setTotEnMet] = useState(vandaag);

  const kleurVan = useMemo(() => {
    const perId = new Map<number, string>();
    huishoudens.forEach((h, i) => perId.set(h.id, KLEUREN[i] ?? "#3F6B54"));
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

  const vorige =
    maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
  const volgende =
    maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };

  // Na een overlapwaarschuwing is de tweede druk op de knop de bevestiging.
  const tochDoorgaan = state?.soort === "overlap" ? "ja" : "nee";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-rand bg-paneel p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/vaarplanning?jaar=${vorige.jaar}&maand=${vorige.maand}`}
            className="rounded-xl border border-rand-sterk px-3 py-2 text-sm"
            aria-label="Vorige maand"
          >
            ←
          </Link>
          <h2 className="text-sm font-medium">
            {MAANDNAMEN[maand - 1]} {jaar}
          </h2>
          <Link
            href={`/vaarplanning?jaar=${volgende.jaar}&maand=${volgende.maand}`}
            className="rounded-xl border border-rand-sterk px-3 py-2 text-sm"
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
                    {/* Op een telefoon is een cel te smal voor een naam: "R&I Zeilen"
                        wordt "R&I…". Daar staat een balkje in de kleur van het
                        huishouden; de lijst onder de kalender heeft de namen. */}
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {geboekt.map((reservering) => (
                        <span
                          key={reservering.id + dag.datum}
                          title={`${reservering.titel}${reservering.opmerking ? ` — ${reservering.opmerking}` : ""}`}
                          className="h-1.5 rounded text-[10px] text-white sm:h-auto sm:truncate sm:px-1"
                          style={{
                            background:
                              kleurVan.get(reservering.coupleId ?? -1) ??
                              "#3F6B54",
                          }}
                        >
                          <span className="hidden sm:inline">
                            {reservering.titel}
                          </span>
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
        className="grid gap-3 rounded-xl border border-rand bg-paneel p-4 sm:grid-cols-[1.2fr_1fr_1fr_1.5fr_auto]"
      >
        <input type="hidden" name="tochDoorgaan" value={tochDoorgaan} />
        <Veld label="Titel in de agenda">
          <input
            name="titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            required
            maxLength={120}
            className={invoer}
          />
        </Veld>
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
            className="rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen disabled:opacity-50"
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
            className={`text-sm sm:col-span-5 ${
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
                      kleurVan.get(reservering.coupleId ?? -1) ?? "#3F6B54",
                  }}
                />
                <div className="min-w-0 flex-1">
                  {/* Op een telefoon liever twee regels dan een afgekapte datum. */}
                  <p className="font-medium sm:truncate">{reservering.titel}</p>
                  <p className="text-sm text-gedempt sm:truncate">
                    {formatDatum(reservering.van)}
                    {reservering.tot !== reservering.van &&
                      ` tot en met ${formatDatum(reservering.tot)}`}
                    {reservering.opmerking && ` · ${reservering.opmerking}`}
                  </p>
                </div>
                {/* Weken van je eigen huishouden kun je hier aanpassen, of ze nu
                    zelf geboekt zijn of uit de seizoensplanning komen. De rest
                    beheer je in Google Agenda zelf. */}
                {reservering.coupleId === eigenCoupleId && (
                  <Bewerken reservering={reservering} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Een reservering krimpen of opdelen door dagen vrij te geven. Vink je alles aan,
 * dan gaat hij helemaal weg -- dat is dezelfde handeling, dus dezelfde knop, in
 * plaats van een aparte annuleerknop ernaast.
 */
function Bewerken({ reservering }: { reservering: Reservering }) {
  const [open, setOpen] = useState(false);
  const [state, vrijgeven, bezig] = useActionState<VrijgeefState, FormData>(
    geefDagenVrijAction,
    null,
  );
  const [gekozen, setGekozen] = useState<string[]>([]);
  const dagen = useMemo(
    () => dagenTussen(reservering.van, reservering.tot),
    [reservering.van, reservering.tot],
  );
  const alles = gekozen.length === dagen.length;

  // Gelukt? Dan is de lijst eronder al bijgewerkt en hoeft dit niet open te
  // blijven. Tijdens het renderen bijstellen in plaats van in een effect: dat
  // scheelt een tweede beeld waarin het blok nog even openstaat.
  const [verwerkt, setVerwerkt] = useState<VrijgeefState>(null);
  if (state?.gelukt && state !== verwerkt) {
    setVerwerkt(state);
    setOpen(false);
    setGekozen([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl border border-rand-sterk px-3 py-2 text-sm transition hover:border-inkt"
      >
        Aanpassen
      </button>
    );
  }

  return (
    <form action={vrijgeven} className="w-full">
      <input type="hidden" name="id" value={reservering.id} />

      <div className="mt-1 rounded-xl border border-rand bg-verzonken p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="bovenschrift">Welke dagen geef je vrij?</p>
          <button
            type="button"
            onClick={() => setGekozen(alles ? [] : dagen)}
            className="text-xs text-link underline"
          >
            {alles ? "geen enkele" : "alle dagen"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dagen.map((dag) => {
            const aan = gekozen.includes(dag);
            return (
              <label
                key={dag}
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  aan
                    ? "border-transparent bg-inkt font-semibold text-linnen"
                    : "border-rand-sterk bg-paneel hover:border-inkt"
                }`}
              >
                <input
                  type="checkbox"
                  name="dag"
                  value={dag}
                  checked={aan}
                  onChange={(e) =>
                    setGekozen((huidig) =>
                      e.target.checked
                        ? [...huidig, dag]
                        : huidig.filter((d) => d !== dag),
                    )
                  }
                  className="sr-only"
                />
                <span className="cijfers">{kortDag(dag)}</span>
              </label>
            );
          })}
        </div>

        {/* Een blok uit de seizoensplanning mag je hier bijschaven, maar het is
            goed om te weten dat opnieuw publiceren het terugzet zoals het was. */}
        {reservering.bron === "euphoria-seizoen" && (
          <p className="mt-2.5 text-xs text-messing-inkt text-pretty">
            Deze week komt uit de seizoensplanning. Publiceert de beheerder het
            seizoen opnieuw, dan staat hij er weer helemaal in.
          </p>
        )}

        {gekozen.length > 0 && (
          <p className="mt-2.5 text-xs text-gedempt text-pretty">
            {alles
              ? "Alles aangevinkt: de hele reservering verdwijnt."
              : `Er ${dagen.length - gekozen.length === 1 ? "blijft" : "blijven"} ${dagen.length - gekozen.length} ${dagen.length - gekozen.length === 1 ? "dag" : "dagen"} staan.`}
          </p>
        )}

        {state?.fout && (
          <p className="mt-2 text-sm text-slecht">{state.fout}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            disabled={bezig || gekozen.length === 0}
            className="rounded-xl bg-inkt px-3.5 py-2.5 text-sm font-semibold text-linnen disabled:opacity-40"
          >
            {bezig
              ? "Bezig…"
              : alles
                ? "Reservering weghalen"
                : "Dagen vrijgeven"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setGekozen([]);
            }}
            className="text-sm text-gedempt underline"
          >
            laat maar
          </button>
        </div>
      </div>
    </form>
  );
}

/** "wo 12" -- kort genoeg om er zeven naast elkaar te zetten op een telefoon. */
function kortDag(iso: string): string {
  const dag = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return `${DAGKOPPEN[(dag + 6) % 7]} ${Number(iso.slice(8))}`;
}

const invoer =
  "w-full rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm";

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
