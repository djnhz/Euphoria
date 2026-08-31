import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, budgetItems, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { uitgaveMetRegels } from "@/lib/data";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { wijzigUitgaveAction } from "../../actions";
import { heeftBlob } from "@/lib/opslag";
import { sleutelStatus } from "@/lib/instellingen";

export default async function UitgaveBewerken({
  params,
}: PageProps<"/uitgaven/[id]/bewerken">) {
  await vereisGebruiker();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const uitgave = await uitgaveMetRegels(id);
  if (!uitgave) notFound();

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
      <Link href={`/uitgaven/${id}`} className="text-sm text-accent underline">
        ← Terug
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Uitgave bewerken
      </h1>
      <UitgaveFormulier
        categorieen={categorieLijst}
        posten={postenLijst}
        huishoudens={huishoudens}
        begin={{
          datum: uitgave.datum,
          leverancier: uitgave.leverancier,
          opmerking: uitgave.opmerking,
          coupleId: uitgave.coupleId,
          regels: uitgave.regels.map((regel) => ({
            sleutel: `bestaand-${regel.id}`,
            omschrijving: regel.omschrijving,
            aantal: regel.aantal,
            bedrag: (regel.bedragCent / 100).toFixed(2).replace(".", ","),
            categoryId: regel.categoryId,
            budgetItemId: regel.budgetItemId ?? 0,
            aandeelAPct: regel.aandeelAPct,
            bron: regel.bron,
          })),
          bonnen: uitgave.bonnen.map((bon) => ({
            documentId: bon.id,
            naam: bon.naam,
            mime: bon.mime,
            voorbeeldUrl: bon.voorbeeldUrl,
            url: bon.url,
            hash: bon.hash,
            // Zelfde regel als bij een nieuwe uitgave: een PDF valt ook uit te lezen.
            analyseerbaar:
              bon.voorbeeldUrl !== null || bon.mime === "application/pdf",
          })),
        }}
        actie={wijzigUitgaveAction.bind(null, id)}
        knopLabel="Wijzigingen opslaan"
        heeftBlob={heeftBlob()}
        heeftSleutel={sleutel.ingesteld}
      />
    </div>
  );
}
