"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import PostLijst, { type LijstRij } from "./PostLijst";
import PostDetail, { type DetailHaken } from "./PostDetail";
import NieuwePost from "./NieuwePost";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  begrootVanOntwerp,
  ontwerpVan,
  type BegrotingsPost,
  type PostOntwerp,
} from "@/lib/begroting";
import {
  bewaarPostAction,
  neemVorigJaarOverAction,
  nieuwePostAction,
  verwijderPostAction,
  zetBedragAction,
} from "@/app/(app)/begroting/actions";

/** Hoofdposten met hun subposten erachter. */
function plat(posten: BegrotingsPost[]): BegrotingsPost[] {
  return posten.flatMap((post) => [post, ...post.subposten]);
}

type Status = { bezig: boolean; fout: string | null; melding: string | null };

/**
 * Past het blad ernaast, of wordt het een eigen scherm? Met alleen CSS zou het blad
 * twee keer in de pagina staan -- twee keer dezelfde invoervelden, die om de cursor
 * gaan vechten zodra er een regel bijkomt. Dus vragen we het de browser.
 *
 * Op de server weten we de breedte niet; daar gaan we uit van een breed scherm, en
 * zodra de pagina in de browser leeft klopt het antwoord.
 */
function useBreed(): boolean {
  return useSyncExternalStore(
    (herteken) => {
      const vraag = window.matchMedia("(min-width: 1024px)");
      vraag.addEventListener("change", herteken);
      return () => vraag.removeEventListener("change", herteken);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

/**
 * Het begrotingsscherm: links de posten, rechts de post waar je mee bezig bent.
 * Op een telefoon worden dat twee stappen -- de lijst klapt uit met de cijfers, en
 * het blad is een eigen scherm.
 *
 * Alle bedragen op het scherm komen uit `ontwerpen` en niet rechtstreeks uit de
 * database. Zo beweegt de lijst links meteen mee terwijl je rechts typt, en hoeft er
 * tussendoor niets ververst te worden.
 */
export default function BegrotingScherm({
  jaar,
  posten,
}: {
  jaar: number;
  posten: BegrotingsPost[];
}) {
  const alle = useMemo(() => plat(posten), [posten]);
  const breed = useBreed();
  const router = useRouter();

  const [ontwerpen, zetOntwerpen] = useState<Record<number, PostOntwerp>>(() =>
    Object.fromEntries(alle.map((post) => [post.id, ontwerpVan(post)])),
  );
  const [gekozenId, zetGekozenId] = useState<number | null>(
    posten[0]?.id ?? null,
  );
  const [modus, zetModus] = useState<"detail" | "nieuw">("detail");
  const [uitgeklapt, zetUitgeklapt] = useState<number | null>(null);
  /** Op een telefoon: staat het detailscherm over de lijst heen? */
  const [mobielOpen, zetMobielOpen] = useState(false);
  const [toonAlles, zetToonAlles] = useState(false);
  const [status, zetStatus] = useState<Status>({
    bezig: false,
    fout: null,
    melding: null,
  });
  const [bewaard, zetBewaard] = useState<Record<number, boolean>>({});
  /** Net aangemaakt, dus nog zonder bedrag -- anders valt hij meteen uit het filter. */
  const [vers, zetVers] = useState<number[]>([]);

  // Komt er nieuwe serverstand binnen -- een ander jaar, of een post erbij of eraf --
  // dan horen de velden die stand te tonen in plaats van wat er nog lokaal stond.
  const kenmerk = [
    jaar,
    ...alle.map(
      (post) =>
        `${post.id}:${post.naam}:${post.kleur}:${post.actief}:${post.ouderId}:` +
        post.regels.map((r) => `${r.id}/${r.naam}/${r.bedragCent}`).join(","),
    ),
  ].join("|");
  const [vorigKenmerk, zetVorigKenmerk] = useState(kenmerk);
  if (vorigKenmerk !== kenmerk) {
    zetVorigKenmerk(kenmerk);
    zetOntwerpen(
      Object.fromEntries(alle.map((post) => [post.id, ontwerpVan(post)])),
    );
    if (gekozenId !== null && !alle.some((post) => post.id === gekozenId)) {
      zetGekozenId(posten[0]?.id ?? null);
      zetModus("detail");
    }
  }

  /* ---- opslaan ------------------------------------------------------------ */

  /**
   * Elk veld bewaart zichzelf: kort nadat je stopt met typen, en meteen als je het
   * verlaat. Per post staat er hooguit één opdracht klaar; een nieuwe toetsaanslag
   * vervangt de vorige, zodat er niet voor elke letter een verzoek de deur uitgaat.
   */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const wachtend = useRef(new Map<string, () => Promise<void>>());
  const laatste = useRef(0);

  const voerUit = useCallback(async (sleutel: string) => {
    const taak = wachtend.current.get(sleutel);
    if (!taak) return;
    wachtend.current.delete(sleutel);
    clearTimeout(timers.current[sleutel]);
    await taak();
  }, []);

  /** Alles wat nog klaarstaat eerst wegschrijven; anders gaat het verloren. */
  const leegMaken = useCallback(async () => {
    await Promise.all([...wachtend.current.keys()].map((s) => voerUit(s)));
  }, [voerUit]);

  const plan = useCallback(
    (sleutel: string, taak: () => Promise<void>, meteen: boolean) => {
      clearTimeout(timers.current[sleutel]);
      wachtend.current.set(sleutel, taak);
      if (meteen) {
        void voerUit(sleutel);
      } else {
        timers.current[sleutel] = setTimeout(() => void voerUit(sleutel), 600);
      }
    },
    [voerUit],
  );

  const meldUitkomst = useCallback(
    (postId: number, uitkomst: { fout?: string } | null, nummer: number) => {
      if (nummer !== laatste.current) return; // er kwam alweer iets nieuwers
      zetStatus({
        bezig: false,
        fout: uitkomst?.fout ?? null,
        melding: uitkomst?.fout ? null : "opgeslagen",
      });
      if (!uitkomst?.fout) zetBewaard((h) => ({ ...h, [postId]: true }));
    },
    [],
  );

  const wijzig = useCallback(
    (postId: number, deel: Partial<PostOntwerp>, meteen = false) => {
      const nu = ontwerpen[postId];
      if (!nu) return;
      const nieuw = { ...nu, ...deel };
      zetOntwerpen((huidig) => ({ ...huidig, [postId]: nieuw }));
      zetBewaard((h) => (h[postId] ? { ...h, [postId]: false } : h));

      // Het losse bedrag heeft zijn eigen actie; die weigert terecht zodra er regels
      // staan, dus dan slaan we hem over en schrijft `bewaarPostAction` alles weg.
      if ("los" in deel && nieuw.regels.length === 0) {
        plan(
          `los-${postId}`,
          async () => {
            const nummer = ++laatste.current;
            zetStatus((h) => ({ ...h, bezig: true, fout: null }));
            const uitkomst = await zetBedragAction(jaar, postId, nieuw.los);
            meldUitkomst(postId, uitkomst, nummer);
          },
          meteen,
        );
      }

      const rest = Object.keys(deel).filter((sleutel) => sleutel !== "los");
      if (rest.length > 0) {
        plan(
          `post-${postId}`,
          async () => {
            const nummer = ++laatste.current;
            zetStatus((h) => ({ ...h, bezig: true, fout: null }));
            const uitkomst = await bewaarPostAction(jaar, postId, {
              naam: nieuw.naam,
              kleur: nieuw.kleur,
              actief: nieuw.actief,
              ouderId: nieuw.ouderId,
              regels: nieuw.regels.map((regel) => ({
                naam: regel.naam,
                bedrag: regel.bedrag,
              })),
            });
            meldUitkomst(postId, uitkomst, nummer);
          },
          meteen,
        );
      }
    },
    [jaar, plan, meldUitkomst, ontwerpen],
  );

  const bewaarNu = useCallback(
    (postId: number) => {
      void voerUit(`los-${postId}`);
      void voerUit(`post-${postId}`);
    },
    [voerUit],
  );

  /* ---- posten erbij en eraf ----------------------------------------------- */

  const kies = useCallback((postId: number) => {
    zetGekozenId(postId);
    zetModus("detail");
    zetUitgeklapt((open) => (open === postId ? null : postId));
  }, []);

  async function voegPostToe(invoer: {
    naam: string;
    kleur: string;
    ouderId: number | null;
    bedrag: string;
  }) {
    await leegMaken();
    zetStatus({ bezig: true, fout: null, melding: null });
    const uitkomst = await nieuwePostAction({
      naam: invoer.naam,
      kleur: invoer.kleur,
      ouderId: invoer.ouderId,
    });
    if (uitkomst?.fout || !uitkomst?.id) {
      zetStatus({
        bezig: false,
        fout: uitkomst?.fout ?? "Toevoegen is niet gelukt.",
        melding: null,
      });
      return;
    }
    if (invoer.bedrag.trim() !== "") {
      // `nieuwePostAction` heeft de pagina al ververst, dus het bedrag dat hierna
      // wordt weggeschreven zou pas bij de volgende keer kijken in beeld komen.
      await zetBedragAction(jaar, uitkomst.id, invoer.bedrag);
      router.refresh();
    }
    zetVers((huidig) => [...huidig, uitkomst.id!]);
    zetGekozenId(uitkomst.id);
    zetModus("detail");
    zetStatus({ bezig: false, fout: null, melding: uitkomst.gelukt ?? null });
  }

  async function verwijder(postId: number) {
    await leegMaken();
    zetStatus({ bezig: true, fout: null, melding: null });
    const uitkomst = await verwijderPostAction(postId);
    if (uitkomst?.fout) {
      zetStatus({ bezig: false, fout: uitkomst.fout, melding: null });
      return;
    }
    zetGekozenId(posten.find((post) => post.id !== postId)?.id ?? null);
    zetMobielOpen(false);
    zetStatus({ bezig: false, fout: null, melding: uitkomst?.gelukt ?? null });
  }

  async function neemOver() {
    await leegMaken();
    zetStatus({ bezig: true, fout: null, melding: null });
    const uitkomst = await neemVorigJaarOverAction(jaar);
    zetStatus({
      bezig: false,
      fout: uitkomst?.fout ?? null,
      melding: uitkomst?.gelukt ?? null,
    });
  }

  /* ---- wat er op het scherm komt ------------------------------------------ */

  const begrootVan = useCallback(
    (post: BegrotingsPost): number | null => {
      const ontwerp = ontwerpen[post.id];
      return ontwerp ? begrootVanOntwerp(ontwerp, parseEuro) : post.begrootCent;
    },
    [ontwerpen],
  );

  const totaalVan = useCallback(
    (post: BegrotingsPost): number | null => {
      const delen = [
        begrootVan(post),
        ...post.subposten.map((sub) => begrootVan(sub)),
      ].filter((cent): cent is number => cent !== null);
      return delen.length === 0 ? null : delen.reduce((som, c) => som + c, 0);
    },
    [begrootVan],
  );

  const heeftGebruikte = posten.some((post) => post.inGebruik);
  // Een jaar waarin nog niets staat zou anders leeg blijven zonder weg vooruit.
  const allesTonen = toonAlles || !heeftGebruikte;
  const zichtbaar = allesTonen
    ? posten
    : posten.filter((post) => post.inGebruik || vers.includes(post.id));

  const rijen: LijstRij[] = zichtbaar.map((post) => ({
    id: post.id,
    naam: ontwerpen[post.id]?.naam ?? post.naam,
    kleur: ontwerpen[post.id]?.kleur ?? post.kleur,
    actief: ontwerpen[post.id]?.actief ?? post.actief,
    begrootCent: totaalVan(post),
    besteedCent: post.werkelijkCent,
    subs: post.subposten.map((sub) => ({
      id: sub.id,
      naam: ontwerpen[sub.id]?.naam ?? sub.naam,
      begrootCent: begrootVan(sub),
      besteedCent: sub.werkelijkCent,
    })),
  }));

  const totalen = useMemo(() => {
    let begroot = 0;
    let iets = false;
    for (const post of alle) {
      const ontwerp = ontwerpen[post.id];
      const cent = ontwerp
        ? begrootVanOntwerp(ontwerp, parseEuro)
        : post.begrootCent;
      if (cent !== null) {
        begroot += cent;
        iets = true;
      }
    }
    // Eigen bedragen optellen, niet de opgetelde: anders telt een subpost dubbel.
    const besteed = alle.reduce((som, post) => som + post.eigenCent, 0);
    return { begroot: iets ? begroot : 0, besteed };
  }, [alle, ontwerpen]);

  const gekozen = alle.find((post) => post.id === gekozenId) ?? null;
  const hoofdpostVan =
    gekozen?.ouderId != null
      ? (posten.find((post) => post.id === gekozen.ouderId) ?? null)
      : null;

  const haken: DetailHaken = {
    jaar,
    ontwerpen,
    wijzig: (postId, deel) => wijzig(postId, deel),
    wijzigEnBewaar: (postId, deel) => wijzig(postId, deel, true),
    bewaarNu,
    bewaard,
    kies: (postId) => {
      zetGekozenId(postId);
      zetModus("detail");
    },
  };

  const blad =
    modus === "nieuw" ? (
      <NieuwePost
        jaar={jaar}
        hoofdposten={posten}
        toevoegen={voegPostToe}
        annuleer={() => {
          zetModus("detail");
          zetMobielOpen(false);
        }}
        fout={status.fout}
        terug={
          breed
            ? undefined
            : () => {
                zetModus("detail");
                zetMobielOpen(false);
              }
        }
      />
    ) : gekozen ? (
      <PostDetail
        post={gekozen}
        hoofdpost={hoofdpostVan}
        hoofdposten={posten}
        haken={haken}
        status={status}
        voegSubToe={async (naam, bedrag) => {
          await voegPostToe({
            naam,
            kleur: gekozen.kleur,
            ouderId: gekozen.id,
            bedrag,
          });
          zetGekozenId(gekozen.id);
        }}
        verwijder={verwijder}
        terug={breed ? undefined : () => zetMobielOpen(false)}
      />
    ) : null;

  return (
    <>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          <Stand begroot={totalen.begroot} besteed={totalen.besteed} />

          <PostLijst
            jaar={jaar}
            rijen={rijen}
            gekozenId={modus === "nieuw" ? null : gekozenId}
            uitgeklapt={uitgeklapt}
            kies={kies}
            naarDetail={(postId) => {
              zetGekozenId(postId);
              zetModus("detail");
              zetMobielOpen(true);
            }}
            nieuw={() => {
              zetModus("nieuw");
              zetMobielOpen(true);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            {heeftGebruikte ? (
              <label className="flex min-h-11 items-center gap-2 text-xs text-gedempt lg:min-h-0">
                <input
                  type="checkbox"
                  checked={toonAlles}
                  onChange={(e) => zetToonAlles(e.target.checked)}
                  className="h-[18px] w-[18px] accent-[var(--inkt)] lg:h-4 lg:w-4"
                />
                Alle posten tonen
              </label>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => void neemOver()}
              disabled={status.bezig}
              className="min-h-10 rounded-full border border-dashed border-rand-sterk px-3.5 text-[12.5px] text-gedempt transition hover:border-inkt hover:text-inkt disabled:opacity-50"
            >
              Overnemen uit {jaar - 1}
            </button>
          </div>

          {/* De meldingen van de lijst; het blad heeft zijn eigen statusregel. */}
          {(status.fout || status.melding) && modus !== "detail" && (
            <p className="px-1 text-sm text-pretty">
              {status.fout ? (
                <span className="text-slecht">{status.fout}</span>
              ) : (
                <span className="text-goed">{status.melding}</span>
              )}
            </p>
          )}
        </div>

        {/* Op een laptop staat het blad ernaast en blijft het staan bij scrollen. */}
        {breed && (
          <div className="min-w-0 lg:sticky lg:top-5">
            {blad ?? (
              <p className="rounded-2xl border border-dashed border-rand-sterk p-6 text-sm text-gedempt text-pretty">
                Nog geen posten. Begin met een paar hoofdposten — Onderhoud,
                Liggeld, Uitrusting — en splits ze op zodra je wilt laten zien
                hoe je aan een bedrag komt.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Op een telefoon is het blad een eigen scherm over de lijst heen. */}
      {!breed && mobielOpen && blad && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-achtergrond p-[18px]">
          {blad}
        </div>
      )}
    </>
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
    <section className="rounded-2xl bg-inkt p-4 text-linnen lg:p-[18px]">
      <div className="bovenschrift !text-messing">
        {begroot === 0
          ? "Nog niets begroot"
          : over
            ? "Boven begroting"
            : "Nog te besteden"}
      </div>
      <div className="titel cijfers mt-1.5 truncate text-[30px] leading-tight lg:text-[34px]">
        {formatEuro(Math.abs(verschil))}
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-linnen/20">
        <span
          style={{ width: `${deel * 100}%`, background: "var(--marine-zacht)" }}
        />
        <span
          style={{ width: `${teveel * 100}%`, background: "var(--messing)" }}
        />
      </div>
      <div className="cijfers mt-2 flex justify-between gap-3 text-[11px] text-linnen/65">
        <span className="truncate">begroot {formatEuro(begroot)}</span>
        <span className="truncate">besteed {formatEuro(besteed)}</span>
      </div>
    </section>
  );
}
