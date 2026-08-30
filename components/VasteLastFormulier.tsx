"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  bewaarVasteLastAction,
  type VasteLastState,
} from "@/app/(app)/vaste-lasten/actions";

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

export default function VasteLastFormulier({
  categorieen,
  huishoudens,
  standaardDatum,
}: {
  categorieen: { id: number; naam: string }[];
  huishoudens: { id: number; naam: string }[];
  standaardDatum: string;
}) {
  const [state, formAction, bezig] = useActionState<VasteLastState, FormData>(
    bewaarVasteLastAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // De actie geeft null terug als het gelukt is; dan mag het formulier leeg.
  useEffect(() => {
    if (!bezig && state === null) formRef.current?.reset();
  }, [state, bezig]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-xl border border-rand bg-paneel p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Veld label="Omschrijving">
        <input
          name="omschrijving"
          required
          placeholder="Ligplaats jachthaven"
          className={invoer}
        />
      </Veld>
      <Veld label="Bedrag">
        <input
          name="bedrag"
          inputMode="decimal"
          required
          placeholder="0,00"
          className={`${invoer} cijfers`}
        />
      </Veld>
      <Veld label="Categorie">
        <select name="categoryId" className={invoer}>
          {categorieen.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.naam}
            </option>
          ))}
        </select>
      </Veld>
      <Veld label="Interval">
        <select name="interval" defaultValue="jaar" className={invoer}>
          <option value="maand">per maand</option>
          <option value="kwartaal">per kwartaal</option>
          <option value="jaar">per jaar</option>
        </select>
      </Veld>
      <Veld label="Eerstvolgende datum">
        <input
          type="date"
          name="volgendeDatum"
          defaultValue={standaardDatum}
          required
          className={invoer}
        />
      </Veld>
      <Veld label="Betaald door">
        <select name="coupleId" className={invoer}>
          {huishoudens.map((huishouden) => (
            <option key={huishouden.id} value={huishouden.id}>
              {huishouden.naam}
            </option>
          ))}
        </select>
      </Veld>
      <Veld label={`Percentage voor ${huishoudens[0]?.naam ?? "A"}`}>
        <input
          type="number"
          name="aandeelAPct"
          min={0}
          max={100}
          step={5}
          defaultValue={50}
          className={`${invoer} cijfers`}
        />
      </Veld>

      <div className="flex items-end">
        <button
          disabled={bezig}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {bezig ? "Bezig…" : "Toevoegen"}
        </button>
      </div>

      {state?.fout && (
        <p className="text-sm text-slecht sm:col-span-2 lg:col-span-3">
          {state.fout}
        </p>
      )}
    </form>
  );
}

function Veld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gedempt">{label}</span>
      {children}
    </label>
  );
}
