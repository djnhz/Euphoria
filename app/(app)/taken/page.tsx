import { asc } from "drizzle-orm";
import { db, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import {
  alleTaken,
  dezeWeek,
  taakMensen,
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

  const [taken, mensen, huishoudens, planning] = await Promise.all([
    alleTaken(),
    taakMensen(),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    komendeBeurten(1),
  ]);

  // Wie er aan boord is bepaalt voor wie "deze week" telt; dat staat erbij zodat
  // duidelijk is waarom juist deze taken vooraan staan.
  const aanBoord = planning.beurten[0] ?? null;

  /**
   * Twee gescheiden lijsten. Open gaat over dit seizoen, Winterklaar over het
   * opruimen aan het eind; die door elkaar tonen vroeg om een label om ze uit elkaar
   * te houden, terwijl een eigen tabblad dat vanzelf doet.
   */
  const gewoon = taken.filter((t) => t.soort === "gewoon");
  const winter = taken.filter((t) => t.soort === "winterklaar");

  const open = gewoon.filter((t) => !t.klaar);
  const week = dezeWeek(gewoon);
  const later = open.filter((t) => !week.some((w) => w.id === t.id));
  const stand = voortgang(gewoon);
  const winterStand = voortgang(winter);
  const winterOpen = winter.filter((t) => !t.klaar).length;

  const gedeeld = { huishoudens, mensen, jij: gebruiker.id };

  return (
    <>
      <Schermkop
        titel="Taken"
        onderschrift={
          lijst === "winterklaar"
            ? winter.length === 0
              ? "nog niets op de winterlijst"
              : `${winterOpen} nog te doen voor de winter`
            : lijst === "klaar"
              ? `${taken.filter((t) => t.klaar).length} afgevinkt`
              : gewoon.length === 0
                ? "nog geen taken"
                : `${open.length} open · ${week.length} deze week`
        }
        rechts={
          lijst === "klaar" ? undefined : (
            <TaakToevoegen
              {...gedeeld}
              soort={lijst === "winterklaar" ? "winterklaar" : "gewoon"}
              inKop
            />
          )
        }
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
            {gewoon.length > 0 && <Voortgang stand={stand} />}

            {gewoon.length === 0 && (
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
          <>
            {winter.length > 0 && (
              <Voortgang
                stand={winterStand}
                kop={
                  winterStand.procent === 100
                    ? "Klaar voor de winter"
                    : winterStand.procent >= 50
                      ? "Winterklaar maken gaat goed"
                      : "Nog veel te doen voor de winter"
                }
                eenheid={["winterklaar-taak", "winterklaar-taken"]}
              />
            )}
            <Tabblad
              taken={winter}
              leeg="De winterlijst is nog leeg. Wat je hier toevoegt, staat op de lijst voor het winterklaar maken."
              {...gedeeld}
            />
          </>
        )}

        {lijst === "klaar" && (
          <Tabblad
            taken={taken.filter((t) => t.klaar)}
            leeg="Nog niets afgevinkt."
            toonSoort
            {...gedeeld}
          />
        )}
      </Schermbody>

      {lijst !== "klaar" && (
        <TaakToevoegen
          {...gedeeld}
          soort={lijst === "winterklaar" ? "winterklaar" : "gewoon"}
        />
      )}
    </>
  );
}

function Tabblad({
  taken,
  leeg,
  toonSoort = false,
  ...gedeeld
}: {
  taken: Taak[];
  leeg: string;
  /** Alleen op Klaar, waar gewone en winterklaar-taken door elkaar staan. */
  toonSoort?: boolean;
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
            <TaakRij
              key={taak.id}
              taak={taak}
              toonSoort={toonSoort}
              {...gedeeld}
            />
          ))}
        </Lijst>
      )}
      {af.length > 0 && (
        <Blok titel={open.length > 0 ? "Al gedaan" : "Gedaan"}>
          <Lijst>
            {af.map((taak) => (
              <TaakRij
                key={taak.id}
                taak={taak}
                toonSoort={toonSoort}
                {...gedeeld}
              />
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
  kop,
  eenheid = ["taak", "taken"],
}: {
  stand: { klaar: number; totaal: number; procent: number };
  /** Eigen kop boven het getal; zonder valt hij terug op de algemene tekst. */
  kop?: string;
  /** Enkelvoud en meervoud, want "1 taken" leest als een fout. */
  eenheid?: readonly [string, string];
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
          {kop ??
            (stand.procent >= 80
              ? "Bijna alles af"
              : stand.procent >= 40
                ? "Onderhoud op schema"
                : "Er ligt nog werk")}
        </p>
        <p className="mt-0.5 text-[12.5px] text-linnen/70">
          {stand.klaar} van {stand.totaal}{" "}
          {stand.totaal === 1 ? eenheid[0] : eenheid[1]} afgevinkt
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
