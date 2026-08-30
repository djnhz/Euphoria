import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";
import type { Opslag } from "@/db/schema";

/**
 * Uploads moeten altijd bewaard worden, ook als er nog geen Vercel Blob is aangesloten.
 * Zonder token valt de app buiten productie terug op een map naast het project, net
 * zoals de database terugvalt op PGlite. Op Vercel is er geen schijf die een deploy
 * overleeft, dus daar is de token wel verplicht.
 */
export const UPLOAD_MAP = path.join(process.cwd(), ".uploads");

export function heeftBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Alleen deze tekens in een bestandsnaam op schijf; de rest wordt een streepje. */
function veiligeNaam(naam: string): string {
  return naam.replace(/[^A-Za-z0-9._-]/g, "-").slice(-80);
}

export type BewaardBestand = { opslag: Opslag; url: string };

export async function bewaarBestand(
  naam: string,
  mime: string,
  inhoud: Buffer,
): Promise<BewaardBestand> {
  if (heeftBlob()) {
    const blob = await put(naam, inhoud, {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
    });
    return { opslag: "blob", url: blob.url };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ontbreekt. Koppel Vercel Blob onder Storage.",
    );
  }

  await mkdir(UPLOAD_MAP, { recursive: true });
  const bestandsnaam = `${randomUUID()}-${veiligeNaam(naam)}`;
  await writeFile(path.join(UPLOAD_MAP, bestandsnaam), inhoud);
  return { opslag: "lokaal", url: `/api/bestand/${bestandsnaam}` };
}

/** Haalt een eerder bewaard bestand terug, ongeacht waar het staat. */
export async function leesBestand(url: string): Promise<Buffer | null> {
  if (url.startsWith("/api/bestand/")) {
    const bestandsnaam = url.slice("/api/bestand/".length);
    return leesLokaal(bestandsnaam);
  }
  const antwoord = await fetch(url);
  if (!antwoord.ok) return null;
  return Buffer.from(await antwoord.arrayBuffer());
}

/**
 * Losstaand zodat de route die bestanden uitserveert dezelfde controle gebruikt:
 * alleen namen zonder padtekens, en het opgeloste pad moet in de uploadmap liggen.
 */
export async function leesLokaal(bestandsnaam: string): Promise<Buffer | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(bestandsnaam)) return null;
  const volledig = path.resolve(UPLOAD_MAP, bestandsnaam);
  if (!volledig.startsWith(path.resolve(UPLOAD_MAP) + path.sep)) return null;
  try {
    return await readFile(volledig);
  } catch {
    return null;
  }
}

export async function verwijderBestand(url: string): Promise<void> {
  if (url.startsWith("/api/bestand/")) {
    const bestandsnaam = url.slice("/api/bestand/".length);
    if (!/^[A-Za-z0-9._-]+$/.test(bestandsnaam)) return;
    const volledig = path.resolve(UPLOAD_MAP, bestandsnaam);
    if (!volledig.startsWith(path.resolve(UPLOAD_MAP) + path.sep)) return;
    await unlink(volledig).catch(() => {});
    return;
  }
  await del(url).catch(() => {});
}
