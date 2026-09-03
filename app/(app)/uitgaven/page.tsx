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
import { REEKSKLEUREN } from "@/lib/kleuren";
import UitgaveFilters from "@/components/UitgaveFilters";
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

/** Waarop je de lijst kunt opdelen; de sleutel staat in de URL. */
const GROEPEN = {
  maand: "Per maand",
  geen: "Alles onder elkaar",
  post: "Per post",
  hoofdpost: "Per hoofdpost",
  huishouden: "Per huishouden",
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
      .select({ id: posten.id, naam: posten.naam, ouderId: posten.ouderId })
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
  const kleurVanHuishouden = new Map(
    huishoudens.map((h, i) => [h.naam, REEKSKLEUREN[i === 0 ? 1 : 2]] as const),
  );

  return (
    <>
      <Schermkop
        titel="Kosten"
        onderschrift={
          <>
            {rijen.length} bon{rijen.length === 1 ? "" : "nen"} ·{" "}
            {formatEuro(totaal)}
            {jaar ? ` · ${jaar}` : ""}
          </>
        }
        tabs={<Segment items={KOSTEN_TABS} actief="/uitgaven" />}
      >
        <div className="mt-2.5">
          <UitgaveFilters
            jaren={jaren}
            posten={postenLijst}
            huishoudens={huishoudens}
            groepen={Object.entries(GROEPEN)}
          />
        </div>
      </Schermkop>

      <Schermbody>
        {rijen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-rand-sterk p-6 text-center text-sm text-gedempt">
            Niets gevonden met deze filters.
          </p>
        ) : (
          <>
            <PerHoofdpost rijen={rijen} totaal={totaal} />

            {groep === "geen" ? (
              <Lijst rijen={rijen} kleuren={kleurVanHuishouden} />
            ) : (
              groepen.map(([naam, groepsrijen]) => (
                <section key={naam}>
                  <Bovenschrift
                    className="mb-2 px-0.5"
                    rechts={formatEuro(
                      groepsrijen.reduce((som, r) => som + r.totaalCent, 0),
                    )}
                  >
                    {naam}
                  </Bovenschrift>
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
          </>
        )}
      </Schermbody>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 px-[18px]">
        <div className="mx-auto w-full max-w-5xl">
          <Link
            href="/uitgaven/nieuw"
            className="block rounded-2xl bg-inkt px-4 py-3.5 text-center text-[15px] font-semibold text-linnen shadow-[0_12px_24px_-10px_rgba(22,40,63,0.6)] transition hover:bg-inkt-hover"
          >
            Bon indienen
          </Link>
        </div>
      </div>
    </>
  );
}

/**
 * Eén balk met de verdeling over de hoofdposten, en eronder de bedragen. Dat is de
 * enige samenvatting die je op een telefoon in één blik leest; een taartdiagram
 * kost meer ruimte en zegt minder.
 */
function PerHoofdpost({ rijen, totaal }: { rijen: Rij[]; totaal: number }) {
  const per = new Map<string, number>();
  for (const rij of rijen) {
    per.set(rij.hoofdpost, (per.get(rij.hoofdpost) ?? 0) + rij.totaalCent);
  }
  const gesorteerd = [...per.entries()].sort((a, b) => b[1] - a[1]);
  if (gesorteerd.length < 2 || totaal === 0) return null;

  const top = gesorteerd.slice(0, 4);
  const restCent = gesorteerd.slice(4).reduce((som, [, c]) => som + c, 0);
  const delen = restCent > 0 ? [...top, ["Overig", restCent] as const] : top;

  return (
    <Paneel>
      <Bovenschrift className="mb-3" rechts={formatEuro(totaal)}>
        Per hoofdpost
      </Bovenschrift>
      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full">
        {delen.map(([naam, cent], i) => (
          <span
            key={naam}
            style={{
              width: `${(cent / totaal) * 100}%`,
              background: REEKSKLEUREN[i] ?? "var(--neutraal)",
            }}
          />
        ))}
      </div>
      <div className="grid gap-x-3.5 gap-y-2 sm:grid-cols-2">
        {delen.map(([naam, cent], i) => (
          <div key={naam} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-sm"
              style={{ background: REEKSKLEUREN[i] ?? "var(--neutraal)" }}
            />
            <span className="min-w-0 flex-1 truncate">{naam}</span>
            <span className="cijfers shrink-0 text-gedempt">
              {Math.round(cent / 100)}
            </span>
          </div>
        ))}
      </div>
    </Paneel>
  );
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
      {rijen.map((rij) => (
        <li key={rij.id}>
          <Link
            href={`/uitgaven/${rij.id}`}
            className="flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-verzonken"
          >
            {/* De streep zegt wie betaald heeft; de post staat eronder in tekst. */}
            <span
              aria-hidden
              className="h-[34px] w-[3px] shrink-0 rounded-sm"
              style={{
                background: kleuren.get(rij.coupleNaam) ?? rij.postKleur,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {rij.leverancier || "Zonder leverancier"}
              </p>
              <p className="truncate text-[11.5px] text-gedempt">
                {formatDatum(rij.datum)} · {rij.post} · {rij.coupleNaam}
                {rij.heeftBon && " · bon"}
              </p>
            </div>
            <span className="cijfers shrink-0 text-sm">
              {formatEuro(rij.totaalCent)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
