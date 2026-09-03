import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { beschikbareJaren, haalRegels, type RegelRij } from "@/lib/data";
import { formatEuro, verdeelRegel, verrekening } from "@/lib/geld";
import { formatDatum } from "@/lib/datum";
import { huishoudKleur } from "@/lib/kleuren";
import JaarKiezer from "@/components/JaarKiezer";
import {
  Bovenschrift,
  Paneel,
  Schermbody,
  Schermkop,
  Segment,
} from "@/components/Scherm";
import { KOSTEN_TABS } from "@/components/kostenTabs";

export default async function VerrekeningPagina({
  searchParams,
}: PageProps<"/verrekening">) {
  await vereisGebruiker();

  const params = await searchParams;
  const jaren = await beschikbareJaren();
  const gekozen = Number(params.jaar);
  const jaar = jaren.includes(gekozen) ? gekozen : undefined;

  const [regels, huishoudens] = await Promise.all([
    haalRegels(jaar),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  const naamA = huishoudens[0]?.naam ?? "Huishouden A";
  const naamB = huishoudens[1]?.naam ?? "Huishouden B";
  const overzicht = verrekening(regels);
  const perUitgave = groepeerPerUitgave(regels);
  const schuldigA = overzicht.saldo < 0;

  return (
    <>
      <Schermkop
        titel="Verrekening"
        onderschrift={jaar ? `stand over ${jaar}` : "stand over alle jaren"}
        rechts={
          <JaarKiezer
            jaren={[0, ...jaren]}
            huidig={jaar ?? 0}
            allesLabel="Alles"
          />
        }
        tabs={<Segment items={KOSTEN_TABS} actief="/verrekening" />}
      />

      <Schermbody>
        <section className="rounded-2xl bg-inkt p-[18px] text-linnen">
          <p className="bovenschrift !text-messing">
            {overzicht.saldo === 0 ? "In evenwicht" : "Onderling openstaand"}
          </p>
          {overzicht.saldo === 0 ? (
            <p className="titel mt-1.5 text-[30px] leading-tight">
              Jullie staan gelijk
            </p>
          ) : (
            <>
              <p className="titel cijfers mt-1.5 text-[38px] leading-tight">
                {formatEuro(Math.abs(overzicht.saldo))}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-linnen/80">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: huishoudKleur(schuldigA ? 0 : 1) }}
                />
                {schuldigA ? naamA : naamB}
                <span className="text-linnen/40">→</span>
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: huishoudKleur(schuldigA ? 1 : 0) }}
                />
                {schuldigA ? naamB : naamA}
              </p>
            </>
          )}
          <p className="mt-3.5 text-xs text-linnen/60 text-pretty">
            Onderlinge betalingen worden niet bijgehouden, dus dit bedrag telt door.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              naam: naamA,
              kleur: huishoudKleur(0),
              voorgeschoten: overzicht.voorgeschotenA,
              aandeel: overzicht.aandeelA,
            },
            {
              naam: naamB,
              kleur: huishoudKleur(1),
              voorgeschoten: overzicht.voorgeschotenB,
              aandeel: overzicht.aandeelB,
            },
          ].map((kant) => {
            const verschil = kant.voorgeschoten - kant.aandeel;
            return (
              <Paneel key={kant.naam}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: kant.kleur }}
                  />
                  {kant.naam}
                </h2>
                <dl className="flex flex-col gap-1 text-sm">
                  <Regel label="Voorgeschoten" cent={kant.voorgeschoten} />
                  <Regel label="Eigen aandeel" cent={kant.aandeel} />
                  <div className="mt-1 flex justify-between border-t border-rand pt-2">
                    <dt className="text-gedempt">
                      {verschil >= 0 ? "Nog te ontvangen" : "Nog te betalen"}
                    </dt>
                    <dd
                      className={`cijfers font-semibold ${
                        verschil > 0
                          ? "text-goed"
                          : verschil < 0
                            ? "text-messing-inkt"
                            : ""
                      }`}
                    >
                      {formatEuro(Math.abs(verschil))}
                    </dd>
                  </div>
                </dl>
              </Paneel>
            );
          })}
        </div>

        <section>
          <Bovenschrift className="mb-2 px-0.5">
            Wie betaalde wat{jaar ? ` in ${jaar}` : ""}
          </Bovenschrift>
          {perUitgave.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-rand-sterk p-5 text-center text-sm text-gedempt">
              Nog geen uitgaven.
            </p>
          ) : (
            <ul className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand bg-paneel">
              {perUitgave.map((uitgave) => (
                <li key={uitgave.expenseId}>
                  <Link
                    href={`/uitgaven/${uitgave.expenseId}`}
                    className="flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-verzonken"
                  >
                    <span
                      aria-hidden
                      className="h-[34px] w-[3px] shrink-0 rounded-sm"
                      style={{
                        background: huishoudKleur(uitgave.betaaldDoorA ? 0 : 1),
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {uitgave.leverancier || "Zonder leverancier"}
                      </p>
                      <p className="truncate text-[11.5px] text-gedempt">
                        {formatDatum(uitgave.datum)} · voorgeschoten door{" "}
                        {uitgave.betaaldDoorA ? naamA : naamB}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="cijfers text-sm">
                        {formatEuro(uitgave.totaal)}
                      </p>
                      <p className="cijfers text-[11px] text-gedempt">
                        ieder {formatEuro(uitgave.deelA)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Schermbody>
    </>
  );
}

function Regel({ label, cent }: { label: string; cent: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gedempt">{label}</dt>
      <dd className="cijfers">{formatEuro(cent)}</dd>
    </div>
  );
}

/** Regels horen bij een uitgave; voor dit overzicht tellen we ze per bon op. */
function groepeerPerUitgave(regels: readonly RegelRij[]) {
  const perId = new Map<
    number,
    {
      expenseId: number;
      datum: string;
      leverancier: string;
      betaaldDoorA: boolean;
      totaal: number;
      deelA: number;
    }
  >();

  for (const regel of regels) {
    const huidig = perId.get(regel.expenseId) ?? {
      expenseId: regel.expenseId,
      datum: regel.datum,
      leverancier: regel.leverancier,
      betaaldDoorA: regel.betaaldDoorA,
      totaal: 0,
      deelA: 0,
    };
    huidig.totaal += regel.bedragCent;
    huidig.deelA += verdeelRegel(regel.bedragCent, regel.aandeelAPct).deelA;
    perId.set(regel.expenseId, huidig);
  }

  return [...perId.values()].sort((a, b) => b.datum.localeCompare(a.datum));
}
