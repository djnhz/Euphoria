import { desc, eq } from "drizzle-orm";
import { db, documents, expenses, users } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentLijst from "@/components/DocumentLijst";
import { heeftBlob } from "@/lib/opslag";
import { Schermbody, Schermkop } from "@/components/Scherm";

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
    <>
      <Schermkop
        titel="Documenten"
        onderschrift="bonnen bij een uitgave staan hier ook"
      />
      <Schermbody>
        <DocumentUpload heeftBlob={heeftBlob()} />
        <DocumentLijst
          rijen={rijen.map((rij) => ({
            ...rij,
            geuploadOp: rij.geuploadOp.toISOString(),
          }))}
        />
      </Schermbody>
    </>
  );
}
