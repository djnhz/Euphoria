import { asc } from "drizzle-orm";
import { db, budgetItems, categories, couples, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { wijzigCategorieAction } from "./actions";
import NamenFormulier from "@/components/NamenFormulier";
import PinFormulier from "@/components/PinFormulier";
import PincodeBeheer from "@/components/PincodeBeheer";
import NieuweCategorie from "@/components/NieuweCategorie";
import BonanalyseFormulier from "@/components/BonanalyseFormulier";
import { agendaStatus, sleutelStatus } from "@/lib/instellingen";
import AgendaFormulier from "@/components/AgendaFormulier";
import BeheerderFormulier from "@/components/BeheerderFormulier";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

export default async function InstellingenPagina() {
  const gebruiker = await vereisGebruiker();

  const [categorieLijst, postenLijst, huishoudens, gebruikers] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.naam)),
    db.select().from(budgetItems).orderBy(asc(budgetItems.naam)),
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
        <h2 className="mb-1 text-sm font-medium">Categorieën</h2>
        <p className="mb-4 text-xs text-gedempt">
          De post erachter is de begroting die een regel in deze categorie standaard
          krijgt; per bon kun je er altijd van afwijken.
        </p>
        <ul className="flex flex-col gap-2">
          {categorieLijst.map((categorie) => (
            <li key={categorie.id}>
              <form
                action={wijzigCategorieAction}
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="id" value={categorie.id} />
                <input
                  type="color"
                  name="kleur"
                  defaultValue={categorie.kleur}
                  aria-label={`Kleur voor ${categorie.naam}`}
                  className="h-9 w-9 shrink-0 rounded border border-rand bg-transparent"
                />
                <input
                  name="naam"
                  defaultValue={categorie.naam}
                  aria-label="Naam"
                  className={`${invoer} min-w-0 flex-1`}
                />
                <select
                  name="post"
                  // Zonder sleutel houdt React het bestaande veld vast en blijft na
                  // opslaan de oude keuze staan tot je de pagina ververst.
                  key={categorie.budgetItemId ?? 0}
                  defaultValue={categorie.budgetItemId ?? 0}
                  aria-label={`Begrotingspost voor ${categorie.naam}`}
                  className={`${invoer} min-w-0 flex-1`}
                >
                  <option value={0}>geen vaste post</option>
                  {postenLijst.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.naam}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm text-gedempt">
                  <input
                    type="checkbox"
                    name="actief"
                    defaultChecked={categorie.actief}
                  />
                  actief
                </label>
                <button className="rounded-lg border border-rand px-3 py-2 text-sm">
                  Opslaan
                </button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-rand pt-4">
          <NieuweCategorie />
        </div>
      </section>

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
          Een beheerder plant het seizoen en beheert de pincodes. Er blijft er
          altijd minstens één over.
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
