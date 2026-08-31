"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { formatEuro, parseEuro } from "@/lib/geld";
import {
  bewaarBegrotingAction,
  neemVorigJaarOverAction,
  nieuwePostAction,
  volgKoppelingAction,
  wijzigPostAction,
  type BegrotingState,
} from "@/app/(app)/begroting/actions";

export type Post = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  begrootCent: number | null;
  werkelijkCent: number;
  /** Waar het uitgegeven bedrag vandaan komt, grootste eerst. */
  categorieen: {
    categoryId: number;
    naam: string;
    kleur: string;
    cent: number;
  }[];
};

const invoer = "rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm";

function alsTekst(cent: number | null): string {
  return cent === null ? "" : (cent / 100).toFixed(2).replace(".", ",");
}

export default function BegrotingFormulier({
  jaar,
  posten,
  losseUitgaven,
}: {
  jaar: number;
  posten: Post[];
  /** Wat in dit jaar nog aan geen post hangt. */
  losseUitgaven: { aantal: number; cent: number };
}) {
  const [state, bewaar, bezig] = useActionState<BegrotingState, FormData>(
    bewaarBegrotingAction,
    null,
  );
  const [overnemenState, overnemen, overnemenBezig] = useActionState<
    BegrotingState,
    FormData
  >(neemVorigJaarOverAction, null);
  const [koppelingState, volgKoppeling, koppelingBezig] = useActionState<
    BegrotingState,
    FormData
  >(volgKoppelingAction, null);
  const [beheer, setBeheer] = useState(false);
  const [uitgeklapt, setUitgeklapt] = useState<number | null>(null);

  const [bedragen, setBedragen] = useState<Record<number, string>>(() =>
    Object.fromEntries(posten.map((p) => [p.id, alsTekst(p.begrootCent)])),
  );

  // Tijdens het typen verandert er niets aan de server, dus dit kenmerk blijft gelijk.
  // Wisselt het jaar, of komt er een nieuwe stand terug na opslaan of overnemen, dan
  // wel — en dan horen de velden die stand te tonen in plaats van de oude invoer.
  const kenmerk = [
    jaar,
    ...posten.map((p) => `${p.id}=${p.begrootCent ?? ""}`),
  ].join("|");
  const [vorigKenmerk, setVorigKenmerk] = useState(kenmerk);
  if (vorigKenmerk !== kenmerk) {
    setVorigKenmerk(kenmerk);
    setBedragen(
      Object.fromEntries(posten.map((p) => [p.id, alsTekst(p.begrootCent)])),
    );
  }

  const totalen = useMemo(() => {
    let begroot = 0;
    for (const post of posten) begroot += parseEuro(bedragen[post.id] ?? "") ?? 0;
    const werkelijk = posten.reduce((som, p) => som + p.werkelijkCent, 0);
    return { begroot, werkelijk };
  }, [bedragen, posten]);

  if (posten.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl border border-rand bg-paneel p-6 text-sm text-gedempt">
          Nog geen begrotingsposten. Een post is een eigen noemer voor de begroting,
          los van de categorieën waarin je de bonregels indeelt.
        </p>
        <div className="rounded-xl border border-rand bg-paneel p-4">
          <NieuwePost />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={bewaar} className="rounded-xl border border-rand bg-paneel p-4">
        <input type="hidden" name="jaar" value={jaar} />

        <ul className="flex flex-col">
          <li className="flex items-center gap-3 border-b border-rand pb-2 text-xs text-gedempt">
            <span aria-hidden className="w-4 shrink-0" />
            <span className="flex-1">Post</span>
            <span className="w-28 text-right">Begroot</span>
            <span className="hidden w-28 text-right sm:block">Uitgegeven</span>
            <span className="hidden w-28 text-right sm:block">Verschil</span>
          </li>

          {posten.map((post) => {
            const begrootCent = parseEuro(bedragen[post.id] ?? "");
            const verschil =
              begrootCent === null ? null : begrootCent - post.werkelijkCent;
            const open = uitgeklapt === post.id;
            return (
              <li key={post.id} className="border-b border-rand py-2 last:border-0">
                <div className="flex items-center gap-3">
                  {/* Uitklappen laat zien uit welke categorieën het bedrag bestaat.
                      Zonder uitgaven valt er niets te verdiepen. */}
                  <button
                    type="button"
                    onClick={() => setUitgeklapt(open ? null : post.id)}
                    disabled={post.categorieen.length === 0}
                    aria-expanded={open}
                    aria-label={`Categorieën van ${post.naam}`}
                    className="w-4 shrink-0 text-xs text-gedempt disabled:opacity-0"
                  >
                    {open ? "▾" : "▸"}
                  </button>
                  <Link
                    href={`/uitgaven?jaar=${jaar}&post=${post.id}`}
                    title={`Uitgaven op ${post.naam} in ${jaar}`}
                    className="flex flex-1 items-center gap-2 truncate text-sm hover:text-accent"
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
                    onChange={(e) =>
                      setBedragen((huidig) => ({
                        ...huidig,
                        [post.id]: e.target.value,
                      }))
                    }
                    aria-label={`Begroot voor ${post.naam}`}
                    className={`${invoer} cijfers w-28 text-right`}
                  />
                  <span className="cijfers hidden w-28 text-right text-sm text-gedempt sm:block">
                    {formatEuro(post.werkelijkCent)}
                  </span>
                  <span
                    className={`cijfers hidden w-28 text-right text-sm sm:block ${
                      verschil !== null && verschil < 0
                        ? "text-slecht"
                        : "text-gedempt"
                    }`}
                  >
                    {verschil === null ? "—" : formatEuro(verschil)}
                  </span>
                </div>

                {open && (
                  <ul className="mt-1 mb-1 ml-7 flex flex-col gap-1">
                    {post.categorieen.map((categorie) => (
                      <li
                        key={categorie.categoryId}
                        className="flex items-center gap-3 text-xs text-gedempt"
                      >
                        <Link
                          href={`/uitgaven?jaar=${jaar}&post=${post.id}&categorie=${categorie.categoryId}`}
                          className="flex flex-1 items-center gap-2 truncate hover:text-accent"
                        >
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded"
                            style={{ background: categorie.kleur }}
                          />
                          <span className="truncate">{categorie.naam}</span>
                        </Link>
                        <span className="cijfers w-28 text-right">
                          {formatEuro(categorie.cent)}
                        </span>
                        <span className="hidden w-28 sm:block" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex items-center gap-3 border-t border-rand pt-3 text-sm font-medium">
          <span aria-hidden className="w-4 shrink-0" />
          <span className="flex-1">Totaal</span>
          <span className="cijfers w-28 text-right">
            {formatEuro(totalen.begroot)}
          </span>
          <span className="cijfers hidden w-28 text-right sm:block">
            {formatEuro(totalen.werkelijk)}
          </span>
          <span className="cijfers hidden w-28 text-right sm:block">
            {formatEuro(totalen.begroot - totalen.werkelijk)}
          </span>
        </div>

        {/* Wat nergens aan hangt telt hierboven niet mee; dat hoort niet stilletjes
            te verdwijnen, dus staat het eronder met een weg ernaartoe. */}
        {losseUitgaven.aantal > 0 && (
          <p className="mt-3 text-sm text-gedempt">
            <Link
              href={`/uitgaven?jaar=${jaar}&post=geen`}
              className="text-accent underline"
            >
              {formatEuro(losseUitgaven.cent)}
            </Link>{" "}
            hangt nog aan geen post en telt hierboven niet mee.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled={bezig}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig ? "Bezig…" : "Begroting opslaan"}
          </button>
          <Uitkomst state={state} />
        </div>
      </form>

      <div className="rounded-xl border border-rand bg-paneel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <NieuwePost />
          <form action={overnemen} className="flex items-center gap-3">
            <input type="hidden" name="jaar" value={jaar} />
            <button
              disabled={overnemenBezig}
              className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
            >
              Overnemen uit {jaar - 1}
            </button>
          </form>
          {/* Los formulier: het staat naast de andere knoppen maar hoort er niet bij. */}
          <form action={volgKoppeling}>
            <button
              disabled={koppelingBezig}
              title="Regels zonder post krijgen de post van hun categorie"
              className="rounded-lg border border-rand px-3 py-2 text-sm disabled:opacity-50"
            >
              Koppeling toepassen
            </button>
          </form>
          <button
            type="button"
            onClick={() => setBeheer((huidig) => !huidig)}
            className="text-sm text-accent underline"
          >
            {beheer ? "posten verbergen" : "posten hernoemen"}
          </button>
          <Uitkomst state={overnemenState} />
          <Uitkomst state={koppelingState} />
        </div>

        {beheer && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-rand pt-4">
            {posten.map((post) => (
              <li key={post.id}>
                <form
                  action={wijzigPostAction}
                  className="flex flex-wrap items-center gap-2"
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
                  <label className="flex items-center gap-1 text-sm text-gedempt">
                    <input
                      type="checkbox"
                      name="actief"
                      defaultChecked={post.actief}
                    />
                    actief
                  </label>
                  <button className="rounded-lg border border-rand px-3 py-2 text-sm">
                    Opslaan
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NieuwePost() {
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
