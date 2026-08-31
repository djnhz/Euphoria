import { asc, eq, sql } from "drizzle-orm";
import { db, budgetItems, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { bewaarUitgaveAction } from "../actions";
import { heeftBlob } from "@/lib/opslag";
import { sleutelStatus } from "@/lib/instellingen";

export default async function NieuweUitgave() {
  const gebruiker = await vereisGebruiker();
  const [categorieLijst, postenLijst, huishoudens, sleutel] = await Promise.all([
    db
      .select({
        id: categories.id,
        naam: categories.naam,
        // Geen vaste post is in het formulier gewoon 0.
        budgetItemId: sql<number>`coalesce(${categories.budgetItemId}, 0)`,
      })
      .from(categories)
      .where(eq(categories.actief, true))
      .orderBy(asc(categories.naam)),
    db
      .select({ id: budgetItems.id, naam: budgetItems.naam })
      .from(budgetItems)
      .where(eq(budgetItems.actief, true))
      .orderBy(asc(budgetItems.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    sleutelStatus(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Nieuwe uitgave</h1>
      <UitgaveFormulier
        categorieen={categorieLijst}
        posten={postenLijst}
        huishoudens={huishoudens}
        // Wie invoert, heeft meestal zelf betaald.
        begin={{ coupleId: gebruiker.coupleId }}
        actie={bewaarUitgaveAction}
        knopLabel="Opslaan"
        heeftBlob={heeftBlob()}
        heeftSleutel={sleutel.ingesteld}
      />
    </div>
  );
}
