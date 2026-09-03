"use client";

import { useActionState } from "react";
import {
  bewaarAgendaAction,
  ontkoppelAgendaAction,
  testAgendaAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import type { AgendaStatus } from "@/lib/instellingen";
import Melding from "./Melding";

const invoer = "rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm";

export default function AgendaFormulier({ status }: { status: AgendaStatus }) {
  const [bewaarState, bewaar, bezig] = useActionState<MeldingState, FormData>(
    bewaarAgendaAction,
    null,
  );
  const [testState, test, testen] = useActionState<MeldingState, FormData>(
    testAgendaAction,
    null,
  );
  const [losState, loskoppelen, bezigLos] = useActionState<MeldingState, FormData>(
    ontkoppelAgendaAction,
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      {status.onleesbaar ? (
        <p className="rounded-xl bg-marine-tint p-3 text-sm">
          Er staat een sleutel opgeslagen, maar hij is niet te ontcijferen. Dat
          gebeurt als <code>SESSION_SECRET</code> is veranderd. Plak hem opnieuw.
        </p>
      ) : status.gekoppeld ? (
        <p className="text-sm text-goed">
          Gekoppeld als <code>{status.serviceEmail}</code>. Deel de agenda met dat
          adres, met rechten om afspraken te wijzigen.
        </p>
      ) : (
        <p className="text-sm text-gedempt">
          Nog niet gekoppeld. Maak in Google Cloud een serviceaccount, download de
          JSON-sleutel en plak die hieronder.
        </p>
      )}

      <form action={bewaar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">
            {status.gekoppeld ? "Nieuwe serviceaccountsleutel" : "Serviceaccountsleutel"}
          </span>
          <textarea
            name="serviceAccount"
            rows={4}
            spellCheck={false}
            placeholder={
              status.gekoppeld
                ? "laat leeg om te behouden"
                : '{ "type": "service_account", "client_email": "...", "private_key": "..." }'
            }
            className={`${invoer} font-mono text-xs`}
          />
          <span className="text-xs text-gedempt">
            Het hele JSON-bestand; het wordt versleuteld opgeslagen.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Agenda-ID</span>
          <input
            name="agendaId"
            defaultValue={status.agendaId ?? ""}
            spellCheck={false}
            placeholder="...@group.calendar.google.com"
            className={`${invoer} font-mono text-xs`}
          />
          <span className="text-xs text-gedempt">
            Te vinden onder Instellingen van die agenda in Google Agenda.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={bezig}
            className="rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen disabled:opacity-50"
          >
            {bezig ? "Bezig…" : "Opslaan"}
          </button>
          <Melding state={bewaarState} />
        </div>
      </form>

      {status.gekoppeld && (
        <div className="flex flex-wrap items-center gap-3 border-t border-rand pt-3">
          <form action={test}>
            <button
              disabled={testen}
              className="rounded-xl border border-rand-sterk px-3.5 py-2.5 text-sm disabled:opacity-50"
            >
              {testen ? "Testen…" : "Verbinding testen"}
            </button>
          </form>
          <form action={loskoppelen}>
            <button
              disabled={bezigLos}
              className="rounded-xl border border-rand-sterk px-3.5 py-2.5 text-sm text-slecht disabled:opacity-50"
            >
              Ontkoppelen
            </button>
          </form>
          <Melding state={testState} />
          <Melding state={losState} />
        </div>
      )}
    </div>
  );
}
