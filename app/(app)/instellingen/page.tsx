import { asc } from "drizzle-orm";
import { db, couples, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import NamenFormulier from "@/components/NamenFormulier";
import PinFormulier from "@/components/PinFormulier";
import PincodeBeheer from "@/components/PincodeBeheer";
import BonanalyseFormulier from "@/components/BonanalyseFormulier";
import { agendaStatus, sleutelStatus } from "@/lib/instellingen";
import AgendaFormulier from "@/components/AgendaFormulier";
import BeheerderFormulier from "@/components/BeheerderFormulier";

export default async function InstellingenPagina() {
  const gebruiker = await vereisGebruiker();

  const [huishoudens, gebruikers] = await Promise.all([
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
        <h2 className="mb-1 text-sm font-medium">Bonanalyse</h2>
        <p className="mb-4 text-xs text-gedempt">
          Reken op ongeveer drie cent per uitgelezen bon.
        </p>
        <BonanalyseFormulier status={await sleutelStatus()} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-4 text-sm font-medium">Google-agenda</h2>
        <AgendaFormulier status={await agendaStatus()} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Namen</h2>
        <p className="mb-4 text-xs text-gedempt">
          Het huishouden dat als eerste staat, is de kant waar de percentages
          bij de uitgaven naar verwijzen.
        </p>
        <NamenFormulier huishoudens={huishoudens} gebruikers={gebruikers} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Beheerder</h2>
        <p className="mb-4 text-xs text-gedempt">
          Een beheerder beheert de pincodes van iedereen. Er blijft er altijd
          minstens één over.
        </p>
        <BeheerderFormulier gebruikers={gebruikers} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-4 text-sm font-medium">
          Pincode van {gebruiker.naam}
        </h2>
        <PinFormulier />
      </section>

      {/* Zonder de oude code, dus alleen voor een beheerder. */}
      {gebruiker.beheerder && (
        <section className="rounded-xl border border-rand bg-paneel p-4">
          <h2 className="mb-1 text-sm font-medium">Pincodes van iedereen</h2>
          <p className="mb-4 text-xs text-gedempt">
            Een nieuwe code haalt meteen het slot van vijf mislukte pogingen weg.
          </p>
          <PincodeBeheer gebruikers={gebruikers} />
        </section>
      )}
    </div>
  );
}
