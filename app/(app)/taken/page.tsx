import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import {
  alleTaken,
  dezeWeek,
  taakPosten,
  voortgang,
  type Taak,
} from "@/lib/taken";
import { komendeBeurten } from "@/lib/aanboord";
import {
  Schermkop,
  Schermbody,
  Segment,
  Bovenschrift,
  Lijst,
} from "@/components/Scherm";
import {
  SamenKaart,
  TaakRij,
  TaakToevoegen,
} from "@/components/TaakOnderdelen";

const TABS = [
  { href: "/taken", label: "Open" },
  { href: "/taken?lijst=winterklaar", label: "Winterklaar" },
  { href: "/taken?lijst=klaar", label: "Klaar" },
] as const;

export default async function TakenPagina({
  searchParams,
}: PageProps<"/taken">) {
  const gebruiker = await vereisGebruiker();
  const params = await searchParams;
  const lijst =
    params.lijst === "winterklaar" || params.lijst === "klaar"
      ? params.lijst
      : "open";

  const [taken, posten, huishoudens, planning] = await Promise.all([
    alleTaken(),
    taakPosten(),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    komendeBeurten(1),
  ]);

  // Wie er aan boord is bepaalt voor wie "deze week" telt; dat staat erbij zodat
  // duidelijk is waarom juist deze taken vooraan staan.
  const aanBoord = planning.beurten[0] ?? null;

  const open = taken.filter((t) => !t.klaar);
  const week = dezeWeek(taken);
  const samen = open.filter((t) => t.samen);
  const later = open.filter(
    (t) => !t.samen && !week.some((w) => w.id === t.id),
  );
  const stand = voortgang(taken);

  const gedeeld = { posten, huishoudens, jij: gebruiker.id };

  return (
    <>
      <Schermkop
        titel="Taken"
        onderschrift={
          taken.length === 0
            ? "nog geen taken"
            : `${open.length} open · ${week.length} deze week`
        }
        rechts={<TaakToevoegen {...gedeeld} inKop />}
        tabs={
          <Segment
            items={TABS}
            actief={lijst === "open" ? "/taken" : `/taken?lijst=${lijst}`}
          />
        }
      />

      <Schermbody className="gap-[18px] xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-6">
        {lijst === "open" && (
          <>
            {taken.length > 0 && <Voortgang stand={stand} />}

            {taken.length === 0 && (
              <Leeg tekst="Nog geen taken. Zet hieronder het eerste klusje op de lijst." />
            )}

            {week.length > 0 && (
              <Blok
                titel={
                  aanBoord
                    ? `Deze week · ${aanBoord.coupleNaam} aan boord`
                    : "Deze week"
                }
              >
                <Lijst>
                  {week.map((taak) => (
                    <TaakRij key={taak.id} taak={taak} {...gedeeld} />
                  ))}
                </Lijst>
              </Blok>
            )}

            {samen.length > 0 && (
              <Blok titel="Samen oppakken">
                <div className="flex flex-col gap-2.5">
                  {samen.map((taak) => (
                    <SamenKaart key={taak.id} taak={taak} {...gedeeld} />
                  ))}
                </div>
              </Blok>
            )}

            {later.length > 0 && (
              <Blok
                titel={week.length > 0 ? "Later dit seizoen" : "Op de lijst"}
              >
                <Lijst>
                  {later.map((taak) => (
                    <TaakRij key={taak.id} taak={taak} {...gedeeld} />
                  ))}
                </Lijst>
              </Blok>
            )}
          </>
        )}

        {lijst === "winterklaar" && (
          <Tabblad
            taken={taken.filter((t) => t.soort === "winterklaar")}
            leeg="Nog niets op de winterlijst. Vink bij een taak “hoort bij winterklaar maken” aan."
            {...gedeeld}
          />
        )}

        {lijst === "klaar" && (
          <Tabblad
            taken={taken.filter((t) => t.klaar)}
            leeg="Nog niets afgevinkt."
            {...gedeeld}
          />
        )}
      </Schermbody>

      <TaakToevoegen {...gedeeld} />
    </>
  );
}

function Tabblad({
  taken,
  leeg,
  ...gedeeld
}: {
  taken: Taak[];
  leeg: string;
  posten: { id: number; naam: string; kleur: string }[];
  huishoudens: { id: number; naam: string }[];
  jij: number;
}) {
  if (taken.length === 0) return <Leeg tekst={leeg} />;
  const open = taken.filter((t) => !t.klaar);
  const af = taken.filter((t) => t.klaar);
  return (
    <>
      {open.length > 0 && (
        <Lijst>
          {open.map((taak) => (
            <TaakRij key={taak.id} taak={taak} {...gedeeld} />
          ))}
        </Lijst>
      )}
      {af.length > 0 && (
        <Blok titel={open.length > 0 ? "Al gedaan" : "Gedaan"}>
          <Lijst>
            {af.map((taak) => (
              <TaakRij key={taak.id} taak={taak} {...gedeeld} />
            ))}
          </Lijst>
        </Blok>
      )}
    </>
  );
}

/**
 * De ring met het percentage. Een conic-gradient in plaats van een grafiek: het is
 * één getal, daar hoeft geen tekenbibliotheek voor te laden.
 */
function Voortgang({
  stand,
}: {
  stand: { klaar: number; totaal: number; procent: number };
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-inkt p-4 text-linnen xl:col-span-2 xl:p-6">
      <div
        className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full"
        style={{
          height: 52,
          width: 52,
          background: `conic-gradient(var(--messing) 0 ${stand.procent}%, rgba(247,244,236,.2) ${stand.procent}% 100%)`,
        }}
      >
        <span className="cijfers flex h-[38px] w-[38px] items-center justify-center rounded-full bg-inkt text-xs">
          {stand.procent}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="titel text-[19px]">
          {stand.procent >= 80
            ? "Bijna alles af"
            : stand.procent >= 40
              ? "Onderhoud op schema"
              : "Er ligt nog werk"}
        </p>
        <p className="mt-0.5 text-[12.5px] text-linnen/70">
          {stand.klaar} van {stand.totaal} taken afgevinkt
        </p>
      </div>
    </div>
  );
}

function Blok({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Bovenschrift className="mb-2.5">{titel}</Bovenschrift>
      {children}
    </section>
  );
}

function Leeg({ tekst }: { tekst: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-rand-sterk p-5 text-center text-sm text-gedempt text-pretty">
      {tekst}
    </p>
  );
}
