import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, couples, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { uitgaveMetRegels } from "@/lib/data";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { wijzigUitgaveAction } from "../../actions";
import { heeftBlob } from "@/lib/opslag";
import { sleutelStatus } from "@/lib/instellingen";
import { Bladkop, Schermbody } from "@/components/Scherm";

export default async function UitgaveBewerken({
  params,
}: PageProps<"/uitgaven/[id]/bewerken">) {
  await vereisGebruiker();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const uitgave = await uitgaveMetRegels(id);
  if (!uitgave) notFound();

  const [postenLijst, huishoudens, sleutel] = await Promise.all([
    db
      .select({ id: posten.id, naam: posten.naam, ouderId: posten.ouderId })
      .from(posten)
      .where(eq(posten.actief, true))
      .orderBy(asc(posten.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
    sleutelStatus(),
  ]);

  return (
    <>
      <Bladkop terug={`/uitgaven/${id}`} titel="Uitgave bewerken" />
      {/* Ruimte voor de vaste voet met het totaal en de opslaanknop. */}
      <Schermbody className="pb-[160px]">
        <UitgaveFormulier
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
              postId: regel.postId,
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
      </Schermbody>
    </>
  );
}
