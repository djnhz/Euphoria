import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import {
  beschikbareJaren,
  haalRegels,
  perMaandPerBetaler,
  saldoPerMaand,
  uitgavenLijst,
} from "@/lib/data";
import { isSortering } from "@/lib/sorteren";
import { formatEuro } from "@/lib/geld";
import { MAANDEN, formatDatum } from "@/lib/datum";
import { HUISHOUDKLEUREN } from "@/lib/kleuren";
import UitgaveFilters from "@/components/UitgaveFilters";
import LijstOnthouden from "@/components/LijstOnthouden";
import Kostengrafieken from "@/components/Kostengrafieken";
import {
  Bovenschrift,
  Paneel,
  Schermbody,
  Schermkop,
  Segment,
} from "@/components/Scherm";
import { KOSTEN_TABS } from "@/components/kostenTabs";

type Rij = Awaited<ReturnType<typeof uitgavenLijst>>[number];

/**
 * Waarop je de lijst kunt opdelen; de sleutel staat in de URL. De volgorde is die van
 * het uitklapmenu: eerst de standaard, dan van grof naar fijn, "niet groeperen" als
 * laatste. De uitleg is er omdat "per post" en "per hoofdpost" anders op hetzelfde
 * lijken terwijl ze iets anders doen.
 */
const GROEPEN = {
  maand: { label: "Per maand" },
  hoofdpost: {
    label: "Per hoofdpost",
    uitleg: "subposten tellen mee bij hun hoofdpost",
  },
  post: { label: "Per post", uitleg: "ook de subposten apart" },
  huishouden: { label: "Per huishouden", uitleg: "wie het voorschoot" },
  geen: { label: "Niet groeperen" },
} as const;

type Groep = keyof typeof GROEPEN;

function groepsnaam(rij: Rij, groep: Groep): string {
  switch (groep) {
    case "maand":
      return `${MAANDEN[Number(rij.datum.slice(5, 7)) - 1]} ${rij.datum.slice(0, 4)}`;
    case "post":
      return rij.post;
    case "hoofdpost":
      return rij.hoofdpost;
    case "huishouden":
      return rij.coupleNaam;
    default:
      return "";
  }
}

/** Groepen in de volgorde waarin de rijen binnenkomen; sorteren blijft zo leidend. */
function groepeer(rijen: Rij[], groep: Groep) {
  const kaart = new Map<string, Rij[]>();
  for (const rij of rijen) {
    const naam = groepsnaam(rij, groep);
    kaart.set(naam, [...(kaart.get(naam) ?? []), rij]);
  }
  return [...kaart.entries()];
}

