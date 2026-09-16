"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import KleurKiezer from "./KleurKiezer";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  bewaarPostAction,
  verwijderPostAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";
import NieuwePost from "./NieuwePost";
import type { BegrotingsPost as Post } from "@/lib/begroting";

/** Eén regel zoals hij in het blad staat, met een eigen sleutel voor React. */
type Ontwerp = { sleutel: string; naam: string; bedrag: string };

let teller = 0;
const nieuweSleutel = () => `nieuw-${++teller}`;

function alsTekst(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",");
}

/**
 * Een post bewerken: naam, kleur, waar hij onder hangt, en de regels die zijn bedrag
 * opbouwen. Onderin op een telefoon en gecentreerd op een breed scherm, precies zoals
 * het takenblad -- een derde bewerkpatroon erbij zou de app alleen maar onvoorspelbaar
 * maken.
 *
 * Alles is hier lokaal tot je op Opslaan drukt. Dat scheelt de wedloop tussen een veld
 * dat zichzelf bewaart en een pagina die zich ververst, en het maakt Annuleren een
 * echte uitweg in plaats van een knop die niets meer terugdraait.
 */
export default function PostBlad({
  post,
  jaar,
  hoofdposten,
  sluit,
}: {
  post: Post;
  jaar: number;
  /** Om onder te kunnen hangen; de post zelf zit er niet bij. */
  hoofdposten: Post[];
  sluit: () => void;
}) {
  const [naam, setNaam] = useState(post.naam);
  const [kleur, setKleur] = useState(post.kleur);
  const [actief, setActief] = useState(post.actief);
  const [ouderId, setOuderId] = useState(post.ouderId ?? 0);
  const [melding, setMelding] = useState<BegrotingState>(null);
  const [bezig, start] = useTransition();
  const [wissen, startWissen] = useTransition();
  const [subOpen, setSubOpen] = useState(false);

  /**
   * Had de post een los bedrag, dan wordt dat bij de eerste regel zichtbaar de eerste
   * regel -- met het bedrag erin en de naam nog leeg. Zo valt er niets weg en springt
   * het totaal niet.
   */
  const [regels, setRegels] = useState<Ontwerp[]>(() =>
    post.regels
      .filter((r) => r.naam !== null)
      .map((r) => ({
        sleutel: `bestaand-${r.id}`,
        naam: r.naam ?? "",
        bedrag: alsTekst(r.bedragCent),
      })),
  );

  const nieuwsteVeld = useRef<HTMLInputElement | null>(null);
  const [richtOp, setRichtOp] = useState<string | null>(null);

  // Een nieuwe regel krijgt meteen de cursor, zodat je op een telefoon kunt doortypen
  // zonder eerst te moeten mikken.
  useEffect(() => {
    if (richtOp && nieuwsteVeld.current) {
      nieuwsteVeld.current.focus();
      setRichtOp(null);
    }
  }, [richtOp]);

  useEffect(() => {
    function toets(e: KeyboardEvent) {
      if (e.key === "Escape") sluit();
    }
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [sluit]);

  const losBedrag =
    post.regels.find((r) => r.naam === null)?.bedragCent ?? null;

  function voegRegelToe() {
    setRegels((huidig) => {
      // Het losse bedrag wordt de eerste regel in plaats van stilletjes te verdwijnen.
      const basis =
        huidig.length === 0 && losBedrag !== null
          ? [
              {
                sleutel: nieuweSleutel(),
                naam: "",
                bedrag: alsTekst(losBedrag),
              },
            ]
          : huidig;
      const sleutel = nieuweSleutel();
      setRichtOp(sleutel);
      return [...basis, { sleutel, naam: "", bedrag: "" }];
    });
  }

  function pasAan(sleutel: string, veld: "naam" | "bedrag", waarde: string) {
    setRegels((huidig) =>
      huidig.map((r) => (r.sleutel === sleutel ? { ...r, [veld]: waarde } : r)),
    );
  }

  function verwijder(sleutel: string) {
    const regel = regels.find((r) => r.sleutel === sleutel);
    const gevuld = Boolean(regel && (regel.naam.trim() || regel.bedrag.trim()));
    // Een lege regel weghalen is niets; een gevulde is werk dat je kwijtraakt.
    if (gevuld && !confirm(`"${regel?.naam || "Deze regel"}" weghalen?`))
      return;
    setRegels((huidig) => huidig.filter((r) => r.sleutel !== sleutel));
  }

  function verschuif(sleutel: string, richting: -1 | 1) {
    setRegels((huidig) => {
      const i = huidig.findIndex((r) => r.sleutel === sleutel);
      const j = i + richting;
      if (i < 0 || j < 0 || j >= huidig.length) return huidig;
      const kopie = [...huidig];
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
      return kopie;
    });
  }

  // Hetzelfde sommetje als op de server, zodat het getal tijdens het typen klopt.
  const totaal =
    regels.length > 0
      ? regels.reduce((som, r) => som + (parseEuro(r.bedrag.trim()) ?? 0), 0)
      : losBedrag;

  function bewaar() {
    setMelding(null);
    start(async () => {
      const uitkomst = await bewaarPostAction(jaar, post.id, {
        naam,
        kleur,
        actief,
        ouderId: ouderId === 0 ? null : ouderId,
        regels: regels.map((r) => ({ naam: r.naam, bedrag: r.bedrag })),
      });
      setMelding(uitkomst);
      if (!uitkomst?.fout) sluit();
    });
  }

  function wisPost() {
    if (
      !confirm(
        `${post.naam} verwijderen?${
          post.subposten.length > 0
            ? " De subposten eronder worden zelf hoofdpost."
            : ""
        }`,
      )
    ) {
      return;
    }
    startWissen(async () => {
      const formulier = new FormData();
      formulier.set("id", String(post.id));
      const uitkomst = await verwijderPostAction(null, formulier);
      setMelding(uitkomst);
      if (!uitkomst?.fout) sluit();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-inkt-diep/45 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) sluit();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-md overflow-auto rounded-t-3xl bg-linnen p-[18px] pb-8 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={sluit}
            className="shrink-0 text-[15px] text-gedempt"
          >
            Annuleren
          </button>
          <span className="titel min-w-0 truncate text-lg">{post.naam}</span>
          <button
            type="button"
            onClick={bewaar}
            disabled={bezig}
            className="shrink-0 text-[15px] font-semibold text-inkt disabled:text-zacht"
          >
            {bezig ? "…" : "Opslaan"}
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <Veld label="Naam">
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              maxLength={60}
              className={invoer}
            />
          </Veld>

          <Veld label="Kleur">
            <KleurKiezer
              key={post.kleur}
              begin={kleur}
              label={`Kleur voor ${post.naam}`}
              onKies={setKleur}
            />
          </Veld>

          <label className="flex items-center gap-2 text-sm text-gedempt">
            <input
              type="checkbox"
              checked={actief}
              onChange={(e) => setActief(e.target.checked)}
              className="h-4 w-4 accent-[var(--inkt)]"
            />
            Nog in gebruik — uitvinken haalt hem uit de keuzelijst bij een bon
          </label>
        </div>

        <div className="mt-5 border-t border-rand pt-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <p className="bovenschrift">Opbouw</p>
            <p className="cijfers text-xs text-gedempt">
              {totaal === null ? "niet begroot" : formatEuro(totaal)}
            </p>
          </div>

          {regels.length === 0 ? (
            <p className="text-[12.5px] text-gedempt text-pretty">
              {losBedrag === null
                ? "Er staat nog geen bedrag. Vul er een in op de kaart, of splits het hieronder op in regels."
                : `Nu één bedrag van ${formatEuro(losBedrag)}. Splits het op als je wilt laten zien hoe je eraan komt.`}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {regels.map((regel, i) => (
                <li
                  key={regel.sleutel}
                  className="rounded-xl border border-rand bg-paneel p-3"
                >
                  <input
                    ref={regel.sleutel === richtOp ? nieuwsteVeld : null}
                    value={regel.naam}
                    onChange={(e) =>
                      pasAan(regel.sleutel, "naam", e.target.value)
                    }
                    placeholder="waarvoor is dit?"
                    maxLength={60}
                    enterKeyHint="next"
                    aria-label="Naam van de regel"
                    className="w-full rounded-lg border border-rand-sterk bg-verzonken px-3 py-2.5 text-sm"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={regel.bedrag}
                      onChange={(e) =>
                        pasAan(regel.sleutel, "bedrag", e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label="Bedrag van de regel"
                      className="cijfers w-[110px] shrink-0 rounded-lg border border-rand-sterk bg-verzonken px-3 py-2.5 text-right text-sm"
                    />
                    <span className="flex-1" />
                    <Knopje
                      label="Naar boven"
                      uit={i === 0}
                      klik={() => verschuif(regel.sleutel, -1)}
                    >
                      ↑
                    </Knopje>
                    <Knopje
                      label="Naar beneden"
                      uit={i === regels.length - 1}
                      klik={() => verschuif(regel.sleutel, 1)}
                    >
                      ↓
                    </Knopje>
                    <Knopje
                      label="Regel weghalen"
                      klik={() => verwijder(regel.sleutel)}
                      gevaar
                    >
                      ×
                    </Knopje>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={voegRegelToe}
            className="mt-3 w-full rounded-xl border border-dashed border-rand-sterk py-3 text-[13.5px] font-semibold transition hover:border-inkt"
          >
            + Regel
          </button>
          <p className="mt-2 text-xs text-gedempt text-pretty">
            Regels zijn alleen voor de begroting. Wil je er bonnen op kunnen
            boeken, maak er dan een subpost van.
          </p>
        </div>

        {melding?.fout && (
          <p className="mt-4 text-sm text-slecht text-pretty">{melding.fout}</p>
        )}

        {/* Verplaatsen doe je zelden en het is geen eigenschap van de post zoals
            naam en kleur. Het staat daarom hier bij de andere ingrepen, en alleen als
            het kan: een post met subposten kan zelf nergens onder hangen. */}
        {post.subposten.length === 0 && hoofdposten.length > 0 && (
          <div className="mt-5 border-t border-rand pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="bovenschrift">Verplaatsen</span>
              <select
                value={ouderId}
                onChange={(e) => setOuderId(Number(e.target.value))}
                className={invoer}
              >
                <option value={0}>losse hoofdpost</option>
                {hoofdposten.map((hoofd) => (
                  <option key={hoofd.id} value={hoofd.id}>
                    onder {hoofd.naam}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Rustiger dan "+ Regel", want dit is de uitzondering: een subpost is een
            echte post waarop je kunt boeken, en die verschijnt dus overal. */}
        {post.ouderId === null && (
          <div className="mt-5 border-t border-rand pt-4">
            {subOpen ? (
              <>
                <p className="bovenschrift mb-2.5">Nieuwe subpost</p>
                <NieuwePost ouderId={post.id} klaar={sluit} />
                <button
                  type="button"
                  onClick={() => setSubOpen(false)}
                  className="mt-2 text-sm text-gedempt underline"
                >
                  laat maar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSubOpen(true)}
                  className="text-sm font-semibold underline"
                >
                  Subpost toevoegen
                </button>
                <p className="mt-1.5 text-xs text-gedempt text-pretty">
                  Een subpost is een echte post: je kunt er bonnen op boeken en
                  later zien wat eraan is uitgegeven.
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-rand pt-4">
          <button
            type="button"
            onClick={wisPost}
            disabled={wissen}
            className="text-sm text-slecht underline disabled:opacity-50"
          >
            {wissen ? "Bezig…" : "Post verwijderen"}
          </button>
        </div>
      </div>
    </div>
  );
}

const invoer =
  "w-full rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px]";

function Veld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="bovenschrift">{label}</span>
      {children}
    </label>
  );
}

/** Rond de 40 pixels, want hieronder wordt het mikken met een duim. */
function Knopje({
  children,
  label,
  klik,
  uit = false,
  gevaar = false,
}: {
  children: React.ReactNode;
  label: string;
  klik: () => void;
  uit?: boolean;
  gevaar?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={klik}
      disabled={uit}
      aria-label={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rand-sterk text-base transition disabled:opacity-30 ${
        gevaar ? "text-slecht hover:border-slecht" : "hover:border-inkt"
      }`}
    >
      {children}
    </button>
  );
}
