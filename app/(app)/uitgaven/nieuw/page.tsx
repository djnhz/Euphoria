import { asc, eq } from "drizzle-orm";
import { db, couples, posten } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import UitgaveFormulier from "@/components/UitgaveFormulier";
import { bewaarUitgaveAction } from "../actions";
import { heeftBlob } from "@/lib/opslag";
import { sleutelStatus } from "@/lib/instellingen";
import { Bladkop, Schermbody } from "@/components/Scherm";

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
    <>
      <Bladkop terug="/uitgaven" titel="Nieuwe uitgave" />
      {/* Ruimte voor de vaste voet met het totaal en de opslaanknop. */}
      <Schermbody className="pb-[160px]">
        <UitgaveFormulier
          posten={postenLijst}
          huishoudens={huishoudens}
          // Wie invoert, heeft meestal zelf betaald.
          begin={{ coupleId: gebruiker.coupleId }}
          actie={bewaarUitgaveAction}
          knopLabel="Uitgave opslaan"
          heeftBlob={heeftBlob()}
          heeftSleutel={sleutel.ingesteld}
        />
      </Schermbody>
    </>
  );
}
