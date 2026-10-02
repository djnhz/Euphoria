"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  nieuweTaakAction,
  verwijderTaakAction,
  wijzigTaakAction,
  zetKlaarAction,
  type TaakState,
} from "@/app/(app)/taken/actions";
import { initialen } from "./GebruikerMenu";
import { formatDatum } from "@/lib/datum";
import { huishoudKleur } from "@/lib/kleuren";
import { toegekenden } from "@/lib/toekennen";

export type TaakInvoer = {
  id: number;
  titel: string;
  toelichting: string;
  postId: number | null;
  postNaam: string | null;
  postKleur: string | null;
  deadline: string | null;
  soort: "gewoon" | "winterklaar";
  samen: boolean;
  userId: number | null;
  userNaam: string | null;
  coupleId: number | null;
  coupleNaam: string | null;
  klaar: boolean;
  klaarDoorNaam: string | null;
  klaarOp: Date | string | null;
  helpers: { userId: number; naam: string; coupleId: number }[];
};

export type Keuze = { id: number; naam: string; kleur?: string };

/** Iemand aan wie een taak toe te kennen is. */
export type Mens = {
  id: number;
  naam: string;
  coupleId: number;
  coupleNaam: string;
};

/**
 * Een taak in een lijst: het rondje om af te vinken, de titel met waar hij bij
 * hoort, en rechts de datum of degene die hem oppakt. De hele regel opent het
 * formulier -- alleen het rondje vinkt af.
 */
