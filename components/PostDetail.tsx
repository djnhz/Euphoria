"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  begrootVanOntwerp,
  type BegrotingsPost,
  type PostOntwerp,
  type RegelInvoer,
} from "@/lib/begroting";
import { POSTKLEUREN } from "@/lib/kleuren";
import { standVan } from "./PostLijst";

/** Wat het scherm van een post weet en kan; één set voor de post en zijn subposten. */
export type DetailHaken = {
  jaar: number;
  ontwerpen: Record<number, PostOntwerp>;
  /** Een veld gewijzigd: meteen in beeld, kort daarna opgeslagen. */
  wijzig: (postId: number, deel: Partial<PostOntwerp>) => void;
  /** Hetzelfde, maar bewaar nu meteen -- voor een klik in plaats van typen. */
  wijzigEnBewaar: (postId: number, deel: Partial<PostOntwerp>) => void;
  /** Het veld verlaten: niet wachten op de timer. */
  bewaarNu: (postId: number) => void;
  /** Posten waarvan de laatste opslag gelukt is; goed voor het vinkje. */
  bewaard: Record<number, boolean>;
  kies: (postId: number) => void;
};

/**
 * Het detailblad: rechts op een laptop, een eigen scherm op een telefoon. Alles is
 * hier rechtstreeks te bewerken -- klik op de naam, het kleurblokje of een bedrag.
 *
 * Er is geen opslaanknop. Elk veld bewaart zichzelf kort nadat je stopt met typen,
 * en meteen als je het verlaat; de lijst links beweegt intussen mee omdat hij naar
 * dezelfde staat kijkt.
 */
