"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  helpMeeAction,
  nieuweTaakAction,
  verwijderTaakAction,
  wijzigTaakAction,
  zetKlaarAction,
  type TaakState,
} from "@/app/(app)/taken/actions";
import { initialen } from "./GebruikerMenu";
import { formatDatum } from "@/lib/datum";

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
  helpers: { userId: number; naam: string }[];
};

export type Keuze = { id: number; naam: string; kleur?: string };

/**
 * Een taak in een lijst: het rondje om af te vinken, de titel met waar hij bij
 * hoort, en rechts de datum of degene die hem oppakt. De hele regel opent het
 * formulier -- alleen het rondje vinkt af.
 */
export function TaakRij({
  taak,
  posten,
  huishoudens,
  jij,
}: {
  taak: TaakInvoer;
  posten: Keuze[];
  huishoudens: Keuze[];
  jij: number;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, start] = useTransition();

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
        <span className="truncate text-[11.5px] text-gedempt">
          {onderregel(taak)}
        </span>
      </button>

      {!taak.klaar && taak.deadline && (
        <span className="cijfers shrink-0 rounded-md bg-messing-tint px-2 py-1 text-[10.5px] font-semibold text-messing-inkt">
          {kort(taak.deadline)}
        </span>
      )}
      {!taak.klaar && !taak.deadline && taak.userNaam && (
        <Bolletje naam={taak.userNaam} kleur="var(--marine)" />
      )}

      {open && (
        <TaakSheet
          taak={taak}
          posten={posten}
          huishoudens={huishoudens}
          jij={jij}
          sluit={() => setOpen(false)}
        />
      )}
    </li>
  );
}

