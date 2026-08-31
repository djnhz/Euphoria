"use client";

import { useActionState, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import BestandTegel from "./BestandTegel";
import { formatEuro, parseEuro, verdeelRegel } from "@/lib/geld";
import { formatDatum, vandaag } from "@/lib/datum";
import { bestandHash } from "@/lib/bestandhash";
import {
  analyseerDocumentAction,
  bewaarBonAction,
  zoekBonAction,
  type BestaandeBon,
  type BewaardeBon,
  type BewaarState,
} from "@/app/(app)/uitgaven/actions";

/** `budgetItemId` is de post die deze categorie standaard meebrengt; 0 is geen. */
export type Categorie = { id: number; naam: string; budgetItemId: number };
export type BegrotingsPost = { id: number; naam: string };
export type Huishouden = { id: number; naam: string; volgorde: number };

export type FormulierRegel = {
  sleutel: string;
  omschrijving: string;
  aantal: number;
  bedrag: string;
  categoryId: number;
  /** Begrotingspost van deze regel; 0 betekent "geen". */
  budgetItemId: number;
  aandeelAPct: number;
  bron: "handmatig" | "ai";
};

export type Beginwaarden = {
  datum: string;
  leverancier: string;
  opmerking: string;
  coupleId: number;
  regels: FormulierRegel[];
  bonnen: BewaardeBon[];
};

let teller = 0;
const nieuweSleutel = () => `regel-${teller++}`;

export function legeRegel(categoryId: number, budgetItemId = 0): FormulierRegel {
  return {
    sleutel: nieuweSleutel(),
    omschrijving: "",
    aantal: 1,
    bedrag: "",
    categoryId,
    budgetItemId,
    aandeelAPct: 50,
    bron: "handmatig",
  };
}

export default function UitgaveFormulier({
  categorieen,
  posten,
  huishoudens,
  begin,
  actie,
  knopLabel,
  heeftBlob,
  heeftSleutel,
}: {
  categorieen: Categorie[];
  /** Begrotingsposten; los van de categorieen en dus een eigen keuze. */
  posten: BegrotingsPost[];
  huishoudens: Huishouden[];
  begin?: Partial<Beginwaarden>;
  actie: (vorige: BewaarState, formData: FormData) => Promise<BewaarState>;
  knopLabel: string;
  /** Met Blob gaat de browser er rechtstreeks heen; anders via de eigen uploadroute. */
  heeftBlob: boolean;
  /** Zonder OpenAI-sleutel heeft een analyseknop geen zin. */
  heeftSleutel: boolean;
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
  /**
   * De post van de bon als geheel. Hem hier zetten schrijft alle regels over; per
   * regel afwijken mag daarna. Staan de regels niet op een lijn, dan toont dit veld
   * "gemengd" en laat het de regels met rust tot je echt iets kiest.
   */
  const bonPost = regels.every((r) => r.budgetItemId === regels[0].budgetItemId)
    ? regels[0].budgetItemId
    : -1;
  function zetBonPost(budgetItemId: number) {
    setRegels((huidig) => huidig.map((r) => ({ ...r, budgetItemId })));
  }

  const [bonnen, setBonnen] = useState<BewaardeBon[]>(begin?.bonnen ?? []);
  const [bezigMetUpload, setBezigMetUpload] = useState(false);
  const [dubbel, setDubbel] = useState<Dubbelvraag | null>(null);
  const [bezigMetAnalyse, setBezigMetAnalyse] = useState<number | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

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

  /**
   * Een categorie kan een vaste begrotingspost hebben. Die neemt de regel dan over,
   * want dat is precies waarvoor die koppeling er is. Heeft de categorie er geen,
   * dan blijft staan wat er stond.
   */
  function kiesCategorie(sleutel: string, categoryId: number) {
    const post = categorieen.find((c) => c.id === categoryId)?.budgetItemId ?? 0;
    pasRegelAan(sleutel, {
      categoryId,
      ...(post > 0 ? { budgetItemId: post } : {}),
    });
  }

  /** De post die bij een categorie hoort, met de keuze op de bon als terugval. */
  function postVoor(categoryId: number, terugval: number) {
    const post = categorieen.find((c) => c.id === categoryId)?.budgetItemId ?? 0;
    return post > 0 ? post : terugval;
  }

  /**
   * Uploaden en bewaren. Gebeurt altijd; het uitlezen is een aparte stap.
   *
   * Eerst wordt gekeken of ditzelfde bestand er al is. Dat gaat op inhoud, dus ook een
   * foto die je onder een andere naam nog eens kiest valt op. Met `negeerDubbel` ga je
   * er alsnog overheen; dat is wat de knop in de waarschuwing doet.
   */
  async function verwerkBestand(bestand: File, negeerDubbel = false) {
    setBezigMetUpload(true);
    setMelding(null);
    setDubbel(null);
    try {
      const hash = await bestandHash(bestand);
      if (hash && !negeerDubbel) {
        const alBijgevoegd = bonnen.find((bon) => bon.hash === hash);
        if (alBijgevoegd) {
          setMelding(
            `Dit bestand hangt al aan deze uitgave, als "${alBijgevoegd.naam}".`,
          );
          return;
        }
        const bestaand = await zoekBonAction(hash);
        if (bestaand) {
          setDubbel({ bestand, bestaand });
          return;
        }
      }

      let url: string;
      let opslag: "blob" | "lokaal";

      if (heeftBlob) {
        // Rechtstreeks naar Blob: dat omzeilt de limiet van 4,5 MB op wat een
        // server-actie mag ontvangen, zodat een telefoonfoto gewoon binnenkomt.
        const blob = await upload(bestand.name, bestand, {
          access: "public",
          handleUploadUrl: "/api/blob",
        });
        url = blob.url;
        opslag = "blob";
      } else {
        const formulier = new FormData();
        formulier.set("bestand", bestand);
        const antwoord = await fetch("/api/upload", {
          method: "POST",
          body: formulier,
        });
        const uitkomst = (await antwoord.json()) as {
          url?: string;
          fout?: string;
        };
        if (!antwoord.ok || !uitkomst.url) {
          throw new Error(uitkomst.fout ?? "Uploaden mislukt.");
        }
        url = uitkomst.url;
        opslag = "lokaal";
      }

      const bewaard = await bewaarBonAction({
        url,
        opslag,
        naam: bestand.name,
        mime: bestand.type || "application/octet-stream",
        grootteBytes: bestand.size,
        hash,
      });
      setBonnen((huidig) => [...huidig, bewaard]);
      setMelding(`${bestand.name} is opgeslagen.`);
    } catch (fout) {
      setMelding(`Opslaan mislukt: ${(fout as Error).message}`);
    } finally {
      setBezigMetUpload(false);
    }
  }

  /** Het bestand dat er al staat erbij pakken in plaats van het nog eens uploaden. */
  function gebruikBestaande(bestaand: BestaandeBon) {
    setDubbel(null);
    setBonnen((huidig) => [...huidig, bestaand]);
    setMelding(`${bestaand.naam} is erbij gezet; het stond al in de app.`);
  }

  async function analyseer(documentId: number) {
    setBezigMetAnalyse(documentId);
    setMelding(null);
    try {
      const antwoord = await analyseerDocumentAction(documentId);
      if (antwoord.fout || !antwoord.bon) {
        setMelding(
          `${antwoord.fout ?? "Uitlezen mislukt."} Je kunt de regels zelf invullen.`,
        );
        return;
      }

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
        // Het model kent de posten niet, dus die komen uit de categoriekoppeling,
        // en anders uit wat er op de bon staat.
        budgetItemId: postVoor(
          categorieen.find((c) => c.naam === regel.categorieSuggestie)?.id ??
            standaardCategorie,
          bonPost > 0 ? bonPost : 0,
        ),
        aandeelAPct: 50,
        bron: "ai",
      }));

      if (uitBon.length === 0) {
        setMelding("Er zijn geen regels uit deze bon te halen.");
        return;
      }
      // Lege beginregels weggooien, ingevulde regels behouden.
      setRegels((huidig) => [
        ...huidig.filter(
          (r) => r.omschrijving.trim() !== "" || r.bedrag.trim() !== "",
        ),
        ...uitBon,
      ]);
      setMelding(
        `${uitBon.length} regel${uitBon.length === 1 ? "" : "s"} uitgelezen. Controleer ze even.`,
      );
    } catch (fout) {
      setMelding(`Uitlezen mislukt: ${(fout as Error).message}`);
    } finally {
      setBezigMetAnalyse(null);
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
      budgetItemId: r.budgetItemId > 0 ? r.budgetItemId : null,
      aandeelAPct: r.aandeelAPct,
      bron: r.bron,
    })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <label className="block text-sm font-medium">Bon of factuur</label>
        <p className="mb-3 text-xs text-gedempt">
          Uitlezen doe je zelf, met de knop bij het bestand.
        </p>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          disabled={bezigMetUpload}
          onChange={(e) => {
            const bestand = e.target.files?.[0];
            if (bestand) void verwerkBestand(bestand);
            e.target.value = "";
          }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
        />
        {bezigMetUpload && (
          <p className="mt-3 text-sm text-gedempt">Opslaan…</p>
        )}
        {dubbel && (
          <DubbelWaarschuwing
            vraag={dubbel}
            opnieuw={() => void verwerkBestand(dubbel.bestand, true)}
            gebruikBestaande={() => gebruikBestaande(dubbel.bestaand)}
            annuleer={() => setDubbel(null)}
          />
        )}
        {melding && (
          <p className="mt-3 rounded-lg bg-accent-zacht p-3 text-sm">{melding}</p>
        )}

        {bonnen.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-4">
            {bonnen.map((bon) => (
              <li key={bon.documentId} className="w-28">
                <a
                  href={bon.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`${bon.naam} — origineel openen`}
                >
                  <BestandTegel
                    naam={bon.naam}
                    mime={bon.mime}
                    voorbeeldUrl={bon.voorbeeldUrl}
                    zijde={112}
                  />
                </a>
                <p className="mt-1 truncate text-xs text-gedempt" title={bon.naam}>
                  {bon.naam}
                </p>
                {bon.analyseerbaar ? (
                  <button
                    type="button"
                    disabled={bezigMetAnalyse !== null || !heeftSleutel}
                    onClick={() => void analyseer(bon.documentId)}
                    title={
                      heeftSleutel
                        ? undefined
                        : "Stel eerst een OpenAI-sleutel in bij Instellingen"
                    }
                    className="mt-2 w-full rounded-lg border border-rand px-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    {bezigMetAnalyse === bon.documentId
                      ? "Uitlezen…"
                      : "Analyseren"}
                  </button>
                ) : (
                  <p className="mt-2 text-center text-xs text-gedempt">
                    niet uitleesbaar
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {bonnen.length > 0 && !heeftSleutel && (
          <p className="mt-3 text-xs text-gedempt">
            Analyseren kan zodra er een OpenAI-sleutel staat bij Instellingen.
          </p>
        )}
      </section>

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
        {/* De post van de hele bon. Kiezen zet alle regels om; daarna kun je er per
            regel van afwijken, en dan staat hier "gemengd". */}
        <Veld label="Begroting">
          <select
            value={bonPost}
            onChange={(e) => zetBonPost(Number(e.target.value))}
            className={invoerKlasse}
          >
            {bonPost === -1 && <option value={-1}>gemengd</option>}
            <option value={0}>geen post</option>
            {posten.map((post) => (
              <option key={post.id} value={post.id}>
                {post.naam}
              </option>
            ))}
          </select>
        </Veld>
      </section>

      <section className="rounded-xl border border-rand bg-paneel p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-medium">Regels</h2>
          <button
            type="button"
            onClick={() =>
              setRegels((r) => [
                ...r,
                legeRegel(
                  standaardCategorie,
                  postVoor(standaardCategorie, bonPost > 0 ? bonPost : 0),
                ),
              ])
            }
            className="text-sm text-accent underline"
          >
            + regel
          </button>
        </div>
        <p className="mb-3 text-xs text-gedempt">
          Het percentage per regel is het deel voor {naamA}; de rest gaat naar {naamB}.
        </p>

        <div className="flex flex-col gap-4">
          {regels.map((regel) => (
            <div
              key={regel.sleutel}
              className="grid grid-cols-2 gap-2 rounded-lg border border-rand p-3 sm:grid-cols-[1fr_5rem_7rem_auto]"
            >
              <input
                value={regel.omschrijving}
                onChange={(e) =>
                  pasRegelAan(regel.sleutel, { omschrijving: e.target.value })
                }
                placeholder="Omschrijving"
                className={`${invoerKlasse} col-span-2 sm:col-span-1`}
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
                className="col-span-2 justify-self-start text-sm text-gedempt underline sm:col-span-1 sm:self-center"
              >
                verwijder
              </button>

              <div className="col-span-2 grid gap-2 sm:col-span-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <select
                  value={regel.categoryId}
                  onChange={(e) => kiesCategorie(regel.sleutel, Number(e.target.value))}
                  aria-label="Categorie"
                  className={invoerKlasse}
                >
                  {categorieen.map((categorie) => (
                    <option key={categorie.id} value={categorie.id}>
                      {categorie.naam}
                    </option>
                  ))}
                </select>
                {/* Afwijken van de post die boven voor de hele bon staat. */}
                <select
                  value={regel.budgetItemId}
                  onChange={(e) =>
                    pasRegelAan(regel.sleutel, {
                      budgetItemId: Number(e.target.value),
                    })
                  }
                  aria-label="Begrotingspost"
                  className={invoerKlasse}
                >
                  <option value={0}>geen post</option>
                  {posten.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.naam}
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
                    className={`${smalInvoerKlasse} cijfers`}
                  />
                  <span className="text-gedempt">% {naamA}</span>
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
        disabled={bewaren || bezigMetUpload || bezigMetAnalyse !== null}
        className="rounded-lg bg-accent px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {bewaren ? "Bezig…" : knopLabel}
      </button>
    </form>
  );
}

/** Een gekozen bestand dat volgens de inhoud al in de app staat. */
type Dubbelvraag = { bestand: File; bestaand: BestaandeBon };

/**
 * Weigeren zou verkeerd zijn: soms wil je twee bonnen die toevallig gelijk zijn. Dus
 * melden wat er al staat, en jij kiest wat er gebeurt.
 */
function DubbelWaarschuwing({
  vraag,
  opnieuw,
  gebruikBestaande,
  annuleer,
}: {
  vraag: Dubbelvraag;
  opnieuw: () => void;
  gebruikBestaande: () => void;
  annuleer: () => void;
}) {
  const { bestaand } = vraag;
  const geupload = formatDatum(bestaand.geuploadOp.slice(0, 10));

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-rand bg-accent-zacht p-3 text-sm">
      <p>
        <strong>Dit bestand staat er al.</strong> Op {geupload} ingeladen als{" "}
        <span className="break-all">{bestaand.naam}</span>
        {bestaand.uitgave ? (
          <>
            , gekoppeld aan de uitgave van {formatDatum(bestaand.uitgave.datum)}
            {bestaand.uitgave.leverancier && ` bij ${bestaand.uitgave.leverancier}`}.
          </>
        ) : (
          <> in de map {bestaand.map}, nog niet aan een uitgave gekoppeld.</>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {bestaand.uitgave ? (
          <a
            href={`/uitgaven/${bestaand.uitgave.id}`}
            className="rounded-lg border border-rand bg-paneel px-3 py-2 text-sm"
          >
            Naar die uitgave
          </a>
        ) : (
          <button
            type="button"
            onClick={gebruikBestaande}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            Bestaand bestand gebruiken
          </button>
        )}
        <button
          type="button"
          onClick={opnieuw}
          className="rounded-lg border border-rand bg-paneel px-3 py-2 text-sm"
        >
          Toch nog een keer opslaan
        </button>
        <button
          type="button"
          onClick={annuleer}
          className="text-sm text-gedempt underline"
        >
          laat maar
        </button>
      </div>
    </div>
  );
}

const veldStijl = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";
const invoerKlasse = `w-full ${veldStijl}`;
// Apart, want `w-20` naast `w-full` in een klassenlijst is een gok welke wint.
const smalInvoerKlasse = `w-20 shrink-0 ${veldStijl}`;

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
