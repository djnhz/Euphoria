"use client";

import { useActionState } from "react";
import {
  bewaarOpenAiAction,
  testOpenAiAction,
  verwijderOpenAiAction,
  type MeldingState,
} from "@/app/(app)/instellingen/actions";
import type { SleutelStatus } from "@/lib/instellingen";
import Melding from "./Melding";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

function alsEuro(cent: number | null): string {
  return cent === null ? "" : (cent / 100).toFixed(2).replace(".", ",");
}

export default function BonanalyseFormulier({
  status,
  prijzen,
}: {
  status: SleutelStatus;
  /** Prijs per miljoen tokens in centen, zoals hij nu is ingesteld. */
  prijzen: { inCentPerMiljoen: number | null; uitCentPerMiljoen: number | null };
}) {
  const [bewaarState, bewaar, bezig] = useActionState<MeldingState, FormData>(
    bewaarOpenAiAction,
    null,
  );
  const [testState, test, testen] = useActionState<MeldingState, FormData>(
    testOpenAiAction,
    null,
  );
  const [wisState, wis, wissen] = useActionState<MeldingState, FormData>(
    verwijderOpenAiAction,
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <Status status={status} />

      <form action={bewaar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">
            {status.ingesteld ? "Nieuwe sleutel" : "OpenAI-sleutel"}
          </span>
          <input
            name="sleutel"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              status.ingesteld ? "laat leeg om te behouden" : "sk-..."
            }
            disabled={status.herkomst === "omgeving"}
            className={`${invoer} font-mono disabled:opacity-50`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Model</span>
          <input
            name="model"
            defaultValue={status.model}
            spellCheck={false}
            placeholder="gpt-4o"
            disabled={status.modelUitOmgeving}
            className={`${invoer} font-mono disabled:opacity-50 sm:w-64`}
          />
          <span className="text-xs text-gedempt">
            Moet afbeeldingen aankunnen.
          </span>
        </label>

        {/* Prijzen veranderen; ze staan daarom hier en niet in de code. Leeg laten
            mag: dan telt de app alleen tokens en doet hij geen uitspraak over geld. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gedempt">Prijs per 1M tokens in</span>
            <input
              name="prijsIn"
              inputMode="decimal"
              defaultValue={alsEuro(prijzen.inCentPerMiljoen)}
              placeholder="bijv. 2,50"
              className={`${invoer} cijfers`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gedempt">Prijs per 1M tokens uit</span>
            <input
              name="prijsUit"
              inputMode="decimal"
              defaultValue={alsEuro(prijzen.uitCentPerMiljoen)}
              placeholder="bijv. 10,00"
              className={`${invoer} cijfers`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={bezig || status.herkomst === "omgeving"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig ? "Bezig…" : "Opslaan"}
          </button>
          <Melding state={bewaarState} />
        </div>
      </form>

      {/* Zonder sleutel valt er niets te testen of te verwijderen, dus dan ook geen
          uitgegrijsde knoppen die alleen maar afleiden. */}
      {status.ingesteld && (
        <div className="flex flex-wrap items-center gap-3 border-t border-rand pt-3">
          <form action={test}>
            <button
              disabled={testen}
              className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
            >
              {testen ? "Testen…" : "Verbinding testen"}
            </button>
          </form>
          {status.herkomst === "database" && (
            <form action={wis}>
              <button
                disabled={wissen}
                className="rounded-lg border border-rand px-3 py-2 text-sm text-slecht disabled:opacity-50"
              >
                Sleutel verwijderen
              </button>
            </form>
          )}
          <Melding state={testState} />
          <Melding state={wisState} />
        </div>
      )}
    </div>
  );
}

function Status({ status }: { status: SleutelStatus }) {
  if (status.herkomst === "omgeving") {
    return (
      <p className="rounded-lg bg-accent-zacht p-3 text-sm">
        De sleutel komt uit de omgevingsvariabele <code>OPENAI_API_KEY</code> en
        eindigt op <code>{status.laatste4}</code>. Die gaat voor op wat hier staat,
        dus dit scherm kan hem niet wijzigen. Haal hem uit de omgeving als je hem
        liever hier beheert.
      </p>
    );
  }

  if (status.onleesbaar) {
    return (
      <p className="rounded-lg bg-accent-zacht p-3 text-sm">
        Er staat een sleutel opgeslagen, maar hij is niet te ontcijferen. Dat gebeurt
        als <code>SESSION_SECRET</code> is veranderd. Vul de sleutel opnieuw in.
      </p>
    );
  }

  if (!status.ingesteld) {
    return (
      <p className="text-sm text-gedempt">
        Nog geen sleutel. Zonder sleutel blijft alles werken, alleen leest de app geen
        bonnen uit en vul je de regels zelf in.
      </p>
    );
  }

  return (
    <p className="text-sm text-goed">
      Sleutel ingesteld, eindigend op <code>{status.laatste4}</code>.
    </p>
  );
}
