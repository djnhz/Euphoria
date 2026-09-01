import { asc } from "drizzle-orm";
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

export default async function InstellingenPagina() {
  const gebruiker = await vereisGebruiker();

  // Zonder beheerdersrechten valt er hier maar een ding te doen, dus dan halen we de
  // rest ook niet op.
  if (!gebruiker.beheerder) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>

        <section className="rounded-xl border border-rand bg-paneel p-4">
          <h2 className="mb-4 text-sm font-medium">
            Pincode van {gebruiker.naam}
          </h2>
          <PinFormulier />
        </section>

        <p className="text-sm text-gedempt">
          De rest — namen, de koppelingen en de pincodes van iedereen — beheert de
          beheerder.
        </p>
      </div>
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-4 text-sm font-medium">
          Pincode van {gebruiker.naam}
        </h2>
        <PinFormulier />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Pincodes van iedereen</h2>
        <p className="mb-4 text-xs text-gedempt">
          Een nieuwe code haalt meteen het slot van vijf mislukte pogingen weg.
        </p>
        <PincodeBeheer gebruikers={gebruikers} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Namen</h2>
        <p className="mb-4 text-xs text-gedempt">
          Het huishouden dat als eerste staat, telt in de app als huishouden A.
        </p>
        <NamenFormulier huishoudens={huishoudens} gebruikers={gebruikers} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Bonanalyse</h2>
        <p className="mb-4 text-xs text-gedempt">
          OpenAI geeft geen saldo terug, dus hieronder staat wat déze app heeft
          verbruikt. Wat er nog op je tegoed staat zie je in het OpenAI-dashboard.
        </p>
        <Verbruik overzicht={verbruik} />
        <BonanalyseFormulier status={await sleutelStatus()} prijzen={verbruik.prijzen} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-4 text-sm font-medium">Google-agenda</h2>
        <AgendaFormulier status={await agendaStatus()} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Beheerder</h2>
        <p className="mb-4 text-xs text-gedempt">
          Alleen een beheerder kan deze instellingen aanpassen en pincodes
          terugzetten. Er blijft er altijd minstens één over.
        </p>
        <BeheerderFormulier gebruikers={gebruikers} />
      </section>
    </div>
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
          <li key={regel.label} className="flex flex-wrap items-baseline gap-x-3">
            <span className="min-w-32 text-gedempt">{regel.label}</span>
            <span>
              {regel.stand.aantal} bon{regel.stand.aantal === 1 ? "" : "nen"}
            </span>
            <span className="cijfers text-gedempt">
              {(regel.stand.tokensIn + regel.stand.tokensUit).toLocaleString("nl-NL")}{" "}
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
          Vul hieronder de prijs per miljoen tokens in om er een bedrag bij te zien.
        </p>
      )}
    </div>
  );
}
