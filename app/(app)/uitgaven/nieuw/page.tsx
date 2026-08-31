import { asc, eq } from "drizzle-orm";
import { db, couples, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { bewaarUitgaveAction } from "../actions";
import { heeftBlob } from "@/lib/opslag";
import { sleutelStatus } from "@/lib/instellingen";

export default async function NieuweUitgave() {
  const gebruiker = await vereisGebruiker();
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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Nieuwe uitgave</h1>
      <UitgaveFormulier
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
