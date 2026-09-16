"use client";

import Link from "next/link";
import { formatEuro, parseEuro } from "@/lib/geld";
import { heeftRegels, type BegrotingsPost as Post } from "@/lib/begroting";

/**
 * Een post in het overzicht: wat er begroot staat, waaruit dat is opgebouwd, en
 * hoever je bent.
 *
 * Eén getal bovenaan: het totaal van deze kaart, dus de post plus alles wat eronder
 * hangt. Dat is wat naast "besteed" hoort te staan, want dat telt de subposten ook
 * mee. Waar dat totaal uit bestaat staat eronder, regel voor regel -- "3 regels" laat
 * je raden, en dan moet je het blad openen om te zien wat je zelf hebt ingevuld.
 *
 * Bewerken gebeurt in het blad achter het potlood. De enige uitzondering is een bedrag
 * dat nergens uit is opgebouwd: dat blijft rechtstreeks aanpasbaar, want dat is de
 * snelste weg en die is het waard om te houden.
 */
export default function PostKaart({
  post,
  jaar,
  bedragen,
  pasBedragAan,
  bewaarNu,
  open,
}: {
  post: Post;
  jaar: number;
  bedragen: Record<number, string>;
  pasBedragAan: (postId: number, tekst: string) => void;
  bewaarNu: (postId: number, tekst: string) => void;
  /** Het bewerkblad openen voor deze post of een subpost ervan. */
  open: (post: Post) => void;
}) {
  /** Wat één post bijdraagt: uit zijn regels, of anders uit het veld op het scherm. */
  const bijdrage = (p: Post): number | null =>
    heeftRegels(p.regels) ? p.begrootCent : parseEuro(bedragen[p.id] ?? "");
  const som = (p: Post) => bijdrage(p) ?? 0;

  const eigenRegels = post.regels.filter((r) => r.naam !== null);
  const heeftOnderdelen = eigenRegels.length > 0 || post.subposten.length > 0;

  const totaal = som(post) + post.subposten.reduce((s, sub) => s + som(sub), 0);
  const ietsBegroot =
    bijdrage(post) !== null || post.subposten.some((s) => bijdrage(s) !== null);
  const besteed = post.werkelijkCent;
  const deel = ietsBegroot && totaal > 0 ? besteed / totaal : null;
  const verschil = ietsBegroot ? totaal - besteed : null;

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

        {heeftOnderdelen ? (
          <span className="cijfers w-[104px] shrink-0 text-right text-[13px]">
            {ietsBegroot ? formatEuro(totaal) : "—"}
          </span>
        ) : (
          <Bedragveld
            post={post}
            bedragen={bedragen}
            pasBedragAan={pasBedragAan}
            bewaarNu={bewaarNu}
          />
        )}

        <Potloodknop post={post} open={open} />
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
      <div className="cijfers flex justify-between gap-2 text-[11.5px] text-gedempt">
        <span className="truncate">besteed {formatEuro(besteed)}</span>
        {verschil === null || totaal === 0 ? (
          <span className="shrink-0 text-messing-inkt">
            {besteed > 0 ? "niet begroot" : "—"}
          </span>
        ) : (
          <span
            className={`shrink-0 ${verschil < 0 ? "text-messing-inkt" : "text-goed"}`}
          >
            {verschil < 0
              ? `${formatEuro(-verschil)} te veel`
              : `over ${formatEuro(verschil)}`}
          </span>
        )}
      </div>

      {heeftOnderdelen && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-dashed border-rand-sterk pt-3">
          {/* De regels van de post zelf: dit is waar het bedrag vandaan komt. */}
          {eigenRegels.map((regel) => (
            <li
              key={regel.id}
              className="flex items-center gap-2.5 text-[13px]"
            >
              <span
                aria-hidden
                className="h-1 w-1 shrink-0 rounded-full bg-zacht"
              />
              <span className="min-w-0 flex-1 truncate text-tekst/70">
                {regel.naam || "nog geen naam"}
              </span>
              <span className="cijfers w-[104px] shrink-0 text-right text-[11.5px] text-gedempt">
                {formatEuro(regel.bedragCent)}
              </span>
              <span aria-hidden className="w-10 shrink-0" />
            </li>
          ))}

          {/* Heeft de post naast subposten ook een eigen bedrag, dan hoort dat hier
              als eigen regel te staan in plaats van verstopt in het totaal. */}
          {eigenRegels.length === 0 && post.subposten.length > 0 && (
            <li className="flex items-center gap-2.5 text-[13px]">
              <span
                aria-hidden
                className="h-1 w-1 shrink-0 rounded-full bg-zacht"
              />
              <span className="min-w-0 flex-1 truncate text-tekst/70">
                rechtstreeks op {post.naam}
              </span>
              <Bedragveld
                post={post}
                bedragen={bedragen}
                pasBedragAan={pasBedragAan}
                bewaarNu={bewaarNu}
                klein
              />
              <span aria-hidden className="w-10 shrink-0" />
            </li>
          )}

          {post.subposten.map((sub) => {
            const subRegels = sub.regels.filter((r) => r.naam !== null);
            return (
              <li key={sub.id}>
                <div className="flex items-center gap-2.5 text-[13px]">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: sub.kleur }}
                  />
                  <Link
                    href={`/uitgaven?jaar=${jaar}&post=${sub.id}`}
                    className="min-w-0 flex-1 truncate hover:text-link"
                  >
                    {sub.naam}
                  </Link>
                  {subRegels.length > 0 ? (
                    <span className="cijfers w-[104px] shrink-0 text-right text-[11.5px] text-gedempt">
                      {formatEuro(sub.begrootCent ?? 0)}
                    </span>
                  ) : (
                    <Bedragveld
                      post={sub}
                      bedragen={bedragen}
                      pasBedragAan={pasBedragAan}
                      bewaarNu={bewaarNu}
                      klein
                    />
                  )}
                  <Potloodknop post={sub} open={open} />
                </div>

                {/* Ook van een subpost wil je zien waar zijn bedrag vandaan komt. */}
                {subRegels.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1 pl-4.5">
                    {subRegels.map((regel) => (
                      <li
                        key={regel.id}
                        className="flex items-center gap-2.5 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-gedempt">
                          {regel.naam || "nog geen naam"}
                        </span>
                        <span className="cijfers w-[104px] shrink-0 text-right text-[11px] text-gedempt">
                          {formatEuro(regel.bedragCent)}
                        </span>
                        <span aria-hidden className="w-10 shrink-0" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Het bedrag dat zichzelf opslaat; alleen voor een post zonder opbouw. */
function Bedragveld({
  post,
  bedragen,
  pasBedragAan,
  bewaarNu,
  klein = false,
}: {
  post: Post;
  bedragen: Record<number, string>;
  pasBedragAan: (postId: number, tekst: string) => void;
  bewaarNu: (postId: number, tekst: string) => void;
  klein?: boolean;
}) {
  return (
    <input
      name={`post-${post.id}`}
      inputMode="decimal"
      placeholder="—"
      value={bedragen[post.id] ?? ""}
      onChange={(e) => pasBedragAan(post.id, e.target.value)}
      onBlur={(e) => bewaarNu(post.id, e.target.value)}
      aria-label={`Begroot voor ${post.naam}`}
      className={`cijfers w-[104px] shrink-0 rounded-lg border bg-verzonken text-right ${
        klein
          ? "border-rand px-2 py-1.5 text-xs"
          : "border-rand-sterk px-2.5 py-2 text-[13px]"
      }`}
    />
  );
}

/** Veertig pixels, want hieronder wordt het mikken met een duim. */
function Potloodknop({
  post,
  open,
}: {
  post: Post;
  open: (post: Post) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => open(post)}
      aria-label={`${post.naam} bewerken`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gedempt transition hover:bg-linnen-diep hover:text-inkt"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path
          d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
