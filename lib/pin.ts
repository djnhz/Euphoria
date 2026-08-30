import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Los van `lib/auth.ts` omdat het seed-script dit nodig heeft en buiten Next draait;
 * `auth.ts` trekt `server-only` en `next/headers` mee.
 */
const scryptAsync = promisify(scrypt) as (
  wachtwoord: string,
  salt: string,
  lengte: number,
) => Promise<Buffer>;

export async function hashPin(pin: string) {
  const pinSalt = randomBytes(16).toString("hex");
  const pinHash = (await scryptAsync(pin, pinSalt, 64)).toString("hex");
  return { pinHash, pinSalt };
}

export async function pinKlopt(pin: string, hash: string, salt: string) {
  const kandidaat = await scryptAsync(pin, salt, 64);
  const opgeslagen = Buffer.from(hash, "hex");
  if (opgeslagen.length !== kandidaat.length) return false;
  return timingSafeEqual(opgeslagen, kandidaat);
}

/** Vier cijfers, niets anders. */
export function isGeldigePin(pin: string) {
  return /^\d{4}$/.test(pin);
}
