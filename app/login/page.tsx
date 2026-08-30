import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, couples, users } from "@/db";
import { huidigeGebruiker } from "@/lib/auth";
import LoginForm from "./LoginForm";
import Logo from "@/components/Logo";

/** Leest de sessiecookie en de gebruikerslijst; nooit vooraf te renderen. */
export const dynamic = "force-dynamic";

export default async function LoginPagina() {
  if (await huidigeGebruiker()) redirect("/");

  const gebruikers = await db
    .select({ id: users.id, naam: users.naam, coupleNaam: couples.naam })
    .from(users)
    .innerJoin(couples, eq(users.coupleId, couples.id))
    .orderBy(asc(couples.volgorde), asc(users.id));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <header className="flex flex-col items-center gap-2">
        <Logo hoogte={44} />
        <p className="text-sm text-gedempt">Bootfinanciën en vaarplanning</p>
      </header>
      {gebruikers.length === 0 ? (
        <p className="rounded-xl border border-rand bg-paneel p-4 text-sm text-gedempt">
          Nog geen gebruikers. Draai eerst <code>npm run seed</code>.
        </p>
      ) : (
        <LoginForm gebruikers={gebruikers} />
      )}
    </main>
  );
}
