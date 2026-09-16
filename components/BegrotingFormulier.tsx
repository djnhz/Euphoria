"use client";

import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import PostKaart from "./PostKaart";
import PostBlad from "./PostBlad";
import NieuwePost from "./NieuwePost";
import { formatEuro, parseEuro } from "@/lib/geld";
import type { BegrotingsPost as Post } from "@/lib/begroting";
import {
  neemVorigJaarOverAction,
  zetBedragAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";

/** Het losse bedrag als tekst; leeg zodra de post uit regels bestaat. */
function snelveldTekst(post: Post): string {
  const los = post.regels.find((r) => r.naam === null);
  if (!los || post.regels.some((r) => r.naam !== null)) return "";
  return (los.bedragCent / 100).toFixed(2).replace(".", ",");
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
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [blad, setBlad] = useState<Post | null>(null);
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
  /**
   * Het filter gaat over hoofdposten: een post die je voor volgend jaar aanmaakt hoort
   * niet in dit jaar te staan. Subposten volgen gewoon hun hoofdpost -- die eruit
   * filteren betekende dat een net toegevoegde subpost onzichtbaar bleef tot je er een
   * bedrag in had gezet, en dan lijkt toevoegen stuk.
   */
  const zichtbaar = allesTonen
    ? posten
    : posten.filter((post) => post.inGebruik);

  const [bedragen, setBedragen] = useState<Record<number, string>>(() =>
    Object.fromEntries(alle.map((p) => [p.id, snelveldTekst(p)])),
  );

  // Tijdens het typen verandert er niets aan de server, dus dit kenmerk blijft gelijk.
  // Wisselt het jaar, of komt er een nieuwe stand terug na opslaan of overnemen, dan
  // wel -- en dan horen de velden die stand te tonen in plaats van de oude invoer.
  const kenmerk = [
    jaar,
    ...alle.map(
      (p) =>
        `${p.id}=${p.regels.map((r) => `${r.id}:${r.naam}:${r.bedragCent}`).join(",")}`,
    ),
  ].join("|");
  const [vorigKenmerk, setVorigKenmerk] = useState(kenmerk);
  if (vorigKenmerk !== kenmerk) {
    setVorigKenmerk(kenmerk);
    setBedragen(Object.fromEntries(alle.map((p) => [p.id, snelveldTekst(p)])));
  }

  /**
   * Het snelveld slaat zichzelf op: kort nadat je stopt met typen, en meteen als je
   * het veld verlaat. Een teller houdt bij welke opdracht de laatste is, zodat een
   * traag antwoord een nieuwere invoer niet overschrijft in de melding. De regels in
   * het blad werken anders -- die gaan in één keer mee bij Opslaan.
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
    for (const post of alle) {
      // Bestaat de post uit regels, dan is de server leidend; anders het veld hier.
      begroot += post.regels.some((r) => r.naam !== null)
        ? (post.begrootCent ?? 0)
        : (parseEuro(bedragen[post.id] ?? "") ?? 0);
    }
    // Eigen bedragen optellen, niet de opgetelde: anders telt een subpost dubbel.
    const werkelijk = alle.reduce((som, p) => som + p.eigenCent, 0);
    return { begroot, werkelijk };
  }, [bedragen, alle]);

  const hoofdposten = posten;

  if (posten.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-2xl border border-dashed border-rand-sterk p-5 text-sm text-gedempt text-pretty">
          Nog geen posten. Begin met een paar hoofdposten — Onderhoud, Liggeld,
          Uitrusting — en splits ze op zodra je wilt laten zien hoe je aan een
          bedrag komt.
        </p>
        <div className="rounded-2xl border border-rand bg-paneel p-4">
          <NieuwePost ouderId={null} />
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
            open={setBlad}
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

      {/* Het snelveld op de kaart gaat vanzelf mee; de regels in het blad niet. */}
      <p className="h-4 px-1 text-xs text-gedempt" aria-live="polite">
        {status.fout ? (
          <span className="text-slecht">{status.fout}</span>
        ) : status.bezig ? (
          "opslaan…"
        ) : status.opgeslagenOp !== null ? (
          "opgeslagen"
        ) : (
          "Bedragen op de kaart worden vanzelf opgeslagen."
        )}
      </p>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setNieuwOpen((huidig) => !huidig)}
          className="flex-1 rounded-xl border border-rand-sterk bg-paneel px-3 py-3 text-[13.5px] font-semibold transition hover:border-inkt"
        >
          {nieuwOpen ? "Laat maar" : "+ Nieuwe post"}
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

      {nieuwOpen && (
        <div className="rounded-2xl border border-rand bg-paneel p-4">
          <NieuwePost ouderId={null} />
        </div>
      )}

      {blad && (
        <PostBlad
          post={blad}
          jaar={jaar}
          hoofdposten={hoofdposten.filter((h) => h.id !== blad.id)}
          sluit={() => setBlad(null)}
        />
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
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <p className="bovenschrift !text-messing">
            {begroot === 0
              ? "Nog niets begroot"
              : over
                ? "Boven begroting"
                : "Nog te besteden"}
          </p>
          <p className="titel cijfers mt-1.5 text-[34px] leading-tight sm:text-[38px]">
            {formatEuro(Math.abs(verschil))}
          </p>
        </div>
        {/* w-full duwt dit blok op een telefoon naar een eigen regel; daarnaast staat
            het gewoon rechts. */}
        <div className="cijfers flex w-full gap-x-4 text-[11px] text-linnen/65 sm:w-auto sm:flex-col sm:text-right sm:leading-loose">
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

function Uitkomst({ state }: { state: BegrotingState }) {
  if (!state) return null;
  if (state.fout)
    return <p className="text-sm text-slecht text-pretty">{state.fout}</p>;
  return <p className="text-sm text-goed">{state.gelukt}</p>;
}
