import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { budgetOverzicht, haalRegels, totaalBegroot } from "@/lib/data";
import { formatEuro, saldoCent } from "@/lib/geld";
import { komendeBeurten, jouwBeurt, type Beurt } from "@/lib/aanboord";
import { alleTaken, voortgang } from "@/lib/taken";
import { huishoudKleur } from "@/lib/kleuren";
import { MAANDEN, plusDagen, vandaag } from "@/lib/datum";
import { haalReserveringen } from "@/lib/agenda";
import { agendaStatus } from "@/lib/instellingen";
import { Bovenschrift, Paneel } from "@/components/Scherm";
import { TaakRij } from "@/components/TaakOnderdelen";
import { taakPosten } from "@/lib/taken";

export default async function Overzicht() {
  const gebruiker = await vereisGebruiker();
  const nu = vandaag();
  const jaar = Number(nu.slice(0, 4));

  const [huishoudens, regels, budget, planning, taken, posten, agenda] =
    await Promise.all([
      db.select().from(couples).orderBy(asc(couples.volgorde)),
      haalRegels(jaar),
      budgetOverzicht(jaar),
      komendeBeurten(4),
      alleTaken(),
      taakPosten(),
      agendaStatus(),
    ]);

  // Een half jaar vooruit kijken en er drie tonen; zonder koppeling met de agenda
  // valt er niets op te halen.
  const uitAgenda = agenda.gekoppeld
    ? await haalReserveringen(nu, plusDagen(nu, 180))
    : [];
  const reserveringen = ("fout" in uitAgenda ? [] : uitAgenda).slice(0, 3);

  const kleurVan = new Map(
    huishoudens.map((h, i) => [h.id, huishoudKleur(i)] as const),
  );
  const namen = {
    a: huishoudens[0]?.naam ?? "Huishouden A",
    b: huishoudens[1]?.naam ?? "Huishouden B",
  };

  const mijn = jouwBeurt(planning.beurten, gebruiker.coupleId);
  const open = taken.filter((t) => !t.klaar);
  const stand = voortgang(taken);
  const saldo = saldoCent(await haalRegels());
  const besteed = regels.reduce((som, r) => som + r.bedragCent, 0);
  const begroot = budget.reduce((som, r) => som + (r.begrootCent ?? 0), 0);

  return (
    <>
      <Aftelling
        beurt={mijn}
        gepland={planning.gepland}
        jaar={planning.jaar}
        kleur={kleurVan.get(gebruiker.coupleId) ?? huishoudKleur(0)}
      />

      {/* Op een breed scherm naast elkaar: links waar je mee bezig bent, rechts wat
          het kost. Op een telefoon gewoon onder elkaar in dezelfde volgorde. */}
      <div className="grid gap-4 px-[18px] py-[18px] lg:grid-cols-2 lg:items-start lg:gap-6 lg:px-8 lg:py-7 xl:grid-cols-3">
        <div className="flex flex-col gap-4 lg:gap-6">
          {planning.beurten.length > 0 && (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <div className="bovenschrift">Seizoen {planning.jaar}</div>
                <Link
                  href="/vaarplanning/seizoen"
                  className="text-xs text-link"
                >
                  hele planning
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {planning.beurten.slice(0, 3).map((beurt) => (
                  <div
                    key={beurt.van}
                    className="flex items-center gap-3 rounded-2xl border border-rand bg-paneel p-3.5"
                  >
                    <span
                      className="w-[3px] self-stretch rounded-sm"
                      style={{ background: kleurVan.get(beurt.coupleId) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">
                        {beurt.coupleNaam}
                        {beurt.naam && (
                          <span className="font-normal text-gedempt">
                            {" "}
                            · {beurt.naam}
                          </span>
                        )}
                      </p>
                      <p className="cijfers text-[11.5px] text-gedempt">
                        wk {beurt.week} · {periode(beurt)}
                      </p>
                    </div>
                    {beurt.bezig ? (
                      <span className="shrink-0 rounded-md bg-accent-zacht px-2 py-1 text-[10.5px] font-semibold">
                        nu
                      </span>
                    ) : beurt.dagenTot <= 14 ? (
                      <span className="shrink-0 rounded-md bg-accent-zacht px-2 py-1 text-[10.5px] font-semibold">
                        over {beurt.dagenTot} d
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {reserveringen.length > 0 && (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <div className="bovenschrift">Komende reserveringen</div>
                <Link href="/vaarplanning" className="text-xs text-link">
                  kalender
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {reserveringen.map((reservering) => (
                  <div
                    key={reservering.id}
                    className="flex items-center gap-3 rounded-2xl border border-rand bg-paneel p-3.5"
                  >
                    <span
                      className="w-[3px] self-stretch rounded-sm"
                      style={{
                        background:
                          kleurVan.get(reservering.coupleId ?? -1) ??
                          "var(--neutraal)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">
                        {reservering.titel || "Gereserveerd"}
                      </p>
                      <p className="cijfers text-[11.5px] text-gedempt">
                        {periode(reservering)}
                      </p>
                    </div>
                    {reservering.van <= nu ? (
                      <span className="shrink-0 rounded-md bg-accent-zacht px-2 py-1 text-[10.5px] font-semibold">
                        nu
                      </span>
                    ) : (
                      <span className="cijfers shrink-0 text-[11px] text-gedempt">
                        over {dagenTot(nu, reservering.van)} d
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:gap-6">
          {open.length > 0 && (
            <Paneel>
              <Bovenschrift
                className="mb-3"
                rechts={`${stand.klaar} van ${stand.totaal} klaar`}
              >
                {mijn ? "Voor jullie week" : "Op de lijst"}
              </Bovenschrift>
              <ul className="-mx-4 divide-y divide-rand border-y border-rand">
                {open.slice(0, 3).map((taak) => (
                  <TaakRij
                    key={taak.id}
                    taak={taak}
                    posten={posten}
                    huishoudens={huishoudens}
                    jij={gebruiker.id}
                  />
                ))}
              </ul>
              <Link
                href="/taken"
                className="mt-3.5 block text-[12.5px] font-semibold text-link"
              >
                Alle taken →
              </Link>
            </Paneel>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:gap-6">
          <Paneel>
            <Bovenschrift
              className="mb-3.5"
              rechts={
                begroot > 0
                  ? `${rond(besteed)} / ${rond(begroot)}`
                  : formatEuro(besteed)
              }
            >
              Begroting {jaar}
            </Bovenschrift>

            {budget.length === 0 ? (
              <p className="text-sm text-gedempt">
                Nog niets begroot voor {jaar}.{" "}
                <Link href="/begroting" className="text-link">
                  Begroting maken
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {budget.slice(0, 3).map((rij) => {
                  const eigen = totaalBegroot(rij);
                  const deel =
                    eigen && eigen > 0 ? rij.werkelijkCent / eigen : null;
                  return (
                    <div key={rij.id}>
                      <div className="flex justify-between gap-3 text-[13px]">
                        <Link
                          href={`/uitgaven?jaar=${jaar}&post=${rij.id}`}
                          className="truncate hover:text-link"
                        >
                          {rij.naam}
                        </Link>
                        <span className="cijfers shrink-0 text-gedempt">
                          {deel === null
                            ? formatEuro(rij.werkelijkCent)
                            : `${Math.round(deel * 100)}%`}
                        </span>
                      </div>
                      {deel !== null && (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-linnen-diep">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, deel * 100)}%`,
                              background:
                                deel > 1 ? "var(--messing-inkt)" : rij.kleur,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Het onderlinge saldo is één regel: het is de uitkomst van het varen,
              niet waar je de app voor opent. */}
            <Link
              href="/verrekening"
              className="mt-4 flex items-center gap-2.5 border-t border-dashed border-rand-sterk pt-3.5"
            >
              <span className="flex-1 text-[12.5px] text-gedempt">
                {saldo === 0
                  ? "Onderling staan jullie gelijk"
                  : `Onderling openstaand · ${saldo > 0 ? namen.b : namen.a} → ${
                      saldo > 0 ? namen.a : namen.b
                    }`}
              </span>
              <span className="cijfers shrink-0 text-[13px]">
                {formatEuro(Math.abs(saldo))}
              </span>
            </Link>
          </Paneel>
        </div>
      </div>
    </>
  );
}

/** Hoeveel hele dagen er tussen twee ISO-datums zitten. */
function dagenTot(van: string, tot: string): number {
  return Math.round(
    (Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * De kop van het scherm: hoeveel dagen tot jullie eigen week. Staat er geen
 * planning, dan is dit de plek om er een te maken -- zonder planning valt er niets
 * te tellen en is een lege balk erger dan geen balk.
 */
function Aftelling({
  beurt,
  gepland,
  jaar,
  kleur,
}: {
  beurt: Beurt | null;
  gepland: boolean;
  jaar: number;
  kleur: string;
}) {
  return (
    <section className="relative overflow-hidden bg-inkt px-[18px] pt-4 pb-4 text-linnen lg:px-8 lg:pt-8 lg:pb-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-2.5 -right-8 opacity-[0.09] lg:-top-6 lg:right-10"
      >
        <svg
          viewBox="0 0 100 84"
          width="190"
          height="160"
          className="lg:w-[300px]"
        >
          <path d="M48 4 L48 56 L17 56 Z" fill="#F7F4EC" />
          <path d="M55 20 L55 56 L83 56 Z" fill="#F7F4EC" />
          <path
            d="M6 60 L94 60 C86 74 74 78 50 78 C26 78 14 74 6 60 Z"
            fill="#F7F4EC"
          />
        </svg>
      </div>

      <div className="relative flex items-end justify-between gap-4 lg:gap-10">
        <div className="min-w-0">
          {beurt ? (
            <>
              <p className="bovenschrift !text-messing">
                {beurt.bezig ? "Jullie week loopt" : "Jullie week begint over"}
              </p>
              {/* Het getal en de periode op één regel: het aantal dagen zegt niets
                  zonder de datums erbij, en zo scheelt het een halve schermhoogte. */}
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="titel cijfers text-[44px] leading-none font-normal">
                  {beurt.bezig ? "nu" : beurt.dagenTot}
                </span>
                {!beurt.bezig && (
                  <span className="titel text-lg text-linnen/80">
                    {beurt.dagenTot === 1 ? "dag" : "dagen"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-linnen/70">
                <span>
                  {volledigePeriode(beurt)} · week {beurt.week}
                </span>
                {/* Geen streepje ertussen: bij een smal scherm valt het huishouden
                    naar de volgende regel en blijft zo'n scheiding bungelen. */}
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: kleur }}
                  />
                  {beurt.coupleNaam}
                  {beurt.naam && ` · ${beurt.naam}`}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="bovenschrift !text-messing">Seizoen {jaar}</p>
              <p className="titel mt-2 text-[26px] leading-tight">
                {gepland
                  ? "Voor dit jaar staat er niets meer op jullie naam"
                  : "Nog geen seizoensplanning"}
              </p>
              <p className="mt-2 text-sm text-linnen/75 text-pretty">
                {gepland
                  ? "Het seizoen is voorbij of jullie weken zijn geweest."
                  : "Verdeel de weken over de twee huishoudens, dan telt dit scherm af naar jullie eigen week."}
              </p>
            </>
          )}
        </div>

        {/* Eén knop, en alleen waar hij iets toevoegt. Naast de aftelling in plaats
            van eronder: over de volle breedte vroeg hij meer aandacht dan hij waard
            is, en het scheelt weer een regel. */}
        <Link
          href={beurt ? "/vaarplanning" : "/vaarplanning/seizoen"}
          className="shrink-0 rounded-xl border border-linnen/30 px-3.5 py-2.5 text-center text-[13px] transition hover:bg-linnen/10 lg:px-7 lg:text-sm"
        >
          {beurt ? "Hele planning" : "Seizoen verdelen"}
        </Link>
      </div>
    </section>
  );
}

/** "12 — 18 sep", met de maand alleen waar hij verandert. */
function periode(beurt: { van: string; tot: string }): string {
  const [, m1, d1] = beurt.van.split("-");
  const [, m2, d2] = beurt.tot.split("-");
  const eind = `${Number(d2)} ${MAANDEN[Number(m2) - 1]}`;
  return m1 === m2
    ? `${Number(d1)} — ${eind}`
    : `${Number(d1)} ${MAANDEN[Number(m1) - 1]} — ${eind}`;
}

/** Dezelfde periode maar met de dagnaam ervoor, voor de kop. */
function volledigePeriode(beurt: { van: string; tot: string }): string {
  const dagen = [
    "zondag",
    "maandag",
    "dinsdag",
    "woensdag",
    "donderdag",
    "vrijdag",
    "zaterdag",
  ];
  const start = new Date(`${beurt.van}T00:00:00Z`).getUTCDay();
  return `${dagen[start]} ${periode(beurt)}`;
}

/** Bedragen in de kopregel zonder centen; daar gaat het om de orde van grootte. */
function rond(cent: number): string {
  return new Intl.NumberFormat("nl-NL").format(Math.round(cent / 100));
}
