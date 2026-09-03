"use client";

import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KleurKiezer from "./KleurKiezer";
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

const invoer =
  "rounded-xl border border-rand-sterk bg-paneel px-3.5 py-3 text-[15px]";

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
  const [status, setStatus] = useState<{
    bezig: boolean;
    fout: string | null;
    opgeslagenOp: number | null;
  }>({ bezig: false, fout: null, opgeslagenOp: null });
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
    timers.current[postId] = setTimeout(
      () => void bewaarVeld(postId, tekst),
      600,
    );
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
        <p className="rounded-2xl border border-dashed border-rand-sterk p-5 text-sm text-gedempt text-pretty">
          Nog geen posten. Begin met een paar hoofdposten — Onderhoud, Liggeld,
          Uitrusting — en hang daar subposten onder zodra je het fijner wilt.
        </p>
        <div className="rounded-2xl border border-rand bg-paneel p-4">
          <NieuwePost hoofdposten={[]} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Stand begroot={totalen.begroot} besteed={totalen.werkelijk} />

      <div className="bovenschrift flex justify-between px-1">
        <span>Post</span>
        <span>Begroot</span>
      </div>
      <div className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
        {zichtbaar.map((post) => (
          <PostKaart
            key={post.id}
            post={post}
            jaar={jaar}
            bedragen={bedragen}
            pasBedragAan={pasBedragAan}
            bewaarNu={bewaarNu}
          />
        ))}
      </div>

      {heeftGebruikte && (
        <label className="flex items-center gap-2 px-1 text-xs text-gedempt">
          <input
            type="checkbox"
            checked={toonAlles}
            onChange={(e) => setToonAlles(e.target.checked)}
            className="accent-[var(--inkt)]"
          />
          Alle posten tonen, ook die dit jaar niet meedoen
        </label>
      )}

      {/* Geen opslaanknop: elk bedrag gaat vanzelf mee zodra je stopt met typen. */}
      <p className="h-4 px-1 text-xs text-gedempt" aria-live="polite">
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

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setBeheer((huidig) => !huidig)}
          className="flex-1 rounded-xl border border-rand-sterk bg-paneel px-3 py-3 text-[13.5px] font-semibold transition hover:border-inkt"
        >
          {beheer ? "Klaar met posten" : "+ Post toevoegen"}
        </button>
        <form action={overnemen} className="flex-1">
          <input type="hidden" name="jaar" value={jaar} />
          <button
            disabled={overnemenBezig}
            className="w-full rounded-xl border border-dashed border-rand-sterk px-3 py-3 text-[13.5px] text-gedempt transition hover:border-inkt disabled:opacity-50"
          >
            Overnemen uit {jaar - 1}
          </button>
        </form>
      </div>
      <Uitkomst state={overnemenState} />

      {beheer && (
        <div className="flex flex-col gap-4 rounded-2xl border border-rand bg-paneel p-4">
          <NieuwePost hoofdposten={posten} />
          <ul className="flex flex-col gap-3 border-t border-rand pt-4">
            {alle.map((post) => (
              <li key={post.id}>
                <BeheerRegel post={post} hoofdposten={posten} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Het donkere blok bovenaan: staan we boven of onder de begroting? */
function Stand({ begroot, besteed }: { begroot: number; besteed: number }) {
  const verschil = besteed - begroot;
  const over = verschil > 0;
  const deel = begroot > 0 ? Math.min(1, besteed / begroot) : 0;
  const teveel =
    begroot > 0 && besteed > begroot
      ? Math.min(0.4, (besteed - begroot) / besteed)
      : 0;

  return (
    <section className="rounded-2xl bg-inkt p-[18px] text-linnen">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="bovenschrift !text-messing">
            {begroot === 0
              ? "Nog niets begroot"
              : over
                ? "Boven begroting"
                : "Nog te besteden"}
          </p>
          <p className="titel cijfers mt-1.5 text-[38px] leading-tight">
            {formatEuro(Math.abs(verschil))}
          </p>
        </div>
        <div className="cijfers shrink-0 text-right text-[11px] leading-loose text-linnen/65">
          <div>begroot {formatEuro(begroot)}</div>
          <div>besteed {formatEuro(besteed)}</div>
        </div>
      </div>
      <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-linnen/20">
        <span
          style={{ width: `${deel * 100}%`, background: "var(--marine-zacht)" }}
        />
        <span
          style={{ width: `${teveel * 100}%`, background: "var(--messing)" }}
        />
      </div>
      <p className="mt-2 text-xs text-linnen/75">
        {begroot === 0
          ? "Vul hieronder per post in wat je voor dit jaar verwacht."
          : over
            ? `${Math.round((verschil / begroot) * 100)}% over de begroting`
            : `${Math.round(deel * 100)}% van de begroting besteed`}
      </p>
    </section>
  );
}

function PostKaart({
  post,
  jaar,
  bedragen,
  pasBedragAan,
  bewaarNu,
}: {
  post: Post;
  jaar: number;
  bedragen: Record<number, string>;
  pasBedragAan: (postId: number, tekst: string) => void;
  bewaarNu: (postId: number, tekst: string) => void;
}) {
  // Een hoofdpost meet zich met alles wat eronder hangt; een losse post met
  // zichzelf. Anders leg je een begroting van 800 naast de uitgaven van één subpost.
  const eigenBegroot = parseEuro(bedragen[post.id] ?? "");
  const samenBegroot = [post, ...post.subposten].reduce(
    (som, p) => som + (parseEuro(bedragen[p.id] ?? "") ?? 0),
    0,
  );
  const heeftSub = post.subposten.length > 0;
  const begroot = heeftSub ? samenBegroot : eigenBegroot;
  const besteed = heeftSub ? post.werkelijkCent : post.eigenCent;
  const deel = begroot && begroot > 0 ? besteed / begroot : null;
  const verschil = begroot === null ? null : begroot - besteed;

  return (
    <section className="rounded-2xl border border-rand bg-paneel p-4">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ background: post.kleur }}
        />
        <Link
          href={`/uitgaven?jaar=${jaar}&post=${post.id}`}
          title={`Uitgaven op ${post.naam} in ${jaar}`}
          className="min-w-0 flex-1 text-sm font-semibold hover:text-link"
        >
          <span className="line-clamp-2">{post.naam}</span>
          {!post.actief && (
            <span className="ml-1 text-xs font-normal text-gedempt">
              (inactief)
            </span>
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
          className="cijfers w-[104px] shrink-0 rounded-lg border border-rand-sterk bg-verzonken px-2.5 py-2 text-right text-[13px]"
        />
      </div>

      {/* Geen begroting, geen balk -- een volle balk zou lezen als "helemaal op". */}
      {deel !== null && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-linnen-diep">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, deel * 100)}%`,
              background: deel > 1 ? "var(--messing-inkt)" : post.kleur,
            }}
          />
        </div>
      )}
      <div className="cijfers flex justify-between text-[11.5px] text-gedempt">
        <span>besteed {formatEuro(besteed)}</span>
        {verschil === null || begroot === 0 ? (
          <span className="text-messing-inkt">
            {besteed > 0 ? "niet begroot" : "—"}
          </span>
        ) : (
          <span className={verschil < 0 ? "text-messing-inkt" : "text-goed"}>
            {verschil < 0
              ? `${formatEuro(-verschil)} te veel`
              : `over ${formatEuro(verschil)}`}
          </span>
        )}
      </div>

      {heeftSub && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-dashed border-rand-sterk pt-3">
          {post.subposten.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2.5 text-[13px]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-zacht"
              />
              <Link
                href={`/uitgaven?jaar=${jaar}&post=${sub.id}`}
                className="min-w-0 flex-1 truncate text-tekst/75 hover:text-link"
              >
                {sub.naam}
              </Link>
              <span className="cijfers shrink-0 text-[11.5px] text-gedempt">
                {formatEuro(sub.eigenCent)}
              </span>
              <input
                name={`post-${sub.id}`}
                inputMode="decimal"
                placeholder="—"
                value={bedragen[sub.id] ?? ""}
                onChange={(e) => pasBedragAan(sub.id, e.target.value)}
                onBlur={(e) => bewaarNu(sub.id, e.target.value)}
                aria-label={`Begroot voor ${sub.naam}`}
                className="cijfers w-[88px] shrink-0 rounded-lg border border-rand bg-verzonken px-2 py-1.5 text-right text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </section>
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
        <KleurKiezer
          key={post.kleur}
          begin={post.kleur}
          label={`Kleur voor ${post.naam}`}
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
        <label className="flex items-center gap-1.5 text-sm text-gedempt">
          <input
            type="checkbox"
            name="actief"
            defaultChecked={post.actief}
            className="accent-[var(--inkt)]"
          />
          actief
        </label>
        <button className="rounded-xl border border-rand-sterk px-3.5 py-2.5 text-sm font-semibold">
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
          className="rounded-xl px-3 py-2.5 text-sm text-slecht underline disabled:opacity-50"
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
    <form
      action={toevoegen}
      className="flex flex-1 flex-wrap items-center gap-2"
    >
      <KleurKiezer begin="#2F5C8A" label="Kleur" />
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
        className="rounded-xl bg-inkt px-4 py-3 text-sm font-semibold text-linnen disabled:opacity-50"
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
