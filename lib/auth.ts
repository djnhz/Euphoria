import "server-only";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, couples } from "@/db";
import { pinKlopt } from "./pin";

/**
 * Een pincode van vier cijfers is 10.000 mogelijkheden. Zonder rem is dat in seconden
 * te raden, dus de teller met blokkade hieronder is geen extraatje maar de eigenlijke
 * bescherming. De hash beschermt alleen tegen meelezen in de database.
 */
export const MAX_POGINGEN = 5;
export const BLOKKADE_MINUTEN = 15;

export type Sessie = { userId?: number };

const sessieOpties = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "euphoria_sessie",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 90, // 90 dagen, zodat de pin zelden nodig is
  },
};

export async function getSessie(): Promise<IronSession<Sessie>> {
  if (sessieOpties.password.length < 32) {
    throw new Error("SESSION_SECRET ontbreekt of is korter dan 32 tekens");
  }
  return getIronSession<Sessie>(await cookies(), sessieOpties);
}

export type Gebruiker = {
  id: number;
  naam: string;
  coupleId: number;
  coupleNaam: string;
  isHuishoudenA: boolean;
};

/** De ingelogde gebruiker, of null. */
export async function huidigeGebruiker(): Promise<Gebruiker | null> {
  const sessie = await getSessie();
  if (!sessie.userId) return null;
  const [rij] = await db
    .select({
      id: users.id,
      naam: users.naam,
      coupleId: users.coupleId,
      coupleNaam: couples.naam,
      volgorde: couples.volgorde,
    })
    .from(users)
    .innerJoin(couples, eq(users.coupleId, couples.id))
    .where(eq(users.id, sessie.userId));
  if (!rij) return null;
  return { ...rij, isHuishoudenA: rij.volgorde === 1 };
}

/**
 * Voor pagina's en server actions. Layouts beschermen alleen pagina's, en een pagina
 * rendert naast zijn layout in plaats van erna, dus elke pagina en elke server action
 * roept dit zelf aan. Omleiden in plaats van gooien: anders loopt een uitgelogde
 * bezoeker tegen een foutscherm aan terwijl de layout hem al naar /login stuurt.
 */
export async function vereisGebruiker(): Promise<Gebruiker> {
  const gebruiker = await huidigeGebruiker();
  if (!gebruiker) redirect("/login");
  return gebruiker;
}

export type LoginResultaat = { ok: true } | { ok: false; fout: string };

export async function probeerInloggen(
  userId: number,
  pin: string,
): Promise<LoginResultaat> {
  const [gebruiker] = await db.select().from(users).where(eq(users.id, userId));
  if (!gebruiker) return { ok: false, fout: "Onbekende gebruiker." };

  if (gebruiker.lockedUntil && gebruiker.lockedUntil > new Date()) {
    const minuten = Math.ceil(
      (gebruiker.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    return {
      ok: false,
      fout: `Geblokkeerd. Probeer het over ${minuten} ${minuten === 1 ? "minuut" : "minuten"} opnieuw.`,
    };
  }

  if (!(await pinKlopt(pin, gebruiker.pinHash, gebruiker.pinSalt))) {
    const pogingen = gebruiker.failedAttempts + 1;
    const blokkeren = pogingen >= MAX_POGINGEN;
    await db
      .update(users)
      .set({
        failedAttempts: blokkeren ? 0 : pogingen,
        lockedUntil: blokkeren
          ? new Date(Date.now() + BLOKKADE_MINUTEN * 60_000)
          : null,
      })
      .where(eq(users.id, userId));
    return {
      ok: false,
      fout: blokkeren
        ? `Te veel pogingen. ${BLOKKADE_MINUTEN} minuten geblokkeerd.`
        : `Onjuiste pincode. Nog ${MAX_POGINGEN - pogingen} poging${MAX_POGINGEN - pogingen === 1 ? "" : "en"}.`,
    };
  }

  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));

  const sessie = await getSessie();
  sessie.userId = gebruiker.id;
  await sessie.save();
  return { ok: true };
}

export async function uitloggen() {
  const sessie = await getSessie();
  sessie.destroy();
}
