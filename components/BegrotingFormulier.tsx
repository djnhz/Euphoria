"use client";

import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  neemVorigJaarOverAction,
  nieuwePostAction,
  verwijderPostAction,
  wijzigPostAction,
  zetBedragAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";

export type Post = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  ouderId: number | null;
  begrootCent: number | null;
  eigenCent: number;
  werkelijkCent: number;
  /** Doet deze post dit jaar mee, of hoort hij bij een ander jaar? */
  inGebruik: boolean;
  subposten: Post[];
};

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

function alsTekst(cent: number | null): string {
  return cent === null ? "" : (cent / 100).toFixed(2).replace(".", ",");
}

/** Hoofdposten met hun subposten erachter, in de volgorde waarin ze op het scherm staan. */
function plat(posten: Post[]): Post[] {
  return posten.flatMap((post) => [post, ...post.subposten]);
}

export default function BegrotingFormulier({
  jaar,
  posten,
}: {
  jaar: number;
  posten: Post[];
}) {
  const [overnemenState, overnemen, overnemenBezig] = useActionState<
    BegrotingState,
    FormData
  >(neemVorigJaarOverAction, null);
  const [beheer, setBeheer] = useState(false);
  /**
   * Standaard staan alleen de posten van dit jaar in beeld: begroot of met uitgaven.
   * Wil je er een bijzetten of juist een bedrag weghalen, dan zet je dit aan en zie
   * je alles. Een post die je voor volgend jaar aanmaakt hoort hier niet te staan.
   */
  const [toonAlles, setToonAlles] = useState(false);

  const alle = useMemo(() => plat(posten), [posten]);
  const heeftGebruikte = posten.some((post) => post.inGebruik);
  // Een jaar waarin nog niets staat zou anders leeg blijven zonder weg vooruit.
  const allesTonen = toonAlles || !heeftGebruikte;
  const zichtbaar = allesTonen
    ? posten
    : posten
        .filter((post) => post.inGebruik)
        .map((post) => ({
          ...post,
          subposten: post.subposten.filter((sub) => sub.inGebruik),
        }));

  const [bedragen, setBedragen] = useState<Record<number, string>>(() =>
    Object.fromEntries(alle.map((p) => [p.id, alsTekst(p.begrootCent)])),
  );

  // Tijdens het typen verandert er niets aan de server, dus dit kenmerk blijft gelijk.
  // Wisselt het jaar, of komt er een nieuwe stand terug na opslaan of overnemen, dan
  // wel — en dan horen de velden die stand te tonen in plaats van de oude invoer.
  const kenmerk = [
    jaar,
    ...alle.map((p) => `${p.id}=${p.begrootCent ?? ""}`),
  ].join("|");
  const [vorigKenmerk, setVorigKenmerk] = useState(kenmerk);
  if (vorigKenmerk !== kenmerk) {
    setVorigKenmerk(kenmerk);
    setBedragen(
      Object.fromEntries(alle.map((p) => [p.id, alsTekst(p.begrootCent)])),
    );
  }

  /**
   * Opslaan gebeurt per veld: kort nadat je stopt met typen, en meteen als je het
   * veld verlaat. Een teller per post houdt bij welke opdracht de laatste is, zodat
   * een traag antwoord een nieuwere invoer niet overschrijft in de melding.
   */
  const [status, setStatus] = useState<
    { bezig: boolean; fout: string | null; opgeslagenOp: number | null }
  >({ bezig: false, fout: null, opgeslagenOp: null });
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const laatste = useRef(0);

  const bewaarVeld = useCallback(
    async (postId: number, tekst: string) => {
      const nummer = ++laatste.current;
      setStatus((h) => ({ ...h, bezig: true, fout: null }));
      const uitkomst = await zetBedragAction(jaar, postId, tekst);
      if (nummer !== laatste.current) return; // er kwam alweer iets nieuwers
      setStatus({
        bezig: false,
        fout: uitkomst?.fout ?? null,
        opgeslagenOp: uitkomst?.fout ? null : nummer,
      });
    },
    [jaar],
  );

  function pasBedragAan(postId: number, tekst: string) {
    setBedragen((huidig) => ({ ...huidig, [postId]: tekst }));
    clearTimeout(timers.current[postId]);
    timers.current[postId] = setTimeout(() => void bewaarVeld(postId, tekst), 600);
  }

  function bewaarNu(postId: number, tekst: string) {
    clearTimeout(timers.current[postId]);
    void bewaarVeld(postId, tekst);
  }

  const totalen = useMemo(() => {
    let begroot = 0;
    for (const post of alle) begroot += parseEuro(bedragen[post.id] ?? "") ?? 0;
    // Eigen bedragen optellen, niet de opgetelde: anders telt een subpost dubbel.
    const werkelijk = alle.reduce((som, p) => som + p.eigenCent, 0);
    return { begroot, werkelijk };
  }, [bedragen, alle]);

  if (posten.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl border border-rand bg-paneel p-6 text-sm text-gedempt">
          Nog geen posten. Begin met een paar hoofdposten — Onderhoud, Vaste lasten,
          Uitrusting — en hang daar subposten onder zodra je het fijner wilt.
        </p>
        <div className="rounded-xl border border-rand bg-paneel p-4">
          <NieuwePost hoofdposten={[]} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-rand bg-paneel p-4">
        <ul className="flex flex-col">
          <li className="flex items-center gap-3 border-b border-rand pb-2 text-xs text-gedempt">
            <span className="flex-1">Post</span>
            <span className="w-28 text-right">Begroot</span>
            <span className="hidden w-28 text-right sm:block">Uitgegeven</span>
            <span className="hidden w-28 text-right sm:block">Verschil</span>
          </li>

          {zichtbaar.map((post) => (
            <PostRegel
              key={post.id}
              post={post}
              jaar={jaar}
              bedragen={bedragen}
              pasBedragAan={pasBedragAan}
              bewaarNu={bewaarNu}
            />
          ))}
        </ul>

        {heeftGebruikte && (
          <label className="mt-3 flex items-center gap-2 text-xs text-gedempt">
            <input
              type="checkbox"
              checked={toonAlles}
              onChange={(e) => setToonAlles(e.target.checked)}
            />
            Alle posten tonen, ook die dit jaar niet meedoen
          </label>
        )}

        <div className="mt-3 border-t border-rand pt-3 text-sm font-medium">
          <div className="flex items-center gap-3">
            <span className="flex-1">Totaal</span>
            <span className="cijfers w-28 shrink-0 text-right">
              {formatEuro(totalen.begroot)}
            </span>
            <span className="cijfers hidden w-28 text-right sm:block">
              {formatEuro(totalen.werkelijk)}
            </span>
            <span className="cijfers hidden w-28 text-right sm:block">
              {formatEuro(totalen.begroot - totalen.werkelijk)}
            </span>
          </div>
          <p className="mt-1 flex gap-3 text-xs font-normal text-gedempt sm:hidden">
            <span>
              uitgegeven <span className="cijfers">{formatEuro(totalen.werkelijk)}</span>
            </span>
            <span>
              verschil{" "}
              <span className="cijfers">
                {formatEuro(totalen.begroot - totalen.werkelijk)}
              </span>
            </span>
          </p>
        </div>

        {/* Geen opslaanknop: elk bedrag gaat vanzelf mee zodra je stopt met typen. */}
        <p className="mt-3 h-5 text-xs text-gedempt" aria-live="polite">
          {status.fout ? (
            <span className="text-slecht">{status.fout}</span>
          ) : status.bezig ? (
            "opslaan…"
          ) : status.opgeslagenOp !== null ? (
            "opgeslagen"
          ) : (
            "Bedragen worden vanzelf opgeslagen."
          )}
        </p>
      </section>

      <div className="rounded-xl border border-rand bg-paneel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <NieuwePost hoofdposten={posten} />
          <form action={overnemen} className="flex items-center gap-3">
            <input type="hidden" name="jaar" value={jaar} />
            <button
              disabled={overnemenBezig}
              className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
            >
              Overnemen uit {jaar - 1}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setBeheer((huidig) => !huidig)}
            className="text-sm text-accent underline"
          >
            {beheer ? "posten verbergen" : "posten aanpassen"}
          </button>
          <Uitkomst state={overnemenState} />
        </div>

        {beheer && (
          <ul className="mt-4 flex flex-col gap-3 border-t border-rand pt-4">
            {alle.map((post) => (
              <li key={post.id}>
                <BeheerRegel post={post} hoofdposten={posten} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PostRegel({
  post,
  jaar,
  bedragen,
  pasBedragAan,
  bewaarNu,
  ingesprongen = false,
}: {
  post: Post;
  jaar: number;
  bedragen: Record<number, string>;
  pasBedragAan: (postId: number, tekst: string) => void;
  bewaarNu: (postId: number, tekst: string) => void;
  ingesprongen?: boolean;
}) {
  // Elke regel vergelijkt zijn eigen bedrag met zijn eigen uitgaven. Wat een hoofdpost
  // met zijn subposten samen doet staat eronder in de subtotaalregel; anders zou je
  // een begroting van 800 naast uitgaven van een subpost met een eigen bedrag leggen.
  const begrootCent = parseEuro(bedragen[post.id] ?? "");
  const verschil = begrootCent === null ? null : begrootCent - post.eigenCent;

  return (
    <>
      <li className="border-b border-rand py-2 last:border-0">
       <div className="flex items-center gap-3">
        {/* De naam leidt naar de uitgaven op deze post; bij een hoofdpost tellen de
            subposten daar mee. */}
        <Link
          href={`/uitgaven?jaar=${jaar}&post=${post.id}`}
          title={`Uitgaven op ${post.naam} in ${jaar}`}
          className={`flex flex-1 items-center gap-2 truncate hover:text-accent ${
            ingesprongen ? "pl-6 text-sm text-gedempt" : "text-sm font-medium"
          }`}
        >
          <span
            aria-hidden
            className="inline-block h-3 w-3 shrink-0 rounded"
            style={{ background: post.kleur }}
          />
          <span className="truncate">{post.naam}</span>
          {!post.actief && (
            <span className="shrink-0 text-xs text-gedempt">(inactief)</span>
          )}
        </Link>
        <input
          name={`post-${post.id}`}
          inputMode="decimal"
          placeholder="—"
          value={bedragen[post.id] ?? ""}
          onChange={(e) => pasBedragAan(post.id, e.target.value)}
          onBlur={(e) => bewaarNu(post.id, e.target.value)}
          aria-label={`Begroot voor ${post.naam}`}
          className={`${invoer} cijfers w-28 shrink-0 text-right`}
        />
        <span className="cijfers hidden w-28 text-right text-sm text-gedempt sm:block">
          {formatEuro(post.eigenCent)}
        </span>
        <span
          className={`cijfers hidden w-28 text-right text-sm sm:block ${
            verschil !== null && verschil < 0 ? "text-slecht" : "text-gedempt"
          }`}
        >
          {verschil === null ? "—" : formatEuro(verschil)}
        </span>
       </div>

       {/* Op een telefoon passen de kolommen niet naast het invoerveld; dan gaan de
           cijfers eronder in plaats van dat ze verdwijnen. */}
       <p
         className={`mt-1 flex gap-3 text-xs text-gedempt sm:hidden ${
           ingesprongen ? "pl-6" : ""
         }`}
       >
         <span>
           uitgegeven <span className="cijfers">{formatEuro(post.eigenCent)}</span>
         </span>
         <span className={verschil !== null && verschil < 0 ? "text-slecht" : ""}>
           verschil{" "}
           <span className="cijfers">
             {verschil === null ? "—" : formatEuro(verschil)}
           </span>
         </span>
       </p>
      </li>

      {post.subposten.map((sub) => (
        <PostRegel
          key={sub.id}
          post={sub}
          jaar={jaar}
          bedragen={bedragen}
          pasBedragAan={pasBedragAan}
          bewaarNu={bewaarNu}
          ingesprongen
        />
      ))}

      {post.subposten.length > 0 && (
        <Subtotaal post={post} bedragen={bedragen} />
      )}
    </>
  );
}

/** Hoofdpost plus subposten bij elkaar; alleen zinnig als er subposten zijn. */
function Subtotaal({
  post,
  bedragen,
}: {
  post: Post;
  bedragen: Record<number, string>;
}) {
  const begroot = [post, ...post.subposten].reduce(
    (som, p) => som + (parseEuro(bedragen[p.id] ?? "") ?? 0),
    0,
  );
  const verschil = begroot - post.werkelijkCent;

  return (
    <li className="border-b border-rand py-2 text-sm text-gedempt last:border-0">
      <div className="flex items-center gap-3">
        <span className="flex-1 truncate pl-6">samen {post.naam}</span>
        <span className="cijfers w-28 shrink-0 pr-3 text-right">
          {formatEuro(begroot)}
        </span>
        <span className="cijfers hidden w-28 text-right sm:block">
          {formatEuro(post.werkelijkCent)}
        </span>
        <span
          className={`cijfers hidden w-28 text-right sm:block ${
            verschil < 0 ? "text-slecht" : ""
          }`}
        >
          {formatEuro(verschil)}
        </span>
      </div>
      <p className="mt-1 flex gap-3 pl-6 text-xs sm:hidden">
        <span>
          uitgegeven <span className="cijfers">{formatEuro(post.werkelijkCent)}</span>
        </span>
        <span className={verschil < 0 ? "text-slecht" : ""}>
          verschil <span className="cijfers">{formatEuro(verschil)}</span>
        </span>
      </p>
    </li>
  );
}

/** Een post hernoemen, verkleuren, verhangen, uitvinken of weghalen. */
function BeheerRegel({
  post,
  hoofdposten,
}: {
  post: Post;
  hoofdposten: Post[];
}) {
  const [wisState, wis, wissen] = useActionState<BegrotingState, FormData>(
    verwijderPostAction,
    null,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        action={wijzigPostAction}
        className="flex flex-1 flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={post.id} />
        <input
          type="color"
          name="kleur"
          defaultValue={post.kleur}
          aria-label={`Kleur voor ${post.naam}`}
          className="h-9 w-9 shrink-0 rounded border border-rand bg-transparent"
        />
        <input
          name="naam"
          defaultValue={post.naam}
          aria-label="Naam"
          className={`${invoer} min-w-0 flex-1`}
        />
        {/* Sleutel op de huidige plek, anders blijft na opslaan de oude keuze
            in beeld staan. */}
        <select
          name="ouder"
          key={post.ouderId ?? 0}
          defaultValue={post.ouderId ?? 0}
          aria-label={`Hoofdpost van ${post.naam}`}
          className={`${invoer} min-w-0 flex-1`}
        >
          <option value={0}>eigen hoofdpost</option>
          {hoofdposten
            .filter((h) => h.id !== post.id)
            .map((hoofd) => (
              <option key={hoofd.id} value={hoofd.id}>
                onder {hoofd.naam}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-gedempt">
          <input type="checkbox" name="actief" defaultChecked={post.actief} />
          actief
        </label>
        <button className="rounded-lg border border-rand px-3 py-2 text-sm">
          Opslaan
        </button>
      </form>

      <form action={wis}>
        <input type="hidden" name="id" value={post.id} />
        <button
          disabled={wissen}
          // Weghalen kan niet ongedaan; even vragen scheelt een ongeluk.
          onClick={(e) => {
            if (
              !confirm(
                `${post.naam} verwijderen?${
                  post.subposten.length > 0
                    ? " De subposten eronder worden zelf hoofdpost."
                    : ""
                }`,
              )
            ) {
              e.preventDefault();
            }
          }}
          className="rounded-lg px-3 py-2 text-sm text-slecht underline disabled:opacity-50"
        >
          verwijderen
        </button>
      </form>

      <Uitkomst state={wisState} />
    </div>
  );
}

function NieuwePost({ hoofdposten }: { hoofdposten: Post[] }) {
  const [state, toevoegen, bezig] = useActionState<BegrotingState, FormData>(
    nieuwePostAction,
    null,
  );

  return (
    <form action={toevoegen} className="flex flex-1 flex-wrap items-center gap-2">
      <input
        type="color"
        name="kleur"
        defaultValue="#64748b"
        aria-label="Kleur"
        className="h-9 w-9 shrink-0 rounded border border-rand bg-transparent"
      />
      <input
        name="naam"
        required
        placeholder="Nieuwe post"
        className={`${invoer} min-w-0 flex-1`}
      />
      {hoofdposten.length > 0 && (
        <select
          name="ouder"
          defaultValue={0}
          aria-label="Hoofdpost"
          className={`${invoer} min-w-0 flex-1`}
        >
          <option value={0}>als hoofdpost</option>
          {hoofdposten.map((hoofd) => (
            <option key={hoofd.id} value={hoofd.id}>
              onder {hoofd.naam}
            </option>
          ))}
        </select>
      )}
      <button
        disabled={bezig}
        className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
      >
        Toevoegen
      </button>
      <Uitkomst state={state} />
    </form>
  );
}

function Uitkomst({ state }: { state: BegrotingState }) {
  if (!state) return null;
  if (state.fout) return <p className="text-sm text-slecht">{state.fout}</p>;
  return <p className="text-sm text-goed">{state.gelukt}</p>;
}
