import { asc, eq } from "drizzle-orm";
import { db, couples, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import NamenFormulier from "@/components/NamenFormulier";
import PinFormulier from "@/components/PinFormulier";
import PincodeBeheer from "@/components/PincodeBeheer";
import BonanalyseFormulier from "@/components/BonanalyseFormulier";
import { agendaStatus, sleutelStatus } from "@/lib/instellingen";
import { verbruikOverzicht, type VerbruikOverzicht } from "@/lib/aiverbruik";
import { formatEuro } from "@/lib/geld";
import AgendaFormulier from "@/components/AgendaFormulier";
import BeheerderFormulier from "@/components/BeheerderFormulier";
import { Paneel, Schermbody, Schermkop } from "@/components/Scherm";
import MeldingenFormulier from "@/components/MeldingenFormulier";
import SleutelsFormulier from "@/components/SleutelsFormulier";
import {
  aantalToestellen,
  keuzesVoor,
  vapidStand,
  MELDING_LABELS,
} from "@/lib/melding";

export default async function InstellingenPagina() {
  const gebruiker = await vereisGebruiker();

  const [vapid, toestellen, voorkeuren] = await Promise.all([
    vapidStand(),
    aantalToestellen(gebruiker.id),
    db
      .select({
        bon: users.meldBon,
        taak: users.meldTaak,
        vrijgave: users.meldVrijgave,
      })
      .from(users)
      .where(eq(users.id, gebruiker.id)),
  ]);
  const mijn = voorkeuren[0] ?? { bon: true, taak: true, vrijgave: true };
  const meldingKeuzes = keuzesVoor(gebruiker).map((soort) => ({
    soort,
    titel: MELDING_LABELS[soort].titel,
    uitleg: MELDING_LABELS[soort].uitleg,
    aan: mijn[soort],
  }));
  const meldingenBlok = (
    <Paneel>
      <h2 className="mb-3 text-sm font-semibold">Meldingen</h2>
      <MeldingenFormulier
        vapidPubliek={vapid.publiek}
        keuzes={meldingKeuzes}
        toestellen={toestellen}
      />
    </Paneel>
  );

  // Zonder beheerdersrechten valt er hier maar een ding te doen, dus dan halen we de
  // rest ook niet op.
  if (!gebruiker.beheerder) {
    return (
      <>
        <Schermkop titel="Mijn pincode" onderschrift={gebruiker.naam} />
        <Schermbody className="gap-6">
          <Paneel>
            <PinFormulier />
          </Paneel>
          {meldingenBlok}
          <p className="text-sm text-gedempt text-pretty">
            De rest — namen, de koppelingen en de pincodes van iedereen —
            beheert de beheerder.
          </p>
        </Schermbody>
      </>
    );
  }

  const [verbruik, huishoudens, gebruikers] = await Promise.all([
    verbruikOverzicht(),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    db
      .select({
        id: users.id,
        naam: users.naam,
        coupleId: users.coupleId,
        beheerder: users.beheerder,
      })
      .from(users)
      .orderBy(asc(users.id)),
  ]);

  return (
    <>
      <Schermkop titel="Instellingen" onderschrift="beheer van de app" />
      <Schermbody className="gap-6">
        {meldingenBlok}
        {!vapid.ingesteld && (
          <Paneel>
            <h2 className="mb-2 text-sm font-semibold">
              Meldingen klaarzetten
            </h2>
            <SleutelsFormulier />
          </Paneel>
        )}
        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-4 text-sm font-medium">
            Pincode van {gebruiker.naam}
          </h2>
          <PinFormulier />
        </section>

        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-1 text-sm font-medium">Pincodes van iedereen</h2>
          <p className="mb-4 text-xs text-gedempt">
            Een nieuwe code haalt meteen het slot van vijf mislukte pogingen
            weg.
          </p>
          <PincodeBeheer gebruikers={gebruikers} />
        </section>

        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-1 text-sm font-medium">Namen</h2>
          <p className="mb-4 text-xs text-gedempt">
            Het huishouden dat als eerste staat, telt in de app als huishouden
            A.
          </p>
          <NamenFormulier huishoudens={huishoudens} gebruikers={gebruikers} />
        </section>

        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-1 text-sm font-medium">Bonanalyse</h2>
          <p className="mb-4 text-xs text-gedempt">
            OpenAI geeft geen saldo terug, dus hieronder staat wat déze app
            heeft verbruikt. Wat er nog op je tegoed staat zie je in het
            OpenAI-dashboard.
          </p>
          <Verbruik overzicht={verbruik} />
          <BonanalyseFormulier
            status={await sleutelStatus()}
            prijzen={verbruik.prijzen}
          />
        </section>

        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-4 text-sm font-medium">Google-agenda</h2>
          <AgendaFormulier status={await agendaStatus()} />
        </section>

        <section className="rounded-2xl border border-rand bg-paneel p-4">
          <h2 className="mb-1 text-sm font-medium">Beheerder</h2>
          <p className="mb-4 text-xs text-gedempt">
            Alleen een beheerder kan deze instellingen aanpassen en pincodes
            terugzetten. Er blijft er altijd minstens één over.
          </p>
          <BeheerderFormulier gebruikers={gebruikers} />
        </section>
      </Schermbody>
    </>
  );
}

/** Wat de app aan het model heeft uitgegeven, met de kosten als die te schatten zijn. */
function Verbruik({ overzicht }: { overzicht: VerbruikOverzicht }) {
  if (overzicht.totaal.aantal === 0) {
    return (
      <p className="mb-4 rounded-lg border border-rand p-3 text-sm text-gedempt">
        Er is nog geen bon uitgelezen, dus er is ook nog niets verbruikt.
      </p>
    );
  }

  const regels = [
    { label: "Deze maand", stand: overzicht.dezeMaand },
    { label: "Sinds het begin", stand: overzicht.totaal },
  ];

  return (
    <div className="mb-4 rounded-lg border border-rand p-3">
      <ul className="flex flex-col gap-2 text-sm">
        {regels.map((regel) => (
          <li
            key={regel.label}
            className="flex flex-wrap items-baseline gap-x-3"
          >
            <span className="min-w-32 text-gedempt">{regel.label}</span>
            <span>
              {regel.stand.aantal} bon{regel.stand.aantal === 1 ? "" : "nen"}
            </span>
            <span className="cijfers text-gedempt">
              {(regel.stand.tokensIn + regel.stand.tokensUit).toLocaleString(
                "nl-NL",
              )}{" "}
              tokens
            </span>
            <span className="cijfers ml-auto font-medium">
              {regel.stand.kostenCent === null
                ? "—"
                : `± ${formatEuro(Math.round(regel.stand.kostenCent))}`}
            </span>
          </li>
        ))}
      </ul>
      {overzicht.totaal.kostenCent === null && (
        <p className="mt-2 text-xs text-gedempt">
          Vul hieronder de prijs per miljoen tokens in om er een bedrag bij te
          zien.
        </p>
      )}
    </div>
  );
}