/** De kaart voor een klus die je samen doet, met wie zich al heeft aangemeld. */
export function SamenKaart({
  taak,
  posten,
  huishoudens,
  jij,
}: {
  taak: TaakInvoer;
  posten: Keuze[];
  huishoudens: Keuze[];
  jij: number;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, start] = useTransition();
  const doeMee = taak.helpers.some((h) => h.userId === jij);

  return (
    <div className="rounded-2xl border border-rand bg-paneel p-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold text-inkt">{taak.titel}</span>
        {taak.deadline && (
          <span className="cijfers shrink-0 text-[11px] text-gedempt">
            {kort(taak.deadline)}
          </span>
        )}
      </button>
      {taak.toelichting && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-gedempt text-pretty">
          {taak.toelichting}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex">
          {taak.helpers.map((h, i) => (
            <span
              key={h.userId}
              style={{ marginLeft: i === 0 ? 0 : -7 }}
              title={h.naam}
            >
              <Bolletje
                naam={h.naam}
                kleur={i % 2 === 0 ? "var(--marine)" : "var(--messing)"}
                rand
              />
            </span>
          ))}
        </div>
        <span className="flex-1 text-xs text-gedempt">
          {taak.helpers.length === 0
            ? "nog niemand aangemeld"
            : `${taak.helpers.length} aangemeld`}
        </span>
        <button
          type="button"
          disabled={bezig}
          onClick={() => start(() => helpMeeAction(taak.id, !doeMee))}
          className={`rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
            doeMee
              ? "border-transparent bg-marine-tint text-inkt"
              : "border-rand-sterk bg-paneel text-inkt hover:border-inkt"
          } ${bezig ? "opacity-50" : ""}`}
        >
          {doeMee ? "Ik doe mee" : "Ik help"}
        </button>
      </div>

      {open && (
        <TaakSheet
          taak={taak}
          posten={posten}
          huishoudens={huishoudens}
          jij={jij}
          sluit={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** De zwevende knop onderaan het takenscherm. */
export function TaakToevoegen({
  posten,
  huishoudens,
  jij,
  inKop = false,
}: {
  posten: Keuze[];
  huishoudens: Keuze[];
  jij: number;
  /** In de kop staat hij als gewone knop; onderaan zweeft hij boven de lijst. */
  inKop?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (inKop) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden rounded-xl bg-inkt px-4 py-2.5 text-sm font-semibold text-linnen transition hover:bg-inkt-hover lg:block"
        >
          Taak toevoegen
        </button>
        {open && (
          <TaakSheet
            taak={null}
            posten={posten}
            huishoudens={huishoudens}
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
            Taak toevoegen
          </button>
        </div>
      </div>
      {open && (
        <TaakSheet
          taak={null}
          posten={posten}
          huishoudens={huishoudens}
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
  posten,
  huishoudens,
  jij,
  sluit,
}: {
  taak: TaakInvoer | null;
  posten: Keuze[];
  huishoudens: Keuze[];
  jij: number;
  sluit: () => void;
}) {
  const [state, actie, bezig] = useActionState<TaakState, FormData>(
    taak ? wijzigTaakAction : nieuweTaakAction,
    null,
  );
  const [wissen, startWissen] = useTransition();

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
        className="max-h-[88vh] w-full max-w-md overflow-auto rounded-t-3xl bg-linnen p-[18px] pb-8 sm:rounded-3xl"
      >
        {taak && <input type="hidden" name="id" value={taak.id} />}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={sluit}
            className="text-[15px] text-gedempt"
          >
            Annuleren
          </button>
          <span className="titel text-lg">
            {taak ? "Taak wijzigen" : "Nieuwe taak"}
          </span>
          <button
            type="submit"
            disabled={bezig}
            className="text-[15px] font-semibold text-inkt disabled:text-zacht"
          >
            {bezig ? "…" : "Opslaan"}
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

          <div className="flex gap-2.5">
            <Veld label="Uiterlijk" className="min-w-0 flex-1">
              <input
                type="date"
                name="deadline"
                defaultValue={taak?.deadline ?? ""}
                className={`${invoer} cijfers`}
              />
            </Veld>
            <Veld label="Hoort bij" className="min-w-0 flex-1">
              <select
                name="post"
                defaultValue={taak?.postId ?? 0}
                className={invoer}
              >
                <option value={0}>—</option>
                {posten.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                  </option>
                ))}
              </select>
            </Veld>
          </div>

          <Veld label="Voor wie">
            <select
              name="huishouden"
              defaultValue={taak?.coupleId ?? 0}
              className={invoer}
            >
              <option value={0}>Wie het eerst kan</option>
              {huishoudens.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.naam}
                </option>
              ))}
            </select>
          </Veld>

          <label className="flex items-center gap-3 rounded-xl border border-rand bg-paneel px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              name="samen"
              value="aan"
              defaultChecked={taak?.samen ?? false}
              className="h-4 w-4 accent-[var(--inkt)]"
            />
            <span className="flex-1">
              Samen oppakken
              <span className="block text-[11.5px] text-gedempt">
                anderen kunnen zich aanmelden
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-rand bg-paneel px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              name="soort"
              value="winterklaar"
              defaultChecked={taak?.soort === "winterklaar"}
              className="h-4 w-4 accent-[var(--inkt)]"
            />
            <span className="flex-1">
              Hoort bij winterklaar maken
              <span className="block text-[11.5px] text-gedempt">
                komt op de winterlijst te staan
              </span>
            </span>
          </label>

          {!taak && (
            <label className="flex items-center gap-3 rounded-xl border border-rand bg-paneel px-3.5 py-3 text-sm">
              <input
                type="checkbox"
                name="voorMij"
                value="aan"
                className="h-4 w-4 accent-[var(--inkt)]"
              />
              <span className="flex-1">Ik pak hem zelf op</span>
            </label>
          )}
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
  "w-full rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px] text-inkt outline-none focus:border-inkt";

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
  const delen = [taak.postNaam, taak.userNaam ?? taak.coupleNaam].filter(
    Boolean,
  );
  return delen.join(" · ");
}

/** "12 sep" -- de datum zoals hij op een label past. */
function kort(iso: string): string {
  return formatDatum(iso).replace(/\s\d{4}$/, "");
}
