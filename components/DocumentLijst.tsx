"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import BestandTegel from "./BestandTegel";
import {
  verplaatsDocumentAction,
  verwijderDocumentAction,
} from "@/app/(app)/documenten/actions";

export type DocumentRij = {
  id: number;
  naam: string;
  mime: string;
  grootteBytes: number;
  voorbeeldUrl: string | null;
  expenseId: number | null;
  leverancier: string | null;
  geuploadOp: string;
  geuploadDoor: string;
};

/** Een map in de keuzelijst bij "Verplaatsen", met hoe diep hij in de boom zit. */
export type MapKeuze = { id: number; naam: string; diepte: number };

/**
 * De kale Blob-URL komt nooit in de pagina terecht: deze route geeft de inhoud door en
 * vraagt zelf om een sessie.
 */
function bestandUrl(rij: DocumentRij) {
  return `/api/document/${rij.id}`;
}

const WEERGAVES = ["lijst", "tegels", "compact"] as const;
type Weergave = (typeof WEERGAVES)[number];
const WEERGAVE_SLEUTEL = "documenten-weergave";
const WEERGAVE_GEWIJZIGD = "documenten-weergave-gewijzigd";

/**
 * De gekozen weergave, per apparaat onthouden: op een telefoon wil je misschien
 * tegels, op de laptop een compacte lijst. Op de server en zonder opslag is het de
 * gewone lijst.
 */
function useWeergave(): Weergave {
  return useSyncExternalStore(
    (herteken) => {
      window.addEventListener(WEERGAVE_GEWIJZIGD, herteken);
      window.addEventListener("storage", herteken);
      return () => {
        window.removeEventListener(WEERGAVE_GEWIJZIGD, herteken);
        window.removeEventListener("storage", herteken);
      };
    },
    () => {
      try {
        const waarde = localStorage.getItem(WEERGAVE_SLEUTEL);
        return WEERGAVES.find((w) => w === waarde) ?? "lijst";
      } catch {
        return "lijst";
      }
    },
    () => "lijst",
  );
}

function zetWeergave(weergave: Weergave) {
  try {
    localStorage.setItem(WEERGAVE_SLEUTEL, weergave);
  } catch {
    // Geen opslag (privévenster): dan geldt de keuze niet, maar er gaat niets mis.
  }
  window.dispatchEvent(new Event(WEERGAVE_GEWIJZIGD));
}

