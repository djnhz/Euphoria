import { asc, eq } from "drizzle-orm";
import { db, categories, couples, recurring } from "@/db";
import { vereisGebruiker } from "@/lib/auth";
import { formatEuro } from "@/lib/geld";
import { formatDatum, vandaag } from "@/lib/datum";
import VasteLastFormulier from "@/components/VasteLastFormulier";
import {
  verwijderVasteLastAction,
  wisselVasteLastAction,
} from "./actions";

export default async function VasteLastenPagina() {
  await vereisGebruiker();

  const [posten, categorieLijst, huishoudens] = await Promise.all([
    db
      .select({
        id: recurring.id,
        omschrijving: recurring.omschrijving,
        bedragCent: recurring.bedragCent,
        interval: recurring.interval,
        volgendeDatum: recurring.volgendeDatum,
        aandeelAPct: recurring.aandeelAPct,
        actief: recurring.actief,
        categorie: categories.naam,
        huishouden: couples.naam,
      })
      .from(recurring)
      .innerJoin(categories, eq(recurring.categoryId, categories.id))
      .innerJoin(couples, eq(recurring.coupleId, couples.id))
      .orderBy(asc(recurring.volgendeDatum)),
    db
      .select({ id: categories.id, naam: categories.naam })
      .from(categories)
      .where(eq(categories.actief, true))
      .orderBy(asc(categories.naam)),
    db.select().from(couples).orderBy(asc(couples.volgorde)),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vaste lasten</h1>
      <p className="text-sm text-gedempt">
        Deze posten worden vanzelf als uitgave aangemaakt zodra hun datum is
        bereikt en iemand het dashboard opent.
      </p>

      <VasteLastFormulier
        categorieen={categorieLijst}
        huishoudens={huishoudens}
        standaardDatum={vandaag()}
      />

      {posten.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-6 text-center text-sm text-gedempt">
          Nog geen vaste lasten.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posten.map((post) => (
            <li
              key={post.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border border-rand bg-paneel p-4 ${
                post.actief ? "" : "opacity-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{post.omschrijving}</p>
                <p className="truncate text-sm text-gedempt">
                  per {post.interval} · {post.categorie} · betaald door{" "}
                  {post.huishouden} · {post.aandeelAPct}/
                  {100 - post.aandeelAPct} · volgende{" "}
                  {formatDatum(post.volgendeDatum)}
                </p>
              </div>
              <span className="cijfers font-medium">
                {formatEuro(post.bedragCent)}
              </span>
              <form action={wisselVasteLastAction}>
                <input type="hidden" name="id" value={post.id} />
                <button className="text-sm text-gedempt underline">
                  {post.actief ? "pauzeer" : "activeer"}
                </button>
              </form>
              <form action={verwijderVasteLastAction}>
                <input type="hidden" name="id" value={post.id} />
                <button className="text-sm text-slecht underline">
                  verwijder
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
