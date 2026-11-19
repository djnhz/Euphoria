"use client";

import { HUISHOUDKLEUREN } from "@/lib/kleuren";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  feestdagenRakend,
  type Feestdag,
  type FeestdagCode,
} from "@/lib/feestdagen";
import type { SeizoenPlan, VakantiePeriode } from "@/lib/seizoenplan";
import {
  vakantiesRakend,
  werkdagen,
  werkdagOverlap,
  type Vakantie,
} from "@/lib/schoolvakanties";
import {
  dagenInSeizoen,
  seizoenFout,
  standaardSeizoen,
  formatDatum,
  MAANDEN,
  formatDatumMetDag,
  dagnaam,
  isoWeek,
  maandagVanWeek,
  plusDagen,
} from "@/lib/datum";
import {
  dagenVanFeestdag,
  maakSeizoensplanning,
  telling,
  type Blok,
} from "@/lib/seizoen";
import {
  bewaarPlanAction,
  publiceerAction,
  standAction,
  type PubliceerState,
  type StandState,
} from "@/app/(app)/vaarplanning/seizoen/actions";
import Keuzelijst from "./Keuzelijst";

const KLEUREN = HUISHOUDKLEUREN;

const REDEN_TEKST: Record<Blok["reden"], string> = {
  oneven: "oneven week",
  even: "even week",
  feestdag: "feestdag",
  handmatig: "vakantie",
};