export function TaakRij({
  taak,
  huishoudens,
  mensen = [],
  jij,
  toonSoort = false,
}: {
  taak: TaakInvoer;
  huishoudens: Keuze[];
  /** Voor het toekennen in het wijzigblad van een winterklaar-taak. */
  mensen?: Mens[];
  jij: number;
  /**
   * Open en Winterklaar zijn gescheiden lijsten, dus daar zegt een label niets dat
   * het tabblad niet al zegt. Alleen op Klaar staan ze door elkaar.
   */
  toonSoort?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, start] = useTransition();
  const wie = wieLijst(taak, mensen);

  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <button
        type="button"
        aria-pressed={taak.klaar}
        aria-label={taak.klaar ? "Terugzetten naar open" : "Afvinken"}
        disabled={bezig}
        onClick={() => start(() => zetKlaarAction(taak.id, !taak.klaar))}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] transition ${
          taak.klaar
            ? "bg-salie text-white"
            : "border-[1.5px] border-[rgba(22,40,63,0.28)] hover:border-inkt"
        } ${bezig ? "opacity-50" : ""}`}
      >
        {taak.klaar && "✓"}
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <span
          className={`truncate text-sm font-semibold ${
            taak.klaar ? "font-normal text-zacht line-through" : "text-inkt"
          }`}
        >
          {taak.titel}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-gedempt">
          {toonSoort && taak.soort === "winterklaar" && <WinterLabel />}
          <span className="truncate">{onderregel(taak)}</span>
        </span>
      </button>

      {/* Rechts: eerst wie eraan hangt, dan de datum. Zo staan de datums van alle
          rijen onder elkaar op dezelfde plek, ook als het aantal bolletjes wisselt. */}
      {(wie.length > 0 || (!taak.klaar && taak.deadline)) && (
        <span className="flex shrink-0 items-center gap-2.5">
          {wie.length > 0 && (
            <span className="flex" aria-hidden>
              {wie.map((m, i) => (
                <span
                  key={m.id}
                  style={{ marginLeft: i === 0 ? 0 : -7 }}
                  title={m.naam}
                >
                  <Bolletje
                    naam={m.naam}
                    kleur={huishoudKleur(
                      Math.max(
                        0,
                        huishoudens.findIndex((hh) => hh.id === m.coupleId),
                      ),
                    )}
                    rand
                  />
                </span>
              ))}
            </span>
          )}
          {!taak.klaar && taak.deadline && (
            <span className="cijfers w-[52px] rounded-md bg-messing-tint py-1 text-center text-[10.5px] font-semibold whitespace-nowrap text-messing-inkt">
              {kort(taak.deadline)}
            </span>
          )}
        </span>
      )}

      {open && (
        <TaakSheet
          taak={taak}
          huishoudens={huishoudens}
          mensen={mensen}
          jij={jij}
          sluit={() => setOpen(false)}
        />
      )}
    </li>
  );
}

/** De zwevende knop onderaan het takenscherm. */
export function TaakToevoegen({
  huishoudens,
  mensen = [],
  jij,
  inKop = false,
  soort = "gewoon",
}: {
  huishoudens: Keuze[];
  mensen?: Mens[];
  jij: number;
  /** In de kop staat hij als gewone knop; onderaan zweeft hij boven de lijst. */
  inKop?: boolean;
  /**
   * Welke lijst je aanvult. Elk tabblad voegt zijn eigen soort taak toe: het scherm
   * weet waar je bent, dus er valt niets te kiezen.
   */
  soort?: TaakInvoer["soort"];
}) {
  const [open, setOpen] = useState(false);
  const knoptekst =
    soort === "winterklaar" ? "Winterklaar-taak toevoegen" : "Taak toevoegen";

  if (inKop) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen transition hover:bg-inkt-hover lg:block"
        >
          {knoptekst}
        </button>
        {open && (
          <TaakSheet
            taak={null}
            soort={soort}
            huishoudens={huishoudens}
            mensen={mensen}
            jij={jij}
            sluit={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 px-[18px] lg:hidden">
        <div className="mx-auto w-full max-w-[1400px] lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-2xl bg-inkt px-4 py-3.5 text-[15px] font-semibold text-linnen shadow-[0_12px_24px_-10px_rgba(22,40,63,0.6)] transition hover:bg-inkt-hover"
          >
            {knoptekst}
          </button>
        </div>
      </div>
      {open && (
        <TaakSheet
          taak={null}
          soort={soort}
          huishoudens={huishoudens}
          mensen={mensen}
          jij={jij}
          sluit={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Nieuw en wijzigen in hetzelfde blad. Het verschil is één verborgen veld en de
 * verwijderknop; de velden zelf zijn gelijk, dus twee formulieren zouden alleen uit
 * de pas gaan lopen.
 */
function TaakSheet({
  taak,
  soort: nieuweSoort = "gewoon",
  huishoudens,
  mensen = [],
  jij,
  sluit,
}: {
  taak: TaakInvoer | null;
  /** Voor een nieuwe taak: de lijst waar je op staat. Een bestaande houdt zijn eigen soort. */
  soort?: TaakInvoer["soort"];
  huishoudens: Keuze[];
  mensen?: Mens[];
  jij: number;
  sluit: () => void;
}) {
  const soort = taak?.soort ?? nieuweSoort;
  /**
   * Elke taak kent je toe aan een of meer personen. Een gewone taak heeft daarbij
   * een moment ("uiterlijk"), een winterklaar-taak niet: het is wat er aan het eind
   * van het seizoen moet gebeuren. Wat het formulier niet meestuurt, laat de server
   * met rust.
   */
  const winter = soort === "winterklaar";
  const [state, actie, bezig] = useActionState<TaakState, FormData>(
    taak ? wijzigTaakAction : nieuweTaakAction,
    null,
  );
  const [wissen, startWissen] = useTransition();
  // Pas "Annuleren" als er iets is aangepast; anders is er niets om weg te gooien.
  const [vuil, zetVuil] = useState(false);

  // Sluiten zodra het is opgeslagen; de lijst eronder is dan al bijgewerkt.
  useEffect(() => {
    if (state?.gelukt) sluit();
  }, [state, sluit]);

  useEffect(() => {
    function toets(e: KeyboardEvent) {
      if (e.key === "Escape") sluit();
    }
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [sluit]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-inkt-diep/45 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) sluit();
      }}
    >
      <form
        action={actie}
        onChange={() => zetVuil(true)}
        className="max-h-[88vh] w-full max-w-md overflow-auto rounded-t-3xl bg-linnen p-[18px] pb-8 sm:rounded-3xl"
      >
        {taak && <input type="hidden" name="id" value={taak.id} />}
        <input type="hidden" name="soort" value={soort} />
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={sluit}
            className="shrink-0 text-[15px] whitespace-nowrap text-gedempt"
          >
            {vuil ? "Annuleren" : "Sluiten"}
          </button>
          {/* Kort houden: op een telefoon moet dit tussen twee knoppen passen. */}
          <span className="titel min-w-0 truncate px-2 text-lg">
            {taak
              ? "Taak wijzigen"
              : soort === "winterklaar"
                ? "Winterklaar-taak"
                : "Nieuwe taak"}
          </span>
          <button
            type="submit"
            disabled={bezig}
            className="shrink-0 text-[15px] font-semibold whitespace-nowrap text-inkt disabled:text-zacht"
          >
            {bezig ? "Bezig…" : "Taak opslaan"}
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <Veld label="Wat moet er gebeuren">
            <input
              name="titel"
              defaultValue={taak?.titel ?? ""}
              required
              maxLength={120}
              autoFocus={!taak}
              className={invoer}
            />
          </Veld>

          <Veld label="Toelichting">
            <textarea
              name="toelichting"
              defaultValue={taak?.toelichting ?? ""}
              rows={2}
              maxLength={500}
              className={`${invoer} resize-none`}
            />
          </Veld>

          {!winter && (
            <Veld label="Uiterlijk">
              <input
                type="date"
                name="deadline"
                defaultValue={taak?.deadline ?? ""}
                className={`${invoer} cijfers`}
              />
            </Veld>
          )}

          <WieKeuze
            mensen={mensen}
            gekozen={taak ? toegekenden(taak, mensen) : []}
            huishoudens={huishoudens}
          />
        </div>

        {state?.fout && (
          <p className="mt-3 text-sm text-slecht">{state.fout}</p>
        )}

        {taak && (
          <button
            type="button"
            disabled={wissen}
            onClick={() => {
              startWissen(async () => {
                await verwijderTaakAction(taak.id);
                sluit();
              });
            }}
            className="mt-5 w-full rounded-xl border border-rand py-3 text-sm text-slecht transition hover:border-slecht"
          >
            Taak verwijderen
          </button>
        )}
        {/* Het huidige aanmeldrondje zit in de kaart zelf; hier alleen de velden. */}
        <input type="hidden" name="jij" value={jij} />
      </form>
    </div>
  );
}

const invoer =
  "w-full rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px] text-inkt focus:border-inkt";

/**
 * Een taak toekennen aan een of meer personen. Vakjes en geen keuzelijst: bij vier
 * mensen is alles in beeld, en meer dan een kiezen is dan een tik per persoon in
 * plaats van een lijst waar je steeds opnieuw in moet. Niemand kiezen mag ook --
 * dan pakt op het moment zelf op wie er aan boord is.
 *
 * Een vakje dat uit staat stuurt niets mee, dus het formulier meldt apart dat dit
 * veld erbij hoort; zonder dat zou de server een lege keuze niet kunnen
 * onderscheiden van een formulier dat de keuze helemaal niet kent.
 */
function WieKeuze({
  mensen,
  gekozen,
  huishoudens,
}: {
  mensen: Mens[];
  gekozen: number[];
  huishoudens: Keuze[];
}) {
  if (mensen.length === 0) return null;
  return (
    <fieldset>
      <legend className="bovenschrift mb-1.5">Wie pakt dit op</legend>
      <input type="hidden" name="wieIngevuld" value="ja" />
      <div className="grid grid-cols-2 gap-2">
        {mensen.map((mens) => {
          const kleur = huishoudKleur(
            Math.max(
              0,
              huishoudens.findIndex((h) => h.id === mens.coupleId),
            ),
          );
          return (
            <label
              key={mens.id}
              className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-rand-sterk bg-paneel px-3 py-2 transition hover:border-inkt has-checked:border-inkt has-checked:bg-marine-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marine"
            >
              <input
                type="checkbox"
                name="wie"
                value={mens.id}
                defaultChecked={gekozen.includes(mens.id)}
                className="sr-only"
              />
              <Bolletje naam={mens.naam} kleur={kleur} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">
                  {mens.naam}
                </span>
                <span className="block truncate text-[11px] text-gedempt">
                  {mens.coupleNaam}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] text-gedempt">
        Een of meer personen. Laat leeg als het niet uitmaakt wie.
      </p>
    </fieldset>
  );
}

/** Het kleine label dat een winterklaar-taak herkenbaar maakt tussen de gewone. */
function WinterLabel() {
  return (
    <span className="shrink-0 rounded bg-marine-tint px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-inkt uppercase">
      Winterklaar
    </span>
  );
}

function Veld({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="bovenschrift mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

/** Het initialenrondje van iemand. */
export function Bolletje({
  naam,
  kleur,
  rand = false,
}: {
  naam: string;
  kleur: string;
  rand?: boolean;
}) {
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${
        rand ? "border-2 border-white" : ""
      }`}
      style={{ background: kleur }}
    >
      {initialen(naam)}
    </span>
  );
}

