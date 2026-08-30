import { asc } from "drizzle-orm";
import { db, categories, couples, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { wijzigCategorieAction } from "./actions";
import NamenFormulier from "@/components/NamenFormulier";
import PinFormulier from "@/components/PinFormulier";
import NieuweCategorie from "@/components/NieuweCategorie";
import BonanalyseFormulier from "@/components/BonanalyseFormulier";
import { agendaStatus, sleutelStatus } from "@/lib/instellingen";
import AgendaFormulier from "@/components/AgendaFormulier";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

export default async function InstellingenPagina() {
  const gebruiker = await vereisGebruiker();

  const [categorieLijst, huishoudens, gebruikers] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    db
      .select({ id: users.id, naam: users.naam, coupleId: users.coupleId })
      .from(users)
      .orderBy(asc(users.id)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Categorieën en jaarbudget</h2>
        <p className="mb-4 text-xs text-gedempt">
          Laat het budget leeg als je een categorie niet wilt begroten. Een
          categorie uitvinken haalt hem uit de keuzelijsten; bestaande uitgaven
          blijven staan.
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
                <input
                  name="budget"
                  inputMode="decimal"
                  placeholder="geen budget"
                  defaultValue={
                    categorie.budgetJaarCent === null
                      ? ""
                      : (categorie.budgetJaarCent / 100)
                          .toFixed(2)
                          .replace(".", ",")
                  }
                  aria-label="Jaarbudget"
                  className={`${invoer} cijfers w-28`}
                />
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
          De sleutel wordt versleuteld opgeslagen en verlaat de server niet; je ziet
          hem hierna alleen nog aan de laatste vier tekens. Reken op ongeveer drie
          cent per uitgelezen bon.
        </p>
        <BonanalyseFormulier status={await sleutelStatus()} />
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <h2 className="mb-1 text-sm font-medium">Google-agenda</h2>
        <p className="mb-4 text-xs text-gedempt">
          Voor de vaarplanning. Een serviceaccount hoeft niet elke week opnieuw
          toestemming te geven, in tegenstelling tot inloggen met je eigen
          Google-account.
        </p>
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
        <h2 className="mb-1 text-sm font-medium">Pincode van {gebruiker.naam}</h2>
        <p className="mb-4 text-xs text-gedempt">
          Vier cijfers. Na vijf mislukte pogingen ligt je account een kwartier
          op slot.
        </p>
        <PinFormulier />
      </section>
    </div>
  );
}
