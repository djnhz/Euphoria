import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, categories, couples } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { uitgaveMetRegels } from "@/lib/data";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { wijzigUitgaveAction } from "../../actions";

export default async function UitgaveBewerken({
  params,
}: PageProps<"/uitgaven/[id]/bewerken">) {
  await vereisGebruiker();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const uitgave = await uitgaveMetRegels(id);
  if (!uitgave) notFound();

  const [categorieLijst, huishoudens] = await Promise.all([
    db
      .select({ id: categories.id, naam: categories.naam })
      .from(categories)
      .where(eq(categories.actief, true))
      .orderBy(asc(categories.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
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
            aandeelAPct: regel.aandeelAPct,
            bron: regel.bron,
          })),
          bonnen: uitgave.bonnen.map((bon) => ({
            documentId: bon.id,
            naam: bon.naam,
            voorbeeldUrl: bon.voorbeeldUrl,
            url: bon.url,
          })),
        }}
        actie={wijzigUitgaveAction.bind(null, id)}
        toonUpload={false}
        knopLabel="Wijzigingen opslaan"
      />
    </div>
  );
}
