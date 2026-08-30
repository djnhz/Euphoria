import { desc, eq } from "drizzle-orm";
import { db, documents, expenses, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentLijst from "@/components/DocumentLijst";

export default async function DocumentenPagina() {
  await vereisGebruiker();

  const rijen = await db
    .select({
      id: documents.id,
      naam: documents.naam,
      map: documents.map,
      mime: documents.mime,
      grootteBytes: documents.grootteBytes,
      url: documents.url,
      voorbeeldUrl: documents.voorbeeldUrl,
      expenseId: documents.expenseId,
      leverancier: expenses.leverancier,
      geuploadOp: documents.geuploadOp,
      geuploadDoor: users.naam,
    })
    .from(documents)
    .innerJoin(users, eq(documents.geuploadDoor, users.id))
    .leftJoin(expenses, eq(documents.expenseId, expenses.id))
    .orderBy(desc(documents.geuploadOp));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Documenten</h1>
      <p className="text-sm text-gedempt">
        Polissen, meetbrieven, facturen en handleidingen. Bonnen die bij een
        uitgave horen staan hier ook.
      </p>
      <DocumentUpload />
      <DocumentLijst
        rijen={rijen.map((rij) => ({
          ...rij,
          geuploadOp: rij.geuploadOp.toISOString(),
        }))}
      />
    </div>
  );
}