export default function PostDetail({
  post,
  hoofdpost,
  hoofdposten,
  haken,
  status,
  voegSubToe,
  verwijder,
  terug,
}: {
  post: BegrotingsPost;
  /** De post waar deze onder hangt, als het een subpost is. */
  hoofdpost: BegrotingsPost | null;
  /** Waar deze post naartoe verplaatst zou kunnen worden. */
  hoofdposten: BegrotingsPost[];
  haken: DetailHaken;
  status: { bezig: boolean; fout: string | null; melding: string | null };
  voegSubToe: (naam: string, bedrag: string) => Promise<void>;
  verwijder: (postId: number) => Promise<void>;
  /** Alleen op een telefoon: de weg terug naar de lijst. */
  terug?: () => void;
}) {
  const { jaar, ontwerpen, wijzig, wijzigEnBewaar, bewaarNu } = haken;
  const ontwerp = ontwerpen[post.id];
  const [kleurOpen, zetKleurOpen] = useState(false);
  const [subOpen, zetSubOpen] = useState(false);

  // Een andere post gekozen? Dan hoort wat er openstond dicht te gaan.
  const [vorigePost, zetVorigePost] = useState(post.id);
  if (vorigePost !== post.id) {
    zetVorigePost(post.id);
    zetKleurOpen(false);
    zetSubOpen(false);
  }

  if (!ontwerp) return null;

  const eigen = begrootVanOntwerp(ontwerp, parseEuro);
  const subBedragen = post.subposten.map((sub) => {
    const o = ontwerpen[sub.id];
    return o ? begrootVanOntwerp(o, parseEuro) : sub.begrootCent;
  });
  const delen = [eigen, ...subBedragen].filter((c): c is number => c !== null);
  const begroot = delen.length === 0 ? null : delen.reduce((s, c) => s + c, 0);

  const uitgaven =
    post.uitgaven + post.subposten.reduce((som, sub) => som + sub.uitgaven, 0);
  const stand = standVan(begroot, post.werkelijkCent, ontwerp.kleur);

  const heeftRegels = ontwerp.regels.length > 0;
  const heeftSub = post.subposten.length > 0;
  /** Het snelle veld bovenin kan alleen als er verder niets onder de post hangt. */
  const losBoven = !heeftRegels && !heeftSub;

  return (
    <div className="overflow-hidden rounded-2xl border border-rand bg-paneel">
      {/* De weg terug hoort bij het telefoonscherm; op een laptop staat het blad
          gewoon naast de lijst en is er niets om uit te stappen. */}
      {terug && (
        <div className="flex items-center justify-between gap-3 border-b border-rand pr-2 pl-1 lg:hidden">
          <button
            type="button"
            onClick={terug}
            className="min-h-11 px-3 text-[15px] text-link"
          >
            ‹ Begroting
          </button>
          <Actief post={post} ontwerp={ontwerp} zet={wijzigEnBewaar} />
        </div>
      )}

      <div className="flex items-start justify-between gap-4 border-b border-rand px-5 pt-5 pb-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => zetKleurOpen((open) => !open)}
            aria-label="Kleur wijzigen"
            aria-expanded={kleurOpen}
            style={{ background: ontwerp.kleur }}
            className="mt-1 h-7 w-7 shrink-0 self-start rounded-lg shadow-[0_0_0_1px_var(--rand-sterk)] transition hover:shadow-[0_0_0_2px_var(--inkt)] lg:h-[22px] lg:w-[22px]"
          />
          <div className="min-w-0 flex-1">
            <input
              value={ontwerp.naam}
              onChange={(e) => wijzig(post.id, { naam: e.target.value })}
              onBlur={() => bewaarNu(post.id)}
              maxLength={60}
              aria-label="Naam van de post"
              title="Klik om te hernoemen"
              className="titel -ml-[7px] block min-h-11 w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[26px] leading-tight transition hover:border-rand-sterk hover:bg-verzonken focus:border-marine focus:bg-paneel focus:outline-none lg:min-h-0"
            />
            <div className="flex flex-wrap items-center gap-x-3">
              <Link
                href={`/uitgaven?jaar=${jaar}&post=${post.id}`}
                className="inline-block py-1 text-[13px] text-link hover:text-inkt"
              >
                {uitgaven === 1 ? "1 uitgave" : `${uitgaven} uitgaven`} in{" "}
                {jaar} ›
              </Link>
              {hoofdpost && (
                <button
                  type="button"
                  onClick={() => haken.kies(hoofdpost.id)}
                  className="min-w-0 truncate py-1 text-[12.5px] text-gedempt hover:text-inkt"
                >
                  subpost onder {hoofdpost.naam}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className={terug ? "hidden lg:block" : ""}>
          <Actief post={post} ontwerp={ontwerp} zet={wijzigEnBewaar} />
        </div>
      </div>

      {kleurOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-rand bg-verzonken px-5 py-3 lg:px-6">
          <span className="mr-1 text-[12.5px] text-gedempt">Kleur</span>
          {POSTKLEUREN.map((kleur) => {
            const aan = kleur.toLowerCase() === ontwerp.kleur.toLowerCase();
            return (
              <button
                key={kleur}
                type="button"
                onClick={() => wijzigEnBewaar(post.id, { kleur })}
                aria-label={`Kleur ${kleur}`}
                aria-pressed={aan}
                style={{ background: kleur }}
                className={`h-8 w-8 rounded-lg transition lg:h-[26px] lg:w-[26px] ${
                  aan
                    ? "ring-2 ring-inkt ring-offset-1"
                    : "opacity-70 hover:opacity-100"
                }`}
              />
            );
          })}
          <button
            type="button"
            onClick={() => zetKleurOpen(false)}
            className="ml-auto min-h-11 text-[12.5px] text-gedempt hover:text-inkt lg:min-h-0"
          >
            Klaar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 px-5 py-5 lg:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="col-span-2 min-w-0 rounded-xl border border-rand bg-verzonken px-3.5 py-3 lg:col-span-1">
            <div className="bovenschrift">Begroot {jaar}</div>
            {losBoven ? (
              <div className="mt-1.5">
                <Bedragveld
                  waarde={ontwerp.los}
                  bewaard={haken.bewaard[post.id] ?? false}
                  label={`Begroot voor ${post.naam}`}
                  onChange={(los) => wijzig(post.id, { los })}
                  onBlur={() => bewaarNu(post.id)}
                  className="w-full"
                  groot
                />
              </div>
            ) : (
              <>
                <div className="cijfers mt-2 truncate text-xl font-medium">
                  {begroot === null ? "—" : formatEuro(begroot)}
                </div>
                <div className="mt-0.5 text-[11px] text-gedempt">
                  {!heeftSub
                    ? "som van de regels"
                    : heeftRegels
                      ? "regels plus subposten"
                      : ontwerp.los.trim() === ""
                        ? "som van de subposten"
                        : "eigen bedrag plus subposten"}
                </div>
              </>
            )}
          </div>
          <div className="min-w-0 rounded-xl border border-rand px-3.5 py-3">
            <div className="bovenschrift">Besteed</div>
            <div className="cijfers mt-2 truncate text-base sm:text-xl font-medium">
              {formatEuro(post.werkelijkCent)}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gedempt">
              {uitgaven === 1 ? "1 uitgave" : `${uitgaven} uitgaven`}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-rand px-3.5 py-3">
            <div className="bovenschrift">Nog over</div>
            <div
              className={`cijfers mt-2 truncate text-base sm:text-xl font-medium ${stand.verschilKleur}`}
            >
              {stand.verschilKort}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gedempt">
              {stand.deelTekst}
            </div>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-linnen-diep">
          <div
            className="h-full rounded-full"
            style={{ width: stand.balkBreedte, background: stand.balkKleur }}
          />
        </div>

        <Opbouw
          key={`opbouw-${post.id}`}
          post={post}
          ontwerp={ontwerp}
          losBoven={losBoven}
          bewaard={haken.bewaard[post.id] ?? false}
          wijzig={(deel) => wijzig(post.id, deel)}
          bewaarNu={() => bewaarNu(post.id)}
        />

        {!hoofdpost && (
          <Subposten
            key={`sub-${post.id}`}
            post={post}
            haken={haken}
            open={subOpen}
            zetOpen={zetSubOpen}
            voegToe={voegSubToe}
          />
        )}

        <Plek
          post={post}
          ontwerp={ontwerp}
          hoofdposten={hoofdposten}
          zet={wijzigEnBewaar}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rand pt-3 text-xs text-gedempt">
          <span aria-live="polite" className="min-w-0 flex-1 text-pretty">
            {status.fout ? (
              <span className="text-slecht">{status.fout}</span>
            ) : status.bezig ? (
              "opslaan…"
            ) : (
              (status.melding ?? "Wijzigingen worden vanzelf opgeslagen.")
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              if (confirm(`"${ontwerp.naam}" verwijderen?`)) {
                void verwijder(post.id);
              }
            }}
            className="min-h-11 shrink-0 text-[12.5px] text-slecht underline lg:min-h-0"
          >
            Post verwijderen…
          </button>
        </div>
      </div>
    </div>
  );
}

function Actief({
  post,
  ontwerp,
  zet,
}: {
  post: BegrotingsPost;
  ontwerp: PostOntwerp;
  zet: (postId: number, deel: Partial<PostOntwerp>) => void;
}) {
  return (
    <label className="flex min-h-11 shrink-0 items-center gap-2 px-2 text-xs whitespace-nowrap text-gedempt lg:min-h-0 lg:px-0 lg:pt-1.5">
      <input
        type="checkbox"
        checked={ontwerp.actief}
        onChange={(e) => zet(post.id, { actief: e.target.checked })}
        className="h-4 w-4 accent-[var(--inkt)]"
      />
      actief
    </label>
  );
}

/**
 * Waar het bedrag vandaan komt. Een regel bestaat alleen in de begroting: hij laat
 * zien hoe je aan een bedrag komt en is nergens te kiezen als categorie. Wil je er
 * bonnen op kunnen boeken, dan moet het een subpost zijn -- vandaar de zin eronder.
 */
function Opbouw({
  post,
  ontwerp,
  losBoven,
  bewaard,
  wijzig,
  bewaarNu,
}: {
  post: BegrotingsPost;
  ontwerp: PostOntwerp;
  /** Staat het losse bedrag al bovenin? Dan hoort het hier niet nog een keer. */
  losBoven: boolean;
  bewaard: boolean;
  wijzig: (deel: Partial<PostOntwerp>) => void;
  bewaarNu: () => void;
}) {
  const teller = useRef(0);
  /** Het veld dat net is bijgekomen krijgt de cursor, en alleen die ene keer. */
  const [verse, zetVerse] = useState<string | null>(null);

  function nieuweSleutel() {
    teller.current += 1;
    return `nieuw-${post.id}-${teller.current}`;
  }

  function voegRegelToe() {
    const sleutel = nieuweSleutel();
    // Stond er een los bedrag, dan wordt dat zichtbaar de eerste regel in plaats van
    // stilletjes te verdwijnen -- het totaal blijft zo hetzelfde.
    const basis: RegelInvoer[] =
      ontwerp.regels.length === 0 && ontwerp.los.trim() !== ""
        ? [{ sleutel: nieuweSleutel(), naam: "", bedrag: ontwerp.los }]
        : ontwerp.regels;
    zetVerse(sleutel);
    wijzig({
      los: "",
      regels: [...basis, { sleutel, naam: "", bedrag: "" }],
    });
  }

  function pasRegelAan(sleutel: string, deel: Partial<RegelInvoer>) {
    wijzig({
      regels: ontwerp.regels.map((regel) =>
        regel.sleutel === sleutel ? { ...regel, ...deel } : regel,
      ),
    });
  }

  function verwijderRegel(regel: RegelInvoer) {
    const gevuld = regel.naam.trim() !== "" || regel.bedrag.trim() !== "";
    if (gevuld && !confirm(`"${regel.naam || "deze regel"}" weghalen?`)) return;
    wijzig({
      regels: ontwerp.regels.filter((r) => r.sleutel !== regel.sleutel),
    });
  }

  const aantal = ontwerp.regels.length;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="bovenschrift">Opbouw</span>
        <span className="cijfers text-[11px] text-gedempt">
          {aantal === 0
            ? "los bedrag"
            : aantal === 1
              ? "1 regel"
              : `${aantal} regels`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-rand">
        {/* Hangen er subposten onder, dan hoort het eigen bedrag hier te staan in
            plaats van verstopt in het totaal bovenin. */}
        {aantal === 0 && !losBoven && (
          <div className="flex flex-wrap items-center gap-2 border-b border-rand px-3.5 py-2">
            <span className="min-w-0 basis-full truncate text-[13.5px] text-tekst/75 sm:basis-0 sm:grow">
              rechtstreeks op {post.naam}
            </span>
            <Bedragveld
              waarde={ontwerp.los}
              bewaard={bewaard}
              label={`Rechtstreeks begroot op ${post.naam}`}
              onChange={(los) => wijzig({ los })}
              onBlur={bewaarNu}
              className="ml-auto w-[140px] sm:ml-0 sm:w-[120px]"
            />
          </div>
        )}

        {ontwerp.regels.map((regel) => (
          /* Op een telefoon twee regels: eerst de naam over de volle breedte, dan het
             bedrag. Vanaf `sm` past alles op één rij -- `contents` haalt de twee
             groepjes dan weg zodat de velden zelf uitlijnen. */
          <div
            key={regel.sleutel}
            className="border-b border-rand px-3.5 py-2 transition last:border-b-0 hover:bg-verzonken sm:flex sm:items-center sm:gap-2"
          >
            <div className="flex items-center gap-1 sm:contents">
              <input
                value={regel.naam}
                autoFocus={regel.sleutel === verse}
                onFocus={() => {
                  if (regel.sleutel === verse) zetVerse(null);
                }}
                onChange={(e) =>
                  pasRegelAan(regel.sleutel, { naam: e.target.value })
                }
                onBlur={bewaarNu}
                maxLength={60}
                placeholder="waarvoor is dit?"
                aria-label="Naam van de regel"
                className="-ml-[7px] min-h-11 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[13.5px] transition hover:border-rand-sterk hover:bg-paneel focus:border-marine focus:bg-paneel focus:outline-none sm:order-1 sm:min-h-0 sm:py-1.5"
              />
              <button
                type="button"
                onClick={() => verwijderRegel(regel)}
                aria-label={`${regel.naam || "Regel"} verwijderen`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg leading-none text-zacht transition hover:bg-linnen-diep hover:text-slecht sm:order-3 sm:h-7 sm:w-7 sm:text-base"
              >
                ×
              </button>
            </div>
            <div className="mt-1 flex justify-end sm:contents">
              <Bedragveld
                waarde={regel.bedrag}
                bewaard={bewaard}
                label={`Bedrag bij ${regel.naam || "deze regel"}`}
                onChange={(bedrag) => pasRegelAan(regel.sleutel, { bedrag })}
                onBlur={bewaarNu}
                className="w-[150px] sm:order-2 sm:w-[120px]"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={voegRegelToe}
          className="block min-h-12 w-full border-t border-rand px-3.5 text-left text-[13.5px] text-link transition hover:bg-verzonken hover:text-inkt sm:min-h-10"
        >
          + Regel
        </button>
      </div>
      <p className="mt-1.5 px-0.5 text-[11.5px] text-gedempt text-pretty">
        Een regel bestaat alleen in de begroting. Wil je er bonnen op kunnen
        boeken, maak er dan een subpost van.
      </p>
    </div>
  );
}

function Subposten({
  post,
  haken,
  open,
  zetOpen,
  voegToe,
}: {
  post: BegrotingsPost;
  haken: DetailHaken;
  open: boolean;
  zetOpen: (open: boolean) => void;
  voegToe: (naam: string, bedrag: string) => Promise<void>;
}) {
  const [naam, zetNaam] = useState("");
  const [bedrag, zetBedrag] = useState("");
  const [bezig, zetBezig] = useState(false);

  async function opslaan() {
    if (naam.trim() === "" || bezig) return;
    zetBezig(true);
    await voegToe(naam, bedrag);
    zetBezig(false);
    zetNaam("");
    zetBedrag("");
    zetOpen(false);
  }

  const aantal = post.subposten.length;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="bovenschrift">Subposten</span>
        <span className="cijfers text-[11px] text-gedempt">
          {aantal === 0
            ? "nog geen"
            : aantal === 1
              ? "1 subpost"
              : `${aantal} subposten`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-rand">
        {post.subposten.map((sub) => {
          const ontwerp = haken.ontwerpen[sub.id];
          if (!ontwerp) return null;
          const eigenRegels = ontwerp.regels.length > 0;
          return (
            /* Zelfde tweedeling als bij een regel: naam boven, cijfers eronder, en
               vanaf `sm` alles op één rij. */
            <div
              key={sub.id}
              className="border-b border-rand px-3.5 py-2 transition hover:bg-verzonken sm:flex sm:items-center sm:gap-2"
            >
              <div className="flex items-center gap-1 sm:contents">
                <input
                  value={ontwerp.naam}
                  onChange={(e) =>
                    haken.wijzig(sub.id, { naam: e.target.value })
                  }
                  onBlur={() => haken.bewaarNu(sub.id)}
                  maxLength={60}
                  aria-label="Naam van de subpost"
                  className="-ml-[7px] min-h-11 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm transition hover:border-rand-sterk hover:bg-paneel focus:border-marine focus:bg-paneel focus:outline-none sm:order-1 sm:min-h-0 sm:py-1.5"
                />
                <button
                  type="button"
                  onClick={() => haken.kies(sub.id)}
                  aria-label={`${ontwerp.naam} openen`}
                  title="Openen om te onderbouwen of te verwijderen"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zacht transition hover:bg-linnen-diep hover:text-inkt sm:order-4 sm:h-7 sm:w-7"
                >
                  ›
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 sm:contents">
                <span className="cijfers shrink-0 text-xs whitespace-nowrap text-gedempt sm:order-2">
                  besteed {formatEuro(sub.werkelijkCent)}
                </span>
                {eigenRegels ? (
                  <span className="cijfers w-[150px] shrink-0 text-right text-[13px] sm:order-3 sm:w-[110px]">
                    {formatEuro(begrootVanOntwerp(ontwerp, parseEuro) ?? 0)}
                  </span>
                ) : (
                  <Bedragveld
                    waarde={ontwerp.los}
                    bewaard={haken.bewaard[sub.id] ?? false}
                    label={`Begroot voor ${ontwerp.naam}`}
                    onChange={(los) => haken.wijzig(sub.id, { los })}
                    onBlur={() => haken.bewaarNu(sub.id)}
                    className="w-[150px] sm:order-3 sm:w-[110px]"
                  />
                )}
              </div>
            </div>
          );
        })}

        {open ? (
          <div className="flex flex-col gap-2 bg-marine-tint px-3.5 py-3 sm:flex-row sm:items-center">
            <input
              value={naam}
              autoFocus
              onChange={(e) => zetNaam(e.target.value)}
              maxLength={60}
              placeholder="Naam van de subpost"
              aria-label="Naam van de subpost"
              className="min-h-11 min-w-0 rounded-[10px] border border-rand-sterk bg-paneel px-3 text-[15px] sm:min-h-0 sm:flex-1 sm:py-2 sm:text-[13px]"
            />
            <div className="flex gap-2">
              <input
                value={bedrag}
                inputMode="decimal"
                onChange={(e) => zetBedrag(e.target.value)}
                placeholder="bedrag"
                aria-label="Begroot voor de subpost"
                className="cijfers min-h-11 w-full min-w-0 rounded-[10px] border border-rand-sterk bg-paneel px-3 text-right text-[15px] sm:min-h-0 sm:w-[100px] sm:py-2 sm:text-[13px]"
              />
              <button
                type="button"
                onClick={() => void opslaan()}
                disabled={bezig}
                className="min-h-11 shrink-0 rounded-[10px] bg-inkt px-4 text-sm font-semibold text-linnen disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-[13px]"
              >
                Toevoegen
              </button>
              <button
                type="button"
                onClick={() => zetOpen(false)}
                className="min-h-11 shrink-0 px-1 text-sm text-gedempt sm:min-h-0 sm:text-[13px]"
              >
                Annuleren
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => zetOpen(true)}
            className="block min-h-12 w-full px-3.5 text-left text-[13.5px] text-link transition hover:bg-verzonken hover:text-inkt sm:min-h-10"
          >
            + Subpost toevoegen — bijv. een geplande aankoop
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Een post verplaatsen tussen hoofdpost en subpost. Staat bewust onderin en klein:
 * je doet het zelden, maar zonder deze keuze zit een post voorgoed vast waar hij
 * bij het aanmaken is beland.
 */
function Plek({
  post,
  ontwerp,
  hoofdposten,
  zet,
}: {
  post: BegrotingsPost;
  ontwerp: PostOntwerp;
  hoofdposten: BegrotingsPost[];
  zet: (postId: number, deel: Partial<PostOntwerp>) => void;
}) {
  // Een post met subposten kan zelf nergens onder hangen: dat zou een derde laag geven.
  const mogelijk = hoofdposten.filter(
    (kandidaat) => kandidaat.id !== post.id && kandidaat.ouderId === null,
  );
  if (post.subposten.length > 0 || mogelijk.length === 0) return null;

  return (
    <label className="flex flex-wrap items-center gap-2">
      <span className="bovenschrift">Plek</span>
      <select
        value={ontwerp.ouderId ?? 0}
        onChange={(e) =>
          zet(post.id, { ouderId: Number(e.target.value) || null })
        }
        className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-rand-sterk bg-paneel px-3 text-[13px] sm:min-h-0 sm:flex-none sm:py-2"
      >
        <option value={0}>Eigen hoofdpost</option>
        {mogelijk.map((kandidaat) => (
          <option key={kandidaat.id} value={kandidaat.id}>
            Subpost onder {kandidaat.naam}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Een bedrag dat zichzelf opslaat, met een groen vinkje zodra dat gelukt is. */
function Bedragveld({
  waarde,
  bewaard,
  label,
  onChange,
  onBlur,
  className = "",
  groot = false,
}: {
  waarde: string;
  bewaard: boolean;
  label: string;
  onChange: (tekst: string) => void;
  onBlur: () => void;
  className?: string;
  /** Het veld bovenin het blad: dat is het hoofdgetal en mag groot. */
  groot?: boolean;
}) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <input
        value={waarde}
        inputMode="decimal"
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={label}
        className={`cijfers min-h-11 w-full rounded-lg border border-rand-sterk bg-paneel text-right focus:border-marine focus:outline-none sm:min-h-0 ${
          groot
            ? "py-2 pr-7 pl-3 text-lg font-medium"
            : "py-1.5 pr-6 pl-2.5 text-[13px]"
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-goed transition-opacity ${
          bewaard ? "opacity-100" : "opacity-0"
        }`}
      >
        ✓
      </span>
    </div>
  );
}
