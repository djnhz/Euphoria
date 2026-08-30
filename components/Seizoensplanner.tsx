"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Feestdag, FeestdagCode } from "@/lib/feestdagen";
import {
  formatDatum,
  formatDatumMetDag,
  dagnaam,
  isoWeek,
  maandagVanWeek,
} from "@/lib/datum";
import {
  dagenVanFeestdag,
  maakSeizoensplanning,
  telling,
  type Blok,
} from "@/lib/seizoen";
import {
  publiceerAction,
  standAction,
  type PubliceerState,
  type StandState,
} from "@/app/(app)/vaarplanning/seizoen/actions";

const KLEUREN = ["#0ea5e9", "#f97316"];

const REDEN_TEKST: Record<Blok["reden"], string> = {
  oneven: "oneven week",
  even: "even week",
  feestdag: "feestdag",
  handmatig: "handmatig gezet",
};

export default function Seizoensplanner({
  jaar,
  huishoudens,
  feestdagen,
  kanPubliceren,
}: {
  jaar: number;
  huishoudens: { id: number; naam: string }[];
  feestdagen: Feestdag[];
  kanPubliceren: boolean;
}) {
  const router = useRouter();
  const [onevenCoupleId, setOneven] = useState(huishoudens[0]?.id ?? 0);
  const [toewijzing, setToewijzing] = useState<
    Partial<Record<FeestdagCode, number>>
  >({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const [publiceerState, publiceer, bezig] = useActionState<
    PubliceerState,
    FormData
  >(publiceerAction, null);
  const [standState, kijkStand, kijkt] = useActionState<StandState, FormData>(
    standAction,
    null,
  );

  const evenCoupleId =
    huishoudens.find((h) => h.id !== onevenCoupleId)?.id ?? onevenCoupleId;

  const kleurVan = useMemo(() => {
    const perId = new Map<number, string>();
    huishoudens.forEach((h, i) => perId.set(h.id, KLEUREN[i] ?? "#8b5cf6"));
    return perId;
  }, [huishoudens]);
  const naamVan = useMemo(
    () => new Map(huishoudens.map((h) => [h.id, h.naam])),
    [huishoudens],
  );

  const invoer = {
    jaar,
    onevenCoupleId,
    evenCoupleId,
    feestdagToewijzing: toewijzing,
    overrides,
  };
  const planning = useMemo(
    () => maakSeizoensplanning(invoer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jaar, onevenCoupleId, evenCoupleId, toewijzing, overrides],
  );
  const cijfers = telling(
    planning,
    huishoudens.map((h) => h.id),
  );
  const verschil =
    cijfers.length === 2 ? Math.abs(cijfers[0].dagen - cijfers[1].dagen) : 0;

  /**
   * Van wie de betrokken weken zouden zijn zonder deze feestdag. Handig om te zien
   * wat je precies weggeeft als je hem toewijst.
   */
  function basisEigenaars(feestdag: Feestdag) {
    const weken: { week: number; coupleId: number }[] = [];
    for (const dag of dagenVanFeestdag(feestdag.van, feestdag.tot)) {
      const week = isoWeek(dag);
      if (weken.some((w) => w.week === week)) continue;
      weken.push({
        week,
        coupleId: week % 2 === 1 ? onevenCoupleId : evenCoupleId,
      });
    }
    return weken;
  }

  /** Een blok omzetten naar het andere huishouden, per betrokken week. */
  function wisselBlok(blok: Blok) {
    const ander = huishoudens.find((h) => h.id !== blok.coupleId)?.id;
    if (ander === undefined) return;
    setOverrides((huidig) => {
      const nieuw = { ...huidig };
      let dag = blok.van;
      while (dag <= blok.tot) {
        nieuw[maandagVanWeek(dag)] = ander;
        // Naar de volgende maandag.
        const maandag = maandagVanWeek(dag);
        const volgende = new Date(`${maandag}T00:00:00Z`);
        volgende.setUTCDate(volgende.getUTCDate() + 7);
        dag = volgende.toISOString().slice(0, 10);
      }
      return nieuw;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 rounded-xl border border-rand bg-paneel p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Seizoen</span>
          <select
            value={jaar}
            onChange={(e) => router.push(`/vaarplanning/seizoen?jaar=${e.target.value}`)}
            className={invoerKlasse}
          >
            {[jaar - 1, jaar, jaar + 1, jaar + 2].map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Oneven weken voor</span>
          <select
            value={onevenCoupleId}
            onChange={(e) => setOneven(Number(e.target.value))}
            className={invoerKlasse}
          >
            {huishoudens.map((h) => (
              <option key={h.id} value={h.id}>
                {h.naam}
              </option>
            ))}
          </select>
          <span className="text-xs text-gedempt">
            De even weken gaan dan naar {naamVan.get(evenCoupleId)}.
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="text-sm font-medium">Lange weekenden</h2>
        <p className="mb-3 text-xs text-gedempt">
          Wie een feestdag krijgt, krijgt die hele week plus de maandag erna als het
          lange weekend daarin doorloopt. De rest van die volgende week volgt weer de
          even-onevenregel.
        </p>
        <ul className="flex flex-col gap-2">
          {feestdagen.map((feestdag) => (
            <li
              key={feestdag.code}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-rand p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{feestdag.naam}</p>
                <p className="text-sm text-gedempt">
                  {formatDatumMetDag(feestdag.van)}
                  {feestdag.tot !== feestdag.van &&
                    ` tot en met ${formatDatumMetDag(feestdag.tot)}`}
                </p>
                <p className="text-xs text-gedempt">
                  {basisEigenaars(feestdag)
                    .map(
                      (week) =>
                        `week ${week.week} is normaal van ${naamVan.get(week.coupleId)}`,
                    )
                    .join(" · ")}
                </p>
              </div>
              <select
                value={toewijzing[feestdag.code] ?? ""}
                onChange={(e) =>
                  setToewijzing((huidig) => {
                    const nieuw = { ...huidig };
                    if (e.target.value === "") delete nieuw[feestdag.code];
                    else nieuw[feestdag.code] = Number(e.target.value);
                    return nieuw;
                  })
                }
                aria-label={`Toewijzing ${feestdag.naam}`}
                className={invoerKlasse}
              >
                <option value="">volgens even-onevenregel</option>
                {huishoudens.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.naam}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        {planning.botsingen.length > 0 && (
          <p className="mt-3 rounded-lg bg-accent-zacht p-3 text-sm">
            {planning.botsingen.map((botsing) => (
              <span key={botsing.verliezer} className="block">
                {botsing.winnaar} overlapt met {botsing.verliezer} op{" "}
                {botsing.dagen.length} dag
                {botsing.dagen.length === 1 ? "" : "en"}; {botsing.winnaar} wint daar.
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-3 text-sm font-medium">Verdeling</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cijfers.map((rij) => (
            <div
              key={rij.coupleId}
              className="rounded-lg border border-rand p-3"
              style={{ borderLeft: `4px solid ${kleurVan.get(rij.coupleId)}` }}
            >
              <p className="font-medium">{naamVan.get(rij.coupleId)}</p>
              <p className="cijfers text-sm text-gedempt">
                {rij.blokken} keer aan de beurt · {rij.dagen} dagen
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gedempt">
          {verschil === 0
            ? "Precies gelijk verdeeld."
            : `Verschil: ${verschil} dag${verschil === 1 ? "" : "en"}.`}
        </p>
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-3 text-sm font-medium">
          Concept — {planning.blokken.length} blokken
        </h2>
        <ul className="flex flex-col gap-1">
          {planning.blokken.map((blok) => (
            <li
              key={blok.van}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-rand p-2 text-sm"
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded"
                style={{ background: kleurVan.get(blok.coupleId) }}
              />
              {/* De weekdag alleen tonen bij blokken die geen hele maandag-zondagweek
                  zijn; daar zit het lange weekend en dat is wat je wilt zien. */}
              <span className="cijfers min-w-0 flex-1 truncate">
                {heelWeek(blok) ? "" : `${dagnaam(blok.van)} `}
                {formatDatum(blok.van)}
                {blok.tot !== blok.van &&
                  ` t/m ${heelWeek(blok) ? "" : `${dagnaam(blok.tot)} `}${formatDatum(blok.tot)}`}
              </span>
              <span className="truncate">{naamVan.get(blok.coupleId)}</span>
              <span className="text-xs text-gedempt">
                {REDEN_TEKST[blok.reden]} · {blok.aantalDagen} dg
              </span>
              <button
                type="button"
                onClick={() => wisselBlok(blok)}
                className="text-xs text-accent underline"
              >
                omzetten
              </button>
            </li>
          ))}
        </ul>
        {Object.keys(overrides).length > 0 && (
          <button
            type="button"
            onClick={() => setOverrides({})}
            className="mt-3 text-sm text-gedempt underline"
          >
            handmatige wissels ongedaan maken
          </button>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-rand bg-paneel p-4">
        <h2 className="text-sm font-medium">Publiceren</h2>
        <p className="text-xs text-gedempt">
          Een eerdere seizoensplanning van {jaar} wordt vervangen. Reserveringen die
          iemand zelf maakte blijven staan.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form action={kijkStand}>
            <input type="hidden" name="jaar" value={jaar} />
            <button
              disabled={kijkt || !kanPubliceren}
              className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
            >
              {kijkt ? "Kijken…" : "Wat staat er nu?"}
            </button>
          </form>
          <form action={publiceer}>
            <input type="hidden" name="payload" value={JSON.stringify(invoer)} />
            <button
              disabled={bezig || !kanPubliceren}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {bezig ? "Publiceren…" : `Publiceer ${planning.blokken.length} blokken`}
            </button>
          </form>
        </div>
        {standState && <p className="text-sm text-gedempt">{standState.melding}</p>}
        {publiceerState && (
          <p
            className={`text-sm ${
              publiceerState.soort === "fout" ? "text-slecht" : "text-goed"
            }`}
          >
            {publiceerState.melding}
          </p>
        )}
      </section>
    </div>
  );
}

const invoerKlasse =
  "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

/** Een blok van maandag tot en met zondag; dan zeggen de weekdagen niets extras. */
function heelWeek(blok: Blok): boolean {
  return (
    blok.aantalDagen === 7 &&
    dagnaam(blok.van) === "maandag" &&
    dagnaam(blok.tot) === "zondag"
  );
}