export default async function UitgavenPagina({
  searchParams,
}: PageProps<"/uitgaven">) {
  await vereisGebruiker();
  const params = await searchParams;

  const [jaren, postenLijst, huishoudens] = await Promise.all([
    beschikbareJaren(),
    db
      .select({
        id: posten.id,
        naam: posten.naam,
        ouderId: posten.ouderId,
        kleur: posten.kleur,
      })
      .from(posten)
      .orderBy(asc(posten.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  const gekozenJaar = Number(params.jaar);
  const jaar = jaren.includes(gekozenJaar) ? gekozenJaar : undefined;
  const postId = Number(params.post) || undefined;
  const coupleId = Number(params.huishouden) || undefined;

  const sorteerParam = String(params.sortering ?? "");
  const sortering = isSortering(sorteerParam) ? sorteerParam : "datum-nieuw";
  const groepParam = String(params.groep ?? "");
  // Per maand is de standaard: zo lees je een uitgavenlijst.
  const groep: Groep = groepParam in GROEPEN ? (groepParam as Groep) : "maand";

  const [rijen, jaarRegels] = await Promise.all([
    uitgavenLijst({ jaar, postId, coupleId, sortering }),
    // De grafieken kijken naar een heel jaar; de filters gelden voor de lijst.
    haalRegels(jaar ?? new Date().getFullYear()),
  ]);
  const totaal = rijen.reduce((som, r) => som + r.totaalCent, 0);
  const groepen = groep === "geen" ? [] : groepeer(rijen, groep);
  /**
   * Marine of messing, dezelfde twee kleuren die een huishouden overal in de app
   * heeft. Op dit scherm zit die kleur in een klein merkje achter de regel; de
   * kleur van de regel zelf is die van de post, want daar scan je op.
   */
  const kleurVanHuishouden = new Map(
    huishoudens.map(
      (h, i) => [h.naam, HUISHOUDKLEUREN[i] ?? "#3F6B54"] as const,
    ),
  );

  return (
    <>
      <LijstOnthouden sleutel="uitgavenLijst" />
      <Schermkop
        titel="Kosten"
        onderschrift={
          <>
            {rijen.length} bon{rijen.length === 1 ? "" : "nen"} ·{" "}
            {formatEuro(totaal)}
            {jaar ? ` · ${jaar}` : ""}
          </>
        }
        /* Geen knop hier: "Bon indienen" staat al op elk scherm in de kopbalk. */
        tabs={<Segment items={KOSTEN_TABS} actief="/uitgaven" />}
      >
        <div className="mt-2.5">
          <UitgaveFilters
            jaren={jaren}
            posten={postenLijst}
            huishoudens={huishoudens}
            groepen={Object.entries(GROEPEN).map(([waarde, g]) => ({
              waarde,
              ...g,
            }))}
          />
        </div>
      </Schermkop>

      {/*
        Op een breed scherm: de lijst links over de volle breedte, de verdeling
        rechts in een kolom die blijft staan terwijl je scrollt. Eerder stonden hier
        twee kolommen met maanden naast elkaar, en dan lees je augustus links,
        juli rechts, juni weer links -- heen en weer in plaats van naar beneden.

        De volgorde in de HTML zet de verdeling eerst, want op een telefoon hoort
        die boven de lijst. `col-start` en `row-start` zetten hem op een laptop
        alsnog rechts van de lijst.
      */}
      <Schermbody className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
        {rijen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-rand-sterk p-6 text-center text-sm text-gedempt">
            Geen bonnen met deze filters. Kies een ander jaar of een andere
            post.
          </p>
        ) : (
          <>
            <div className="min-w-0 xl:col-start-2 xl:row-start-1">
              <div className="xl:sticky xl:top-[calc(var(--kopbalk)+20px)]">
                <PerHoofdpost rijen={rijen} totaal={totaal} />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-1">
              {groep === "geen" ? (
                <Lijst rijen={rijen} kleuren={kleurVanHuishouden} />
              ) : (
                groepen.map(([naam, groepsrijen]) => (
                  <section key={naam}>
                    {/* Plakkend onder de kopbalk: bij zes maanden onder elkaar
                        weet je anders niet meer waar je bent. */}
                    <div className="sticky top-[var(--kopbalk)] z-10 mb-2 bg-achtergrond py-1.5">
                      <Bovenschrift
                        className="px-0.5"
                        rechts={formatEuro(
                          groepsrijen.reduce((som, r) => som + r.totaalCent, 0),
                        )}
                      >
                        {naam}
                      </Bovenschrift>
                    </div>
                    <Lijst rijen={groepsrijen} kleuren={kleurVanHuishouden} />
                  </section>
                ))
              )}

              {jaarRegels.length > 0 && (
                <Kostengrafieken
                  data={{
                    betaaldPerMaand: perMaandPerBetaler(jaarRegels),
                    saldoVerloop: saldoPerMaand(jaarRegels),
                    namen: {
                      a: huishoudens[0]?.naam ?? "Huishouden A",
                      b: huishoudens[1]?.naam ?? "Huishouden B",
                    },
                  }}
                />
              )}
            </div>
          </>
        )}
      </Schermbody>
    </>
  );
}

/**
 * Eén balk met de verdeling over de hoofdposten, en eronder de bedragen. Dat is de
 * enige samenvatting die je op een telefoon in één blik leest; een taartdiagram
 * kost meer ruimte en zegt minder.
 */
function PerHoofdpost({ rijen, totaal }: { rijen: Rij[]; totaal: number }) {
  // De kleur komt van de post zelf en niet van de plek in de rangschikking. Anders
  // is Elektronica hier donkerblauw en op de begroting groen, en betekent kleur
  // op het ene scherm iets anders dan op het andere.
  const per = new Map<string, { cent: number; kleur: string }>();
  for (const rij of rijen) {
    const huidig = per.get(rij.hoofdpost);
    per.set(rij.hoofdpost, {
      cent: (huidig?.cent ?? 0) + rij.totaalCent,
      kleur: rij.hoofdpostKleur,
    });
  }
  const gesorteerd = [...per.entries()].sort((a, b) => b[1].cent - a[1].cent);
  if (gesorteerd.length < 2 || totaal === 0) return null;

  const top = gesorteerd.slice(0, 5);
  const overig = gesorteerd.slice(5);

  // "Rest" is alleen eerlijk als hij ook echt iets verzamelt. Blijft er na de top 5
  // maar één post over, dan is er niets te bundelen -- die krijgt gewoon zijn eigen
  // naam en kleur, net als de rest van de rij.
  let delen: [string, { cent: number; kleur: string; titel?: string }][];
  if (overig.length === 0) {
    delen = top;
  } else if (overig.length === 1) {
    delen = [...top, overig[0]];
  } else {
    const restCent = overig.reduce((som, [, v]) => som + v.cent, 0);
    // Links staat elke post gewoon onder zijn eigen naam; zonder uitleg welke dat
    // zijn, moet je ze daar zelf gaan zoeken -- dus de namen staan in de tooltip.
    const restUitleg = overig
      .map(([naam, { cent }]) => `${naam} ${formatEuro(cent)}`)
      .join(", ");
    delen = [
      ...top,
      ["Rest", { cent: restCent, kleur: "var(--neutraal)", titel: restUitleg }],
    ];
  }

  return (
    <Paneel>
      <Bovenschrift className="mb-3" rechts={formatEuro(totaal)}>
        Waar het heen ging
      </Bovenschrift>
      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full">
        {delen.map(([naam, { cent, kleur, titel }]) => (
          <span
            key={naam}
            title={titel ? `${naam}: ${titel}` : `${naam}: ${formatEuro(cent)}`}
            style={{ width: `${(cent / totaal) * 100}%`, background: kleur }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {delen.map(([naam, { cent, kleur, titel }]) => (
          <div
            key={naam}
            title={titel}
            className="flex items-center gap-2 text-[12px]"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: kleur }}
            />
            <span className="min-w-0 flex-1 truncate">{naam}</span>
            <span className="cijfers shrink-0 text-gedempt">
              {Math.round((cent / totaal) * 100)}%
            </span>
            <span className="cijfers w-[68px] shrink-0 text-right">
              {formatEuro(cent)}
            </span>
          </div>
        ))}
      </div>
    </Paneel>
  );
}

/** "Buchner Nieuwenhuizen" wordt BN. Volledig uitgeschreven staat het 24 keer onder elkaar. */
function afkorting(naam: string): string {
  return naam
    .split(/\s+/)
    .map((woord) => woord[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** "2026-08-11" wordt "11 aug"; de volledige datum staat op de bondetailpagina. */
function kortDatum(datum: string): string {
  return `${Number(datum.slice(8))} ${MAANDEN[Number(datum.slice(5, 7)) - 1].slice(0, 3)}`;
}

function Lijst({
  rijen,
  kleuren,
}: {
  rijen: Rij[];
  kleuren: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand bg-paneel">
      {rijen.map((rij) => {
        // Drie cijfers voor de komma valt op omdat het dat verdient: in een lijst
        // waar 6,80 en 1.369,00 elkaar afwisselen mogen die niet even zwaar wegen.
        const fors = rij.totaalCent >= 100_00;
        return (
          <li key={rij.id}>
            {/*
              Op een telefoon twee regels, op een laptop een. Daar is ruimte voor
              eigen kolommen voor de datum en de post, en dan vervalt de tweede
              regel -- er passen zo bijna twee keer zoveel bonnen in beeld.
            */}
            <Link
              href={`/uitgaven/${rij.id}`}
              className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-verzonken lg:grid lg:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1fr)_52px_112px] lg:gap-3 lg:py-2.5"
            >
              <span className="cijfers hidden shrink-0 text-xs text-gedempt lg:block">
                {kortDatum(rij.datum)}
              </span>

              <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none">
                <span
                  aria-hidden
                  title={rij.post}
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: rij.postKleur }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {rij.leverancier || "Geen leverancier ingevuld"}
                  </p>
                  <p className="truncate text-[11.5px] text-gedempt lg:hidden">
                    {formatDatum(rij.datum)} · {rij.post}
                  </p>
                </div>
              </div>

              <span className="hidden min-w-0 truncate text-[13px] text-gedempt lg:block">
                {rij.post}
              </span>

              {/* Vaste kolom: het huishouden links, de paperclip in een eigen vak
                  rechts. Zonder bon blijft dat vak leeg, zodat het merk niet opschuift. */}
              <div className="flex shrink-0 items-center justify-between gap-1 lg:w-[52px]">
                <Huishoudmerk
                  naam={rij.coupleNaam}
                  kleur={kleuren.get(rij.coupleNaam) ?? "var(--neutraal)"}
                />
                <span className="flex w-[13px] justify-center">
                  {rij.heeftBon && <Bonklem />}
                </span>
              </div>

              <span
                className={`cijfers w-[88px] shrink-0 text-right text-sm lg:w-[112px] ${
                  fors ? "font-semibold" : ""
                }`}
              >
                {formatEuro(rij.totaalCent)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Wie het voorschoot, in twee letters en de kleur van dat huishouden. */
function Huishoudmerk({ naam, kleur }: { naam: string; kleur: string }) {
  return (
    <span
      title={`Voorgeschoten door ${naam}`}
      className="cijfers flex h-[19px] min-w-[19px] items-center justify-center rounded px-1 text-[10px] font-semibold text-linnen"
      style={{ background: kleur }}
    >
      {afkorting(naam)}
      <span className="sr-only"> — voorgeschoten door {naam}</span>
    </span>
  );
}

/** Er hangt een bon aan deze uitgave. Een tekentje leest sneller dan het woord "bon". */
function Bonklem() {
  return (
    <span title="Er zit een bon bij" className="text-zacht">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
        <path
          d="M18 8.5 10.2 16.3a3 3 0 1 1-4.3-4.2l8-8a4.5 4.5 0 1 1 6.4 6.4l-8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Bon bijgevoegd</span>
    </span>
  );
}