function formatGrootte(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** De documenten in deze ene map; welke map dat is, bepaalt het scherm eromheen. */
export default function DocumentLijst({
  rijen,
  mapId,
  mappen,
}: {
  rijen: DocumentRij[];
  mapId: number | null;
  mappen: MapKeuze[];
}) {
  const [zoek, setZoek] = useState("");
  const [teVerplaatsen, setTeVerplaatsen] = useState<DocumentRij | null>(null);
  const [bezigId, setBezigId] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [, start] = useTransition();
  const weergave = useWeergave();

  // Zoeken gebeurt in de browser: bij een paar honderd documenten is een
  // extra query naar de server pure overhead.
  const zichtbaar = rijen.filter((rij) => {
    if (!zoek) return true;
    const term = zoek.toLowerCase();
    return (
      rij.naam.toLowerCase().includes(term) ||
      (rij.leverancier ?? "").toLowerCase().includes(term)
    );
  });

  if (rijen.length === 0) return null;

  function verwijderen(rij: DocumentRij) {
    // Een bon bij een uitgave is het bewijs van die uitgave: dat mag je weten
    // voordat hij weg is.
    const vraag = rij.expenseId
      ? `"${rij.naam}" verwijderen?\n\nDit is de bon bij de uitgave ${rij.leverancier ?? ""}. De uitgave blijft staan, maar zonder deze bon.`
      : `"${rij.naam}" verwijderen?`;
    if (!confirm(vraag)) return;
    setFout(null);
    setBezigId(rij.id);
    start(async () => {
      await verwijderDocumentAction(rij.id);
      setBezigId(null);
    });
  }

  /** Verplaatsen en verwijderen; in elke weergave dezelfde twee knoppen. */
  function acties(rij: DocumentRij, klein: boolean) {
    return (
      <div className="flex shrink-0 gap-0.5">
        <IcoonKnop
          label={`${rij.naam} verplaatsen`}
          tip="Verplaatsen"
          onClick={() => setTeVerplaatsen(rij)}
          disabled={bezigId === rij.id}
          klein={klein}
        >
          <VerplaatsIcoon />
        </IcoonKnop>
        <IcoonKnop
          label={`${rij.naam} verwijderen`}
          tip="Verwijderen"
          onClick={() => verwijderen(rij)}
          disabled={bezigId === rij.id}
          klein={klein}
          gevaar
        >
          <PrullenbakIcoon />
        </IcoonKnop>
      </div>
    );
  }

  function verplaatsen(rij: DocumentRij, doel: number | null) {
    setTeVerplaatsen(null);
    setFout(null);
    setBezigId(rij.id);
    start(async () => {
      const uitkomst = await verplaatsDocumentAction(rij.id, doel);
      if (uitkomst?.fout) setFout(uitkomst.fout);
      setBezigId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Naam of leverancier"
          aria-label="Zoek op naam of leverancier"
          className="min-w-0 flex-1 rounded-xl border border-rand-sterk bg-paneel px-3.5 py-2.5 text-sm"
        />
        <WeergaveKiezer weergave={weergave} kies={zetWeergave} />
      </div>

      {fout && (
        <p className="rounded-xl border border-rand bg-paneel p-3 text-sm text-slecht">
          {fout}
        </p>
      )}

      {zichtbaar.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-6 text-center text-sm text-gedempt">
          Geen documenten gevonden.
        </p>
      ) : weergave === "tegels" ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {zichtbaar.map((rij) => (
            <li
              key={rij.id}
              className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-rand bg-paneel transition ${
                bezigId === rij.id ? "opacity-50" : ""
              }`}
            >
              <a
                href={bestandUrl(rij)}
                target="_blank"
                rel="noreferrer"
                className="relative flex aspect-square items-center justify-center bg-verzonken"
              >
                {rij.voorbeeldUrl ? (
                  <Image
                    src={`${bestandUrl(rij)}?voorbeeld=1`}
                    alt={rij.naam}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <BestandTegel
                    naam={rij.naam}
                    mime={rij.mime}
                    voorbeeldUrl={null}
                    zijde={72}
                  />
                )}
              </a>
              <div className="flex min-w-0 flex-1 flex-col px-2.5 pt-2">
                <a
                  href={bestandUrl(rij)}
                  target="_blank"
                  rel="noreferrer"
                  title={rij.naam}
                  className="line-clamp-2 text-[13px] leading-snug font-medium break-all"
                >
                  {rij.naam}
                </a>
                <div className="mt-auto flex items-end justify-between gap-1 pt-1">
                  <span className="min-w-0 truncate pb-2 text-[11.5px] text-gedempt">
                    {formatGrootte(rij.grootteBytes)}
                  </span>
                  {acties(rij, true)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : weergave === "compact" ? (
        <ul className="divide-y divide-rand overflow-hidden rounded-xl border border-rand bg-paneel">
          {zichtbaar.map((rij) => (
            <li
              key={rij.id}
              className={`flex items-center gap-2.5 py-1 pr-1.5 pl-3 transition ${
                bezigId === rij.id ? "opacity-50" : ""
              }`}
            >
              <BestandTegel
                naam={rij.naam}
                mime={rij.mime}
                voorbeeldUrl={null}
                zijde={30}
              />
              {/* Hier wel afkappen: compact is om snel te scannen. Hele naam bij de muis. */}
              <a
                href={bestandUrl(rij)}
                target="_blank"
                rel="noreferrer"
                title={rij.naam}
                className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
              >
                {rij.naam}
              </a>
              <span className="hidden shrink-0 text-[12px] text-gedempt sm:inline">
                {rij.geuploadDoor}
              </span>
              <span className="w-14 shrink-0 text-right text-[12px] text-gedempt">
                {formatGrootte(rij.grootteBytes)}
              </span>
              {acties(rij, true)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {zichtbaar.map((rij) => (
            <li
              key={rij.id}
              className={`flex items-start gap-3 rounded-xl border border-rand bg-paneel p-3 transition ${
                bezigId === rij.id ? "opacity-50" : ""
              }`}
            >
              {/* De kale Blob-URL komt zo nooit in de pagina terecht: deze route geeft
                  de inhoud door en vraagt zelf om een sessie. */}
              <a
                href={bestandUrl(rij)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
              >
                <BestandTegel
                  naam={rij.naam}
                  mime={rij.mime}
                  voorbeeldUrl={
                    rij.voorbeeldUrl ? `${bestandUrl(rij)}?voorbeeld=1` : null
                  }
                  zijde={56}
                />
              </a>
              <div className="min-w-0 flex-1">
                {/* Bestandsnamen zijn lang en zeggen pas iets aan het eind; afkappen
                    laat je met "Factuur_12205989..." zitten. Liever twee regels. */}
                <a
                  href={bestandUrl(rij)}
                  target="_blank"
                  rel="noreferrer"
                  className="block leading-snug font-medium break-words"
                >
                  {rij.naam}
                </a>
                <p className="mt-0.5 text-sm text-gedempt">
                  {formatGrootte(rij.grootteBytes)} · {rij.geuploadDoor}
                  {rij.expenseId && (
                    <>
                      {" · "}
                      <Link
                        href={`/uitgaven/${rij.expenseId}`}
                        className="text-link underline"
                      >
                        {rij.leverancier || "uitgave"}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="-my-1 -mr-1">
                {acties(rij, false)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {teVerplaatsen && (
        <VerplaatsSheet
          naam={teVerplaatsen.naam}
          huidig={mapId}
          mappen={mappen}
          kies={(doel) => verplaatsen(teVerplaatsen, doel)}
          sluit={() => setTeVerplaatsen(null)}
        />
      )}
    </div>
  );
}

function IcoonKnop({
  label,
  tip,
  onClick,
  disabled,
  gevaar = false,
  klein = false,
  children,
}: {
  label: string;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  gevaar?: boolean;
  /** In tegels en de compacte lijst: kleiner, maar op een telefoon nog goed te raken. */
  klein?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tip}
      className={`flex items-center justify-center rounded-full text-gedempt transition hover:bg-verzonken disabled:opacity-40 ${
        klein ? "h-10 w-9 lg:h-8 lg:w-8" : "h-11 w-11 lg:h-9 lg:w-9"
      } ${gevaar ? "hover:text-slecht" : "hover:text-inkt"}`}
    >
      {children}
    </button>
  );
}

const WEERGAVE_LABELS: Record<Weergave, string> = {
  lijst: "Lijst",
  tegels: "Tegels",
  compact: "Compact",
};

/** Drie iconen naast het zoekveld; hetzelfde ingezakte vlak als de tabbladen elders. */
function WeergaveKiezer({
  weergave,
  kies,
}: {
  weergave: Weergave;
  kies: (weergave: Weergave) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Weergave"
      className="flex shrink-0 gap-0.5 rounded-xl bg-linnen-diep p-1"
    >
      {WEERGAVES.map((w) => {
        const aan = w === weergave;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={aan}
            aria-label={WEERGAVE_LABELS[w]}
            title={WEERGAVE_LABELS[w]}
            onClick={() => kies(w)}
            className={`flex w-10 items-center justify-center rounded-lg transition lg:w-9 ${
              aan
                ? "bg-paneel text-inkt shadow-sm"
                : "text-gedempt hover:text-inkt"
            }`}
          >
            <WeergaveIcoon weergave={w} />
          </button>
        );
      })}
    </div>
  );
}

function WeergaveIcoon({ weergave }: { weergave: Weergave }) {
  const lijn = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      {weergave === "lijst" && (
        <>
          <rect x="3.5" y="4.5" width="5" height="5" rx="1" {...lijn} />
          <rect x="3.5" y="14.5" width="5" height="5" rx="1" {...lijn} />
          <path d="M11.5 6h9M11.5 8.5h6M11.5 16h9M11.5 18.5h6" {...lijn} />
        </>
      )}
      {weergave === "tegels" && (
        <>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" {...lijn} />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" {...lijn} />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" {...lijn} />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" {...lijn} />
        </>
      )}
      {weergave === "compact" && (
        <path d="M4 6h16M4 10h16M4 14h16M4 18h16" {...lijn} />
      )}
    </svg>
  );
}

/**
 * Kies de map waar het document heen moet. De hele boom staat er ingesprongen in, zodat
 * je ook in één keer naar een map ver weg kunt; tikken is meteen verplaatsen.
 */
function VerplaatsSheet({
  naam,
  huidig,
  mappen,
  kies,
  sluit,
}: {
  naam: string;
  huidig: number | null;
  mappen: MapKeuze[];
  kies: (mapId: number | null) => void;
  sluit: () => void;
}) {
  useEffect(() => {
    function toets(e: KeyboardEvent) {
      if (e.key === "Escape") sluit();
    }
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [sluit]);

  const keuzes: { id: number | null; naam: string; diepte: number }[] = [
    { id: null, naam: "Documenten", diepte: 0 },
    ...mappen.map((m) => ({ ...m, diepte: m.diepte + 1 })),
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-inkt-diep/45 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) sluit();
      }}
    >
      <div
        role="dialog"
        aria-label="Verplaatsen naar"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-linnen p-[18px] pb-8 sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="titel text-lg">Verplaatsen naar</span>
          <button
            type="button"
            onClick={sluit}
            className="shrink-0 text-[15px] text-gedempt"
          >
            Sluiten
          </button>
        </div>
        <p className="mb-3 truncate text-[13px] text-gedempt">{naam}</p>
        <ul className="-mx-1 flex flex-col overflow-y-auto">
          {keuzes.map((map) => {
            const hier = map.id === huidig;
            return (
              <li key={map.id ?? "top"}>
                <button
                  type="button"
                  disabled={hier}
                  onClick={() => kies(map.id)}
                  style={{ paddingLeft: `${8 + map.diepte * 18}px` }}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl pr-3 text-left text-[15px] transition hover:bg-verzonken disabled:hover:bg-transparent sm:min-h-10"
                >
                  <MapIcoon />
                  <span
                    className={`min-w-0 flex-1 truncate ${hier ? "text-gedempt" : ""}`}
                  >
                    {map.naam}
                  </span>
                  {hier && (
                    <span className="shrink-0 text-[12px] text-gedempt">
                      staat hier
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const mapPad =
  "M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1z";

function MapIcoon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      className="shrink-0 text-gedempt"
    >
      <path
        d={mapPad}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VerplaatsIcoon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
      <path
        d={mapPad}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 13h6m-2.3-2.4L15 13l-2.3 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrullenbakIcoon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
      <path
        d="M4.5 7h15M9.5 7V5.2a.7.7 0 0 1 .7-.7h3.6a.7.7 0 0 1 .7.7V7m-8 0 .8 11.6a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17.5 7M10.2 10.5v5.5m3.6-5.5v5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