/**
 * De regel onder de titel. Wie de taak oppakt staat als bolletjes rechts, dus hier
 * alleen waar hij bij hoort -- anders staat dezelfde naam er twee keer.
 */
function onderregel(taak: TaakInvoer): string {
  if (taak.klaar) {
    const wie = taak.klaarDoorNaam
      ? `gedaan door ${taak.klaarDoorNaam}`
      : "gedaan";
    const wanneer = taak.klaarOp
      ? ` · ${formatDatum(new Date(taak.klaarOp).toISOString().slice(0, 10))}`
      : "";
    return wie + wanneer;
  }
  return taak.postNaam ?? taak.toelichting;
}

/**
 * Wie er aan een taak hangt, voor de bolletjes. Aanmelders gaan voor, daarna een
 * oude eigenaar, en pas als er niemand is staan de leden van het huishouden.
 */
function wieLijst(
  taak: TaakInvoer,
  mensen: readonly Mens[],
): { id: number; naam: string; coupleId: number }[] {
  return toegekenden(taak, mensen).flatMap((id) => {
    const mens = mensen.find((m) => m.id === id);
    if (mens) return [{ id, naam: mens.naam, coupleId: mens.coupleId }];
    const helper = taak.helpers.find((h) => h.userId === id);
    return helper
      ? [{ id, naam: helper.naam, coupleId: helper.coupleId }]
      : [];
  });
}

/** "12 sep" -- de datum zoals hij op een label past. */
function kort(iso: string): string {
  return formatDatum(iso).replace(/\s\d{4}$/, "");
}