export default function Seizoensplanner({
  jaar,
  huishoudens,
  feestdagen,
  vakanties,
  vakantieHerkomst,
  plan,
  kanPubliceren,
}: {
  jaar: number;
  huishoudens: { id: number; naam: string }[];
  feestdagen: Feestdag[];
  vakanties: Vakantie[];
  vakantieHerkomst: "rijksoverheid" | "reserve" | "geen";
  /** Wat er van dit jaar bewaard is; null als je voor het eerst begint. */
  plan: SeizoenPlan | null;
  kanPubliceren: boolean;
}) {
  const router = useRouter();
  const [onevenCoupleId, setOneven] = useState(
    plan?.onevenCoupleId ?? huishoudens[0]?.id ?? 0,
  );
  const [toewijzing, setToewijzing] = useState<
    Partial<Record<FeestdagCode, number>>
  >((plan?.feestdagen ?? {}) as Partial<Record<FeestdagCode, number>>);
  const [periodes, setPeriodes] = useState<Periode[]>(plan?.periodes ?? []);
  // Begin en einde van het seizoen. Zolang ze niet kloppen (einde voor begin, of geen
  // hele week ertussen) rekent het scherm verder met het laatste goede seizoen en
  // wordt er niets bewaard of gepubliceerd.
  const standaard = standaardSeizoen(jaar);
  const [start, setStart] = useState(plan?.start ?? standaard.start);
  const [eind, setEind] = useState(plan?.eind ?? standaard.eind);
  const grensFout = seizoenFout(jaar, { start, eind });
  const [laatstGoed, setLaatstGoed] = useState({ start, eind });
  if (!grensFout && (laatstGoed.start !== start || laatstGoed.eind !== eind)) {
    setLaatstGoed({ start, eind });
  }
  const grenzen = grensFout ? laatstGoed : { start, eind };
  /** De periode die je op dit moment aan het aanpassen bent, of null. */
  const [bewerkt, setBewerkt] = useState<Periode | null>(null);

  const [publiceerState, publiceer, bezig] = useActionState<
    PubliceerState,
    FormData
  >(publiceerAction, null);
  const [standState, kijkStand, kijkt] = useActionState<StandState, FormData>(
    standAction,
    null,
  );

  /**
   * Wat je instelt wordt vanzelf bewaard, kort nadat je stopt met schuiven. Zonder dat
   * ben je je toewijzingen kwijt zodra je ververst of van jaar wisselt -- dat laatste
   * laadt de pagina namelijk opnieuw.
   */
  const [bewaarStand, setBewaarStand] = useState<"stil" | "bezig" | "klaar">(
    "stil",
  );
  const teBewaren = JSON.stringify({
    onevenCoupleId,
    feestdagen: toewijzing,
    periodes,
    start: grenzen.start,
    eind: grenzen.eind,
  });
  const [laatstBewaard, setLaatstBewaard] = useState(teBewaren);

  useEffect(() => {
    if (teBewaren === laatstBewaard) return;
    const timer = setTimeout(async () => {
      setBewaarStand("bezig");
      await bewaarPlanAction(jaar, JSON.parse(teBewaren));
      setLaatstBewaard(teBewaren);
      setBewaarStand("klaar");
    }, 700);
    return () => clearTimeout(timer);
  }, [teBewaren, laatstBewaard, jaar]);

  const evenCoupleId =
    huishoudens.find((h) => h.id !== onevenCoupleId)?.id ?? onevenCoupleId;

  const kleurVan = useMemo(() => {
    const perId = new Map<number, string>();
    huishoudens.forEach((h, i) => perId.set(h.id, KLEUREN[i] ?? "#3F6B54"));
    return perId;
  }, [huishoudens]);
  const naamVan = useMemo(
    () => new Map(huishoudens.map((h) => [h.id, h.naam])),
    [huishoudens],
  );

  // De weken van het seizoen, als bouwstenen voor de vakantiekiezer.
  const weken = useMemo(() => {
    const lijst: { maandag: string; week: number; zondag: string }[] = [];
    for (const dag of dagenInSeizoen(jaar, grenzen)) {
      const maandag = maandagVanWeek(dag);
      if (lijst.at(-1)?.maandag === maandag) continue;
      lijst.push({
        maandag,
        week: isoWeek(maandag),
        zondag: plusDagen(maandag, 6),
      });
    }
    return lijst;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaar, grenzen.start, grenzen.eind]);

  const invoer = {
    jaar,
    onevenCoupleId,
    evenCoupleId,
    feestdagToewijzing: toewijzing,
    vakanties: periodes.map(({ van, tot, coupleId, naam }) => ({
      van,
      tot,
      coupleId,
      naam,
    })),
    grenzen,
  };
  const planning = useMemo(
    () => maakSeizoensplanning(invoer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jaar, onevenCoupleId, evenCoupleId, toewijzing, periodes, grenzen.start, grenzen.eind],
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

  /** Een blok omzetten is gewoon een vakantie voor de ander over precies die dagen. */
  function wisselBlok(blok: Blok) {
    const ander = huishoudens.find((h) => h.id !== blok.coupleId)?.id;
    if (ander === undefined) return;
    voegPeriodeToe({
      van: blok.van,
      tot: plusDagen(blok.tot, 1),
      coupleId: ander,
      naam: "",
    });
  }

  /**
   * Een nieuwe vakantie vervangt wat er op die nachten al was ingepland. Aansluiten
   * mag: eindigt de een op zaterdag, dan kan de ander op die zaterdag beginnen. Bewerk
   * je er een, dan gaat het oude exemplaar er sowieso uit -- ook als je hem naar heel
   * andere datums verschuift.
   */
  function voegPeriodeToe(nieuw: Omit<Periode, "id">, vervangtId?: string) {
    setPeriodes((huidig) => [
      ...huidig.filter(
        (p) => p.id !== vervangtId && (p.tot <= nieuw.van || p.van >= nieuw.tot),
      ),
      { ...nieuw, id: `${nieuw.van}-${nieuw.tot}-${nieuw.coupleId}` },
    ]);
    setBewerkt(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 rounded-2xl border border-rand bg-paneel p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Seizoen</span>
          <Keuzelijst
            label="Seizoen"
            waarde={jaar}
            opties={[jaar - 1, jaar, jaar + 1, jaar + 2].map((j) => ({
              waarde: j,
              label: String(j),
            }))}
            onKies={(j) => router.push(`/vaarplanning/seizoen?jaar=${j}`)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Oneven weken voor</span>
          <Keuzelijst
            label="Oneven weken voor"
            waarde={onevenCoupleId}
            opties={huishoudens.map((h) => ({ waarde: h.id, label: h.naam }))}
            onKies={setOneven}
          />
          <span className="text-xs text-gedempt">
            De even weken gaan dan naar {naamVan.get(evenCoupleId)}.
          </span>
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gedempt">Seizoen begint</span>
              <input
                type="date"
                value={start}
                min={`${jaar}-01-01`}
                max={`${jaar}-12-31`}
                onChange={(e) => setStart(e.target.value)}
                className={invoerKlasse}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gedempt">Seizoen eindigt</span>
              <input
                type="date"
                value={eind}
                min={`${jaar}-01-01`}
                max={`${jaar}-12-31`}
                onChange={(e) => setEind(e.target.value)}
                className={invoerKlasse}
              />
            </label>
          </div>
          {grensFout ? (
            <p className="text-xs text-slecht">{grensFout}</p>
          ) : (
            <p className="text-xs text-gedempt text-pretty">
              In hele weken: van {formatDatumMetDag(weken[0]?.maandag ?? start)}{" "}
              tot en met {formatDatumMetDag(weken.at(-1)?.zondag ?? eind)} ·{" "}
              {weken.length} weken
              {(start !== standaard.start || eind !== standaard.eind) && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setStart(standaard.start);
                      setEind(standaard.eind);
                    }}
                    className="text-link underline"
                  >
                    terug naar maart t/m oktober
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        {/* Wat je instelt blijft staan; dit zegt alleen wanneer dat gebeurd is. */}
        <p className="text-xs text-gedempt sm:col-span-2" aria-live="polite">
          {bewaarStand === "bezig"
            ? "Opslaan…"
            : bewaarStand === "klaar"
              ? "Opgeslagen. Dit concept staat er de volgende keer weer."
              : "Wat je hier instelt wordt vanzelf bewaard."}
        </p>
      </section>

      <section className="rounded-2xl border border-rand bg-paneel p-4">
        <h2 className="bovenschrift">Lange weekenden</h2>
        <p className="mb-3 text-xs text-gedempt">
          Je krijgt de hele week plus de maandag erna; de rest van die week
          volgt weer het even-onevenpatroon.
        </p>
        <ul className="flex flex-col gap-2">
          {feestdagen.map((feestdag) => (
            <li
              key={feestdag.code}
              // Op een telefoon onder elkaar: naast elkaar houdt de keuzelijst zijn
              // breedte en wordt de tekst ernaast tot een woord per regel geperst.
              className="flex flex-col gap-2 rounded-xl border border-rand bg-verzonken p-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 sm:flex-1">
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
              <Keuzelijst
                label={`Toewijzing ${feestdag.naam}`}
                waarde={String(toewijzing[feestdag.code] ?? "")}
                className="sm:w-56"
                opties={[
                  { waarde: "", label: "Volgens even-onevenregel" },
                  ...huishoudens.map((h) => ({
                    waarde: String(h.id),
                    label: h.naam,
                  })),
                ]}
                onKies={(keuze) =>
                  setToewijzing((huidig) => {
                    const nieuw = { ...huidig };
                    if (keuze === "") delete nieuw[feestdag.code];
                    else nieuw[feestdag.code] = Number(keuze);
                    return nieuw;
                  })
                }
              />
            </li>
          ))}
        </ul>

        {planning.botsingen.length > 0 && (
          <p className="mt-3 rounded-xl bg-marine-tint p-3 text-sm">
            {planning.botsingen.map((botsing) => (
              <span key={botsing.verliezer} className="block">
                {botsing.winnaar} overlapt met {botsing.verliezer} op{" "}
                {botsing.dagen.length} dag
                {botsing.dagen.length === 1 ? "" : "en"}; {botsing.winnaar} wint
                daar.
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-rand bg-paneel p-4">
        <h2 className="bovenschrift">Vakanties inplannen</h2>
        <p className="mb-3 text-xs text-gedempt text-pretty">
          Een vakantie loopt van zaterdag 12:00 tot zaterdag 12:00, dwars door het
          patroon heen. Op de wisseldag kan de ander vanaf 12:00 weer aan boord, ook
          voor een eigen vakantie. Een nieuwe vakantie vervangt een bestaande waar
          ze elkaar overlappen.
        </p>
        {/* Sleutel op de bewerkte periode: zo begint het formulier opnieuw met de
            waarden van die periode in plaats van te blijven staan waar het stond. */}
        <VakantieFormulier
          key={bewerkt?.id ?? "nieuw"}
          eersteDag={weken[0]?.maandag ?? grenzen.start}
          laatsteWisseldag={plusDagen(weken.at(-1)?.zondag ?? grenzen.eind, 1)}
          huishoudens={huishoudens}
          vakanties={vakanties}
          bewerkt={bewerkt}
          onToevoegen={voegPeriodeToe}
          onAnnuleren={() => setBewerkt(null)}
        />

        {periodes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...periodes]
              .sort((a, b) => a.van.localeCompare(b.van))
              .map((periode) => {
                const nachten = dagenTussen(periode.van, periode.tot);
                return (
                  <li
                    key={periode.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-rand bg-verzonken p-2 text-sm"
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded"
                      style={{ background: kleurVan.get(periode.coupleId) }}
                    />
                    <span className="cijfers min-w-0 flex-1">
                      {wisselmoment(periode.van)} – {wisselmoment(periode.tot)}
                    </span>
                    <span className="cijfers text-xs text-gedempt">
                      {nachten} {nachten === 1 ? "nacht" : "nachten"}
                    </span>
                    <span className="truncate">
                      {naamVan.get(periode.coupleId)}
                      {periode.naam && ` — ${periode.naam}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBewerkt(periode)}
                      className="text-xs text-link underline"
                    >
                      wijzigen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodes((huidig) =>
                          huidig.filter((p) => p.id !== periode.id),
                        );
                        if (bewerkt?.id === periode.id) setBewerkt(null);
                      }}
                      className="text-xs text-slecht underline"
                    >
                      verwijderen
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-rand bg-paneel p-4">
        <h2 className="bovenschrift mb-3">Verdeling</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cijfers.map((rij) => (
            <div
              key={rij.coupleId}
              className="rounded-xl border border-rand bg-verzonken p-3"
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

      <section className="rounded-2xl border border-rand bg-paneel p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="bovenschrift">
            Concept — {planning.blokken.length} blokken
          </h2>
          <p className="text-xs text-gedempt">
            {vakantieHerkomst === "rijksoverheid"
              ? "Vakantieweken (regio midden) opgehaald bij de rijksoverheid."
              : vakantieHerkomst === "reserve"
                ? "Vakantieweken uit de ingebouwde tabel; ophalen bij de rijksoverheid lukte niet."
                : "Geen vakantiegegevens bekend voor dit jaar."}
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {planning.blokken.map((blok) => {
            // Werkdagen zijn leidend: de herfstvakantie begint op zaterdag, dus de
            // week ervoor heeft wel twee vakantiedagen maar geen vrije werkdag. Die
            // week is geen vakantieweek.
            const werkdagenInBlok = werkdagen(blok.van, blok.tot);
            const raakt = vakantiesRakend(vakanties, blok.van, blok.tot)
              .map((vakantie) => ({
                ...vakantie,
                dagen: werkdagOverlap(vakantie, blok.van, blok.tot),
              }))
              .filter((vakantie) => vakantie.dagen > 0);
            const heel = raakt.filter(
              (v) => werkdagenInBlok > 0 && v.dagen === werkdagenInBlok,
            );
            const bouwvak = heel.some((v) => v.soort === "bouwvak");
            const grotendeels = heel.length > 0;
            const ingepland = blok.reden === "handmatig";
            // Ook een week die niet aan een feestdag is toegewezen kan er een
            // bevatten -- Koningsdag valt zo midden in een gewone week.
            const raaktFeestdagen = feestdagenRakend(
              feestdagen,
              blok.van,
              blok.tot,
            );
            return (
              <li
                key={blok.van}
                // Twee losse signalen: de tint zegt dat er schoolvakantie of bouwvak is,
                // de streep aan de voorkant dat jij die week zelf hebt ingepland.
                style={{
                  background: bouwvak
                    ? "var(--vakantie-sterk)"
                    : grotendeels
                      ? "var(--vakantie-zacht)"
                      : undefined,
                  borderLeft: ingepland
                    ? `6px solid ${kleurVan.get(blok.coupleId)}`
                    : undefined,
                }}
                // Op een telefoon onder elkaar: datum met weeknummer, dan de labels,
                // dan wie er vaart. Naast elkaar wordt elke regel anders afgekapt.
                className="flex flex-col gap-1 rounded-xl border border-rand bg-verzonken p-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded"
                    style={{ background: kleurVan.get(blok.coupleId) }}
                  />
                  {/* De weekdag alleen tonen bij blokken die geen hele maandag-zondagweek
                    zijn; daar zit het lange weekend en dat is wat je wilt zien. */}
                  <span className="cijfers min-w-0 flex-1">
                    {/* Een vakantie met zijn wisselmomenten; het eind is de dag na de
                        laatste nacht. Bij de rest de dagen tot en met. */}
                    {ingepland ? (
                      `${wisselmoment(blok.van)} – ${wisselmoment(plusDagen(blok.tot, 1))}`
                    ) : (
                      <>
                        {heelWeek(blok) ? "" : `${dagnaam(blok.van)} `}
                        {formatDatum(blok.van)}
                        {blok.tot !== blok.van &&
                          ` t/m ${heelWeek(blok) ? "" : `${dagnaam(blok.tot)} `}${formatDatum(blok.tot)}`}
                      </>
                    )}
                  </span>
                  <span className="cijfers shrink-0 text-xs text-gedempt">
                    {weekLabel(blok)}
                  </span>
                </span>
                {raaktFeestdagen.length > 0 && (
                  <span className="flex flex-wrap gap-1 sm:shrink-0">
                    {raaktFeestdagen.map((feestdag) => (
                      <span
                        key={feestdag.code}
                        title={`${formatDatumMetDag(feestdag.van)}${
                          feestdag.tot === feestdag.van
                            ? ""
                            : ` tot en met ${formatDatumMetDag(feestdag.tot)}`
                        }`}
                        className="rounded-md bg-messing-tint px-2 py-1 text-[10.5px] font-semibold text-messing-inkt"
                      >
                        {feestdag.naam}
                      </span>
                    ))}
                  </span>
                )}
                {raakt.length > 0 && (
                  <span className="flex flex-wrap gap-1 sm:shrink-0">
                    {raakt.map((vakantie) => (
                      <span
                        key={vakantie.naam}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          vakantie.soort === "bouwvak" &&
                          vakantie.dagen === werkdagenInBlok
                            ? "font-medium"
                            : "text-gedempt"
                        }`}
                        style={{
                          background:
                            vakantie.soort === "bouwvak" &&
                            vakantie.dagen === werkdagenInBlok
                              ? "var(--vakantie-rand)"
                              : "var(--vakantie-zacht)",
                          color:
                            vakantie.soort === "bouwvak" &&
                            vakantie.dagen === werkdagenInBlok
                              ? "var(--paneel)"
                              : undefined,
                        }}
                      >
                        {vakantie.naam}
                        {/* Raakt de vakantie maar een deel van het blok, zeg dan hoeveel
                          dagen. Anders lijkt het weekend voor de herfstvakantie een
                          volle vakantieweek. */}
                        {vakantie.dagen < werkdagenInBlok &&
                          ` ${vakantie.dagen} van ${werkdagenInBlok} werkdagen`}
                      </span>
                    ))}
                  </span>
                )}
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:contents">
                  <span className="sm:truncate">
                    {naamVan.get(blok.coupleId)}
                    {blok.naam && blok.reden === "handmatig" && (
                      <span className="text-gedempt"> — {blok.naam}</span>
                    )}
                  </span>
                  <span className="text-xs text-gedempt">
                    {REDEN_TEKST[blok.reden]} ·{" "}
                    {ingepland
                      ? `${blok.aantalDagen} ${blok.aantalDagen === 1 ? "nacht" : "nachten"}`
                      : `${blok.aantalDagen} dg`}
                  </span>
                  <button
                    type="button"
                    onClick={() => wisselBlok(blok)}
                    className="text-xs text-link underline"
                  >
                    omzetten
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rand bg-paneel p-4">
        <h2 className="bovenschrift">Publiceren</h2>
        <p className="text-xs text-gedempt">
          Een eerdere seizoensplanning van {jaar} wordt vervangen. Reserveringen
          die iemand zelf maakte blijven staan.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form action={kijkStand}>
            <input type="hidden" name="jaar" value={jaar} />
            <input type="hidden" name="start" value={grenzen.start} />
            <input type="hidden" name="eind" value={grenzen.eind} />
            <button
              disabled={kijkt || !kanPubliceren || grensFout !== null}
              className="rounded-xl border border-rand-sterk px-3 py-2.5 text-sm disabled:opacity-50"
            >
              {kijkt ? "Kijken…" : "Wat staat er nu?"}
            </button>
          </form>
          <form action={publiceer}>
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify(invoer)}
            />
            <button
              disabled={bezig || !kanPubliceren || grensFout !== null}
              className="rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen disabled:opacity-50"
            >
              {bezig
                ? "Publiceren…"
                : `Publiceer ${planning.blokken.length} blokken`}
            </button>
          </form>
        </div>
        {standState && (
          <p className="text-sm text-gedempt">{standState.melding}</p>
        )}
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
  "rounded-xl border border-rand-sterk bg-paneel px-3 py-2.5 text-sm";

/** "wk 12" of "wk 12-13" voor blokken die over een weekgrens lopen. */
function weekLabel(blok: Blok): string {
  const eerste = isoWeek(blok.van);
  const laatste = isoWeek(blok.tot);
  return eerste === laatste ? `wk ${eerste}` : `wk ${eerste}-${laatste}`;
}

/**
 * Een blok van hele weken, maandag tot en met zondag. Dan zeggen de weekdagen niets
 * extras; ze zijn juist interessant bij een blok dat een week doormidden snijdt.
 */
function heelWeek(blok: Blok): boolean {
  return (
    blok.aantalDagen % 7 === 0 &&
    dagnaam(blok.van) === "maandag" &&
    dagnaam(blok.tot) === "zondag"
  );
}

export type Periode = VakantiePeriode;

/** Hoe laat er gewisseld wordt; de afspraak tussen de huishoudens. */
const WISSELTIJD = "12:00";

/** "za 11 jul 12:00": het moment waarop een vakantie begint of overgaat. */
function wisselmoment(iso: string): string {
  return `${dagnaam(iso).slice(0, 2)} ${Number(iso.slice(8))} ${MAANDEN[Number(iso.slice(5, 7)) - 1]} ${WISSELTIJD}`;
}

function dagenTussen(van: string, tot: string): number {
  return Math.round(
    (Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) /
      86_400_000,
  );
}

/** De eerste zaterdag op of na deze dag. */
function zaterdagVanaf(iso: string): string {
  let dag = iso;
  while (dagnaam(dag) !== "zaterdag") dag = plusDagen(dag, 1);
  return dag;
}

/**
 * Een vakantie kiezen met exacte datums: de dag waarop je aan boord komt en de
 * wisseldag waarop je om 12:00 weer van boord gaat. Standaard zaterdag tot zaterdag,
 * want dat is de afspraak; een andere dag mag, maar dan zegt het formulier het.
 */
function VakantieFormulier({
  eersteDag,
  laatsteWisseldag,
  huishoudens,
  vakanties,
  bewerkt,
  onToevoegen,
  onAnnuleren,
}: {
  /** Eerste dag van het seizoen. */
  eersteDag: string;
  /** De dag na de laatste seizoensdag: later van boord gaan kan niet. */
  laatsteWisseldag: string;
  huishoudens: { id: number; naam: string }[];
  vakanties: Vakantie[];
  /** Gevuld als je een bestaande vakantie aanpast in plaats van een nieuwe maakt. */
  bewerkt: Periode | null;
  onToevoegen: (periode: Omit<Periode, "id">, vervangtId?: string) => void;
  onAnnuleren: () => void;
}) {
  const eersteZaterdag = zaterdagVanaf(eersteDag);
  const [van, setVan] = useState(bewerkt?.van ?? eersteZaterdag);
  const [tot, setTot] = useState(bewerkt?.tot ?? plusDagen(eersteZaterdag, 7));
  const [coupleId, setCouple] = useState(
    bewerkt?.coupleId ?? huishoudens[0]?.id ?? 0,
  );
  const [naam, setNaam] = useState(bewerkt?.naam ?? "");
  const vuil =
    bewerkt !== null &&
    (van !== bewerkt.van ||
      tot !== bewerkt.tot ||
      coupleId !== bewerkt.coupleId ||
      naam !== (bewerkt.naam ?? ""));

  const geldig = /^\d{4}-\d{2}-\d{2}$/;
  const fout = !geldig.test(van) || !geldig.test(tot)
    ? "Vul beide datums in."
    : tot <= van
      ? "De wisseldag moet na de eerste dag liggen."
      : van < eersteDag || tot > laatsteWisseldag
        ? `Kies datums binnen het seizoen (${formatDatum(eersteDag)} tot ${formatDatum(laatsteWisseldag)}).`
        : null;
  const nachten = fout ? 0 : dagenTussen(van, tot);
  const geenZaterdag = [van, tot].filter(
    (dag) => geldig.test(dag) && dagnaam(dag) !== "zaterdag",
  );
  // Welke schoolvakantie of bouwvak er in valt: dat is meestal waarom je hem boekt.
  const raakt = fout
    ? []
    : vakantiesRakend(vakanties, van, plusDagen(tot, -1)).filter(
        (vakantie) => werkdagOverlap(vakantie, van, plusDagen(tot, -1)) > 0,
      );

  /** Begin verschuiven en de lengte behouden, zodat je niet twee velden hoeft te zetten. */
  function kiesVan(nieuw: string) {
    const lengte = !fout ? nachten : 7;
    setVan(nieuw);
    if (geldig.test(nieuw)) setTot(plusDagen(nieuw, Math.max(1, lengte)));
  }

  return (
    // min-w-0 op elk vak: zonder dat rekt een veld op tot zijn inhoud en loopt de
    // rij buiten het paneel.
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-gedempt">Aan boord vanaf ({WISSELTIJD})</span>
        <input
          type="date"
          value={van}
          min={eersteDag}
          max={plusDagen(laatsteWisseldag, -1)}
          onChange={(e) => kiesVan(e.target.value)}
          className={`${invoerKlasse} min-w-0`}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-gedempt">Van boord op ({WISSELTIJD})</span>
        <input
          type="date"
          value={tot}
          min={geldig.test(van) ? plusDagen(van, 1) : eersteDag}
          max={laatsteWisseldag}
          onChange={(e) => setTot(e.target.value)}
          className={`${invoerKlasse} min-w-0`}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-gedempt">Voor</span>
        <Keuzelijst
          label="Voor"
          waarde={coupleId}
          opties={huishoudens.map((h) => ({ waarde: h.id, label: h.naam }))}
          onKies={setCouple}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-gedempt">Naam (optioneel)</span>
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Zomervakantie"
          maxLength={80}
          className={invoerKlasse}
        />
      </label>

      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
        {/* Snel een hele week of meer: de lengte telt vanaf de gekozen begindag. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gedempt">Duur:</span>
          {[1, 2, 3].map((weken) => {
            const aan = !fout && nachten === weken * 7;
            return (
              <button
                key={weken}
                type="button"
                disabled={!geldig.test(van)}
                onClick={() => setTot(plusDagen(van, weken * 7))}
                className={`min-h-9 rounded-lg border px-2.5 text-xs transition ${
                  aan
                    ? "border-inkt bg-inkt text-linnen"
                    : "border-rand-sterk text-inkt hover:border-inkt"
                }`}
              >
                {weken} {weken === 1 ? "week" : "weken"}
              </button>
            );
          })}
        </div>
        {fout ? (
          <p className="text-xs text-slecht">{fout}</p>
        ) : (
          <p className="text-xs text-gedempt text-pretty">
            <span className="cijfers">
              {wisselmoment(van)} – {wisselmoment(tot)}
            </span>{" "}
            · {nachten} {nachten === 1 ? "nacht" : "nachten"}
            {raakt.length > 0 && ` · ${raakt.map((v) => v.naam).join(", ")}`}
          </p>
        )}
        {!fout && geenZaterdag.length > 0 && (
          <p className="text-xs text-messing-inkt text-pretty">
            Let op: de afspraak is wisselen op zaterdag.{" "}
            {geenZaterdag.length === 2
              ? "Beide datums vallen"
              : `${dagnaam(geenZaterdag[0])} ${formatDatum(geenZaterdag[0])} valt`}{" "}
            op een andere dag.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button
          type="button"
          disabled={fout !== null}
          onClick={() => {
            onToevoegen({ van, tot, coupleId, naam }, bewerkt?.id);
            setNaam("");
          }}
          className="rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen disabled:opacity-50"
        >
          {bewerkt ? "Bijwerken" : "Inplannen"}
        </button>
        {bewerkt && (
          <button
            type="button"
            onClick={onAnnuleren}
            className="text-sm text-gedempt underline"
          >
            {vuil ? "Annuleren" : "Sluiten"}
          </button>
        )}
      </div>
    </div>
  );
}
