"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { formatEuro, parseEuro, verdeelRegel } from "@/lib/geld";
import { vandaag } from "@/lib/datum";
import {
  analyseerUploadAction,
  type BewaarState,
} from "@/app/(app)/uitgaven/actions";

export type Categorie = { id: number; naam: string };
export type Huishouden = { id: number; naam: string; volgorde: number };

export type FormulierRegel = {
  sleutel: string;
  omschrijving: string;
  aantal: number;
  bedrag: string;
  categoryId: number;
  aandeelAPct: number;
  bron: "handmatig" | "ai";
};

export type FormulierBon = {
  documentId: number;
  naam: string;
  voorbeeldUrl: string | null;
  url: string | null;
};

export type Beginwaarden = {
  datum: string;
  leverancier: string;
  opmerking: string;
  coupleId: number;
  regels: FormulierRegel[];
  bonnen: FormulierBon[];
};

let teller = 0;
const nieuweSleutel = () => `regel-${teller++}`;

export function legeRegel(categoryId: number): FormulierRegel {
  return {
    sleutel: nieuweSleutel(),
    omschrijving: "",
    aantal: 1,
    bedrag: "",
    categoryId,
    aandeelAPct: 50,
    bron: "handmatig",
  };
}

export default function UitgaveFormulier({
  categorieen,
  huishoudens,
  begin,
  actie,
  toonUpload,
  knopLabel,
}: {
  categorieen: Categorie[];
  huishoudens: Huishouden[];
  begin?: Partial<Beginwaarden>;
  actie: (vorige: BewaarState, formData: FormData) => Promise<BewaarState>;
  toonUpload: boolean;
  knopLabel: string;
}) {
  const standaardCategorie =
    categorieen.find((c) => c.naam === "Overig")?.id ?? categorieen[0]?.id ?? 0;

  const [datum, setDatum] = useState(begin?.datum ?? vandaag());
  const [leverancier, setLeverancier] = useState(begin?.leverancier ?? "");
  const [opmerking, setOpmerking] = useState(begin?.opmerking ?? "");
  const [coupleId, setCoupleId] = useState(
    begin?.coupleId ?? huishoudens[0]?.id ?? 0,
  );
  const [regels, setRegels] = useState<FormulierRegel[]>(
    begin?.regels?.length ? begin.regels : [legeRegel(standaardCategorie)],
  );
  const [bonnen, setBonnen] = useState<FormulierBon[]>(begin?.bonnen ?? []);
  const [bezigMetBon, setBezigMetBon] = useState(false);
  const [analyseFout, setAnalyseFout] = useState<string | null>(null);

  const [state, formAction, bewaren] = useActionState<BewaarState, FormData>(
    actie,
    null,
  );

  const naamA = huishoudens[0]?.naam ?? "A";
  const naamB = huishoudens[1]?.naam ?? "B";

  const totalen = useMemo(() => {
    let totaal = 0;
    let deelA = 0;
    for (const regel of regels) {
      const cent = parseEuro(regel.bedrag) ?? 0;
      totaal += cent;
      deelA += verdeelRegel(cent, regel.aandeelAPct).deelA;
    }
    return { totaal, deelA, deelB: totaal - deelA };
  }, [regels]);

  function pasRegelAan(sleutel: string, wijziging: Partial<FormulierRegel>) {
    setRegels((huidig) =>
      huidig.map((r) => (r.sleutel === sleutel ? { ...r, ...wijziging } : r)),
    );
  }

  async function verwerkBestand(bestand: File) {
    setBezigMetBon(true);
    setAnalyseFout(null);
    try {
      // Het origineel gaat ongewijzigd naar Blob; verkleinen gebeurt pas serverside
      // voor de kopie die het model leest.
      const blob = await upload(bestand.name, bestand, {
        access: "public",
        handleUploadUrl: "/api/blob",
      });
      const antwoord = await analyseerUploadAction({
        url: blob.url,
        naam: bestand.name,
        mime: bestand.type || "application/octet-stream",
        grootteBytes: bestand.size,
      });

      setBonnen((huidig) => [
        ...huidig,
        {
          documentId: antwoord.documentId,
          naam: bestand.name,
          voorbeeldUrl: antwoord.voorbeeldUrl,
          url: blob.url,
        },
      ]);
      setAnalyseFout(antwoord.fout);

      if (antwoord.bon) {
        const bon = antwoord.bon;
        if (bon.datum) setDatum(bon.datum);
        if (bon.leverancier) setLeverancier(bon.leverancier);
        const uitBon = bon.regels.map<FormulierRegel>((regel) => ({
          sleutel: nieuweSleutel(),
          omschrijving: regel.omschrijving,
          aantal: Math.max(1, Math.round(regel.aantal || 1)),
          bedrag: (regel.bedragCent / 100).toFixed(2).replace(".", ","),
          categoryId:
            categorieen.find((c) => c.naam === regel.categorieSuggestie)?.id ??
            standaardCategorie,
          aandeelAPct: 50,
          bron: "ai",
        }));
        if (uitBon.length > 0) {
          // Lege beginregel weggooien, ingevulde regels behouden.
          setRegels((huidig) => {
            const gevuld = huidig.filter(
              (r) => r.omschrijving.trim() !== "" || r.bedrag.trim() !== "",
            );
            return [...gevuld, ...uitBon];
          });
        }
      }
    } catch (fout) {
      setAnalyseFout((fout as Error).message);
    } finally {
      setBezigMetBon(false);
    }
  }

  const payload = JSON.stringify({
    datum,
    leverancier,
    opmerking,
    coupleId,
    documentIds: bonnen.map((b) => b.documentId),
    regels: regels.map((r) => ({
      omschrijving: r.omschrijving.trim() || "Onbenoemd",
      aantal: r.aantal,
      bedragCent: parseEuro(r.bedrag) ?? 0,
      categoryId: r.categoryId,
      aandeelAPct: r.aandeelAPct,
      bron: r.bron,
    })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      {toonUpload && (
        <section className="rounded-xl border border-rand bg-paneel p-4">
          <label className="block text-sm font-medium">Bon of factuur</label>
          <p className="mb-3 text-xs text-gedempt">
            Het origineel wordt op volledige resolutie bewaard. Alleen een
            verkleinde kopie gaat naar de analyse.
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            disabled={bezigMetBon}
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) void verwerkBestand(bestand);
              e.target.value = "";
            }}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
          />
          {bezigMetBon && (
            <p className="mt-3 text-sm text-gedempt">
              Uploaden en uitlezen… dit duurt een paar tellen.
            </p>
          )}
          {analyseFout && (
            <p className="mt-3 rounded-lg bg-accent-zacht p-3 text-sm">
              {analyseFout} Je kunt de regels hieronder gewoon zelf invullen.
            </p>
          )}
          {bonnen.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-3">
              {bonnen.map((bon) => (
                <li key={bon.documentId}>
                  <a
                    href={bon.url ?? bon.voorbeeldUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                    title={`${bon.naam} — origineel openen`}
                  >
                    {bon.voorbeeldUrl ? (
                      <Image
                        src={bon.voorbeeldUrl}
                        alt={bon.naam}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-20 w-20 rounded-lg border border-rand object-cover"
                      />
                    ) : (
                      <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-rand text-xs text-gedempt">
                        bestand
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-3 rounded-xl border border-rand bg-paneel p-4 sm:grid-cols-2">
        <Veld label="Datum">
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
            className={invoerKlasse}
          />
        </Veld>
        <Veld label="Leverancier">
          <input
            value={leverancier}
            onChange={(e) => setLeverancier(e.target.value)}
            placeholder="Bijvoorbeeld: Watersport Hoekstra"
            className={invoerKlasse}
          />
        </Veld>
        <Veld label="Betaald door">
          <select
            value={coupleId}
            onChange={(e) => setCoupleId(Number(e.target.value))}
            className={invoerKlasse}
          >
            {huishoudens.map((huishouden) => (
              <option key={huishouden.id} value={huishouden.id}>
                {huishouden.naam}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Opmerking">
          <input
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            className={invoerKlasse}
          />
        </Veld>
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Regels</h2>
          <button
            type="button"
            onClick={() =>
              setRegels((r) => [
                ...r,
                { ...legeRegel(standaardCategorie), aandeelAPct: 50 },
              ])
            }
            className="text-sm text-accent underline"
          >
            + regel
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {regels.map((regel) => (
            <div
              key={regel.sleutel}
              className="grid gap-2 rounded-lg border border-rand p-3 sm:grid-cols-[1fr_5rem_7rem_auto]"
            >
              <input
                value={regel.omschrijving}
                onChange={(e) =>
                  pasRegelAan(regel.sleutel, { omschrijving: e.target.value })
                }
                placeholder="Omschrijving"
                className={invoerKlasse}
              />
              <input
                type="number"
                min={1}
                value={regel.aantal}
                onChange={(e) =>
                  pasRegelAan(regel.sleutel, {
                    aantal: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                aria-label="Aantal"
                className={`${invoerKlasse} cijfers`}
              />
              <input
                inputMode="decimal"
                value={regel.bedrag}
                onChange={(e) =>
                  pasRegelAan(regel.sleutel, { bedrag: e.target.value })
                }
                placeholder="0,00"
                aria-label="Bedrag in euro"
                className={`${invoerKlasse} cijfers`}
              />
              <button
                type="button"
                onClick={() =>
                  setRegels((r) =>
                    r.length === 1
                      ? r
                      : r.filter((x) => x.sleutel !== regel.sleutel),
                  )
                }
                className="justify-self-start text-sm text-gedempt underline sm:self-center"
              >
                verwijder
              </button>

              <div className="sm:col-span-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  value={regel.categoryId}
                  onChange={(e) =>
                    pasRegelAan(regel.sleutel, {
                      categoryId: Number(e.target.value),
                    })
                  }
                  aria-label="Categorie"
                  className={invoerKlasse}
                >
                  {categorieen.map((categorie) => (
                    <option key={categorie.id} value={categorie.id}>
                      {categorie.naam}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={regel.aandeelAPct}
                    onChange={(e) =>
                      pasRegelAan(regel.sleutel, {
                        aandeelAPct: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    aria-label={`Percentage voor ${naamA}`}
                    className={`${invoerKlasse} cijfers w-20`}
                  />
                  <span className="text-gedempt">
                    % {naamA}, rest {naamB}
                  </span>
                  {regel.bron === "ai" && (
                    <span className="rounded-full bg-accent-zacht px-2 py-0.5 text-xs text-accent">
                      uit bon
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-rand pt-3 text-sm">
          <div>
            <dt className="inline text-gedempt">Totaal: </dt>
            <dd className="cijfers inline font-medium">
              {formatEuro(totalen.totaal)}
            </dd>
          </div>
          <div>
            <dt className="inline text-gedempt">{naamA}: </dt>
            <dd className="cijfers inline">{formatEuro(totalen.deelA)}</dd>
          </div>
          <div>
            <dt className="inline text-gedempt">{naamB}: </dt>
            <dd className="cijfers inline">{formatEuro(totalen.deelB)}</dd>
          </div>
        </dl>
      </section>

      {state?.fout && <p className="text-sm text-slecht">{state.fout}</p>}

      <button
        disabled={bewaren || bezigMetBon}
        className="rounded-lg bg-accent px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {bewaren ? "Bezig…" : knopLabel}
      </button>
    </form>
  );
}

const invoerKlasse =
  "w-full rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

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
