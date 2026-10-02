import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, documents, mappen, settings } from "@/db";

const SLEUTEL_ROOT = "bonnen_root_id";
const SLEUTEL_HUIDIG = "bonnen_huidig_id";
const BONNEN_NAAM = "Bonnen en facturen";

export type MapRij = { id: number; naam: string; ouderId: number | null };

/** Maximale lengte van een mapnaam; zelfde grens als een postnaam elders in de app. */
const MAX_NAAM = 60;

async function leesSetting(sleutel: string): Promise<number | null> {
  const [rij] = await db
    .select({ waarde: settings.waarde })
    .from(settings)
    .where(eq(settings.sleutel, sleutel));
  const getal = rij ? Number(rij.waarde) : NaN;
  return Number.isInteger(getal) ? getal : null;
}

async function schrijfSetting(sleutel: string, id: number) {
  await db
    .insert(settings)
    .values({ sleutel, waarde: String(id) })
    .onConflictDoUpdate({
      target: settings.sleutel,
      set: { waarde: String(id), gewijzigdOp: new Date() },
    });
}

/** Alle mappen, plat -- de schermen bouwen daar zelf een boom of kruimelpad uit. */
export async function alleMappen(): Promise<MapRij[]> {
  return db
    .select({ id: mappen.id, naam: mappen.naam, ouderId: mappen.ouderId })
    .from(mappen);
}

/** De map zelf, of null als hij niet (meer) bestaat. */
export async function haalMap(id: number): Promise<MapRij | null> {
  const [rij] = await db
    .select({ id: mappen.id, naam: mappen.naam, ouderId: mappen.ouderId })
    .from(mappen)
    .where(eq(mappen.id, id));
  return rij ?? null;
}

/** Van boven naar beneden: [wortel, ..., deze map]. Leeg aan de top van de boom. */
export function kruimelpad(id: number, alle: readonly MapRij[]): MapRij[] {
  const perId = new Map(alle.map((m) => [m.id, m]));
  const pad: MapRij[] = [];
  let huidig: number | null = id;
  while (huidig !== null) {
    const map = perId.get(huidig);
    if (!map) break;
    pad.unshift(map);
    huidig = map.ouderId;
  }
  return pad;
}

/**
 * Een nieuwe map, als submap van `ouderId` of als hoofdmap wanneer die leeg is.
 * Twee mappen met dezelfde naam op hetzelfde niveau is verwarrend -- zeker omdat
 * Bonnen en facturen zo zijn vaarseizoenen krijgt -- dus dat controleren we hier
 * zelf, met een duidelijke melding, in plaats van de database-foutmelding door te
 * geven.
 */
export async function maakMap(
  naam: string,
  ouderId: number | null,
): Promise<{ id: number } | { fout: string }> {
  const schoon = naam.trim();
  if (schoon === "") return { fout: "Geef de map een naam." };
  if (schoon.length > MAX_NAAM) {
    return { fout: `Een mapnaam mag niet langer zijn dan ${MAX_NAAM} tekens.` };
  }

  const zusjes = await db
    .select({ naam: mappen.naam })
    .from(mappen)
    .where(
      ouderId === null ? isNull(mappen.ouderId) : eq(mappen.ouderId, ouderId),
    );
  if (zusjes.some((m) => m.naam.toLowerCase() === schoon.toLowerCase())) {
    return { fout: `Er bestaat hier al een map "${schoon}".` };
  }

  const [rij] = await db
    .insert(mappen)
    .values({ naam: schoon, ouderId })
    .returning({ id: mappen.id });
  return rij;
}

export async function hernoemMap(
  id: number,
  naam: string,
): Promise<{ ok: true } | { fout: string }> {
  const schoon = naam.trim();
  if (schoon === "") return { fout: "Geef de map een naam." };
  if (schoon.length > MAX_NAAM) {
    return { fout: `Een mapnaam mag niet langer zijn dan ${MAX_NAAM} tekens.` };
  }

  const map = await haalMap(id);
  if (!map) return { fout: "Deze map bestaat niet meer." };

  const zusjes = await db
    .select({ id: mappen.id, naam: mappen.naam })
    .from(mappen)
    .where(
      map.ouderId === null
        ? isNull(mappen.ouderId)
        : eq(mappen.ouderId, map.ouderId),
    );
  if (
    zusjes.some(
      (m) => m.id !== id && m.naam.toLowerCase() === schoon.toLowerCase(),
    )
  ) {
    return { fout: `Er bestaat hier al een map "${schoon}".` };
  }

  await db.update(mappen).set({ naam: schoon }).where(eq(mappen.id, id));
  return { ok: true };
}

/**
 * Weigert een map met inhoud, en de map waarin de bonnen van dit seizoen staan --
 * die moet ergens blijven staan zolang hij "huidig" is. Leeghalen of eerst een
 * nieuw seizoen starten lost dat vanzelf op.
 */
export async function verwijderMap(
  id: number,
): Promise<{ ok: true } | { fout: string }> {
  const [root, huidig] = await Promise.all([
    leesSetting(SLEUTEL_ROOT),
    leesSetting(SLEUTEL_HUIDIG),
  ]);
  if (id === root) {
    return { fout: "Dit is de map Bonnen en facturen; die kan niet weg." };
  }
  if (id === huidig) {
    return {
      fout: "Dit is de map van het lopende vaarseizoen; start eerst een nieuw seizoen.",
    };
  }

  const [submap] = await db
    .select({ id: mappen.id })
    .from(mappen)
    .where(eq(mappen.ouderId, id));
  if (submap) return { fout: "Deze map heeft nog submappen." };

  const [document] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.mapId, id));
  if (document) return { fout: "Deze map heeft nog documenten." };

  await db.delete(mappen).where(eq(mappen.id, id));
  return { ok: true };
}

/**
 * De hoofdmap "Bonnen en facturen". Bestaat hij nog niet -- een verse database, of
 * de allereerste bon ooit -- dan wordt hij hier aangemaakt. Dat kan maar één keer
 * goed gaan bij gelijktijdig gebruik; voor een huishouden van een paar mensen is dat
 * geen probleem.
 */
export async function bonnenRootId(): Promise<number> {
  const bestaand = await leesSetting(SLEUTEL_ROOT);
  if (bestaand !== null && (await haalMap(bestaand))) return bestaand;

  const [gevonden] = await db
    .select({ id: mappen.id })
    .from(mappen)
    .where(and(isNull(mappen.ouderId), eq(mappen.naam, BONNEN_NAAM)));
  const id =
    gevonden?.id ??
    (
      await db
        .insert(mappen)
        .values({ naam: BONNEN_NAAM, ouderId: null })
        .returning({ id: mappen.id })
    )[0].id;

  await schrijfSetting(SLEUTEL_ROOT, id);
  return id;
}

/** De map waarin een nieuw ingediende bon of factuur nu hoort te komen. */
export async function huidigeBonnenMapId(): Promise<number> {
  const bestaand = await leesSetting(SLEUTEL_HUIDIG);
  if (bestaand !== null && (await haalMap(bestaand))) return bestaand;

  const root = await bonnenRootId();
  const jaar = new Date().getFullYear();
  const aangemaakt = await maakMap(`Seizoen ${jaar}`, root);
  // Zou "Seizoen <jaar>" per ongeluk al bestaan (bijvoorbeeld na een eerdere,
  // onvolledige poging), gebruik die dan in plaats van vast te lopen op de naam.
  const id =
    "id" in aangemaakt
      ? aangemaakt.id
      : (
          await db
            .select({ id: mappen.id })
            .from(mappen)
            .where(
              and(eq(mappen.ouderId, root), eq(mappen.naam, `Seizoen ${jaar}`)),
            )
        )[0].id;

  await schrijfSetting(SLEUTEL_HUIDIG, id);
  return id;
}

/** Voor het instellingenscherm: de naam van het huidige seizoen, of null als er nog
 * nooit een bon is ingediend. */
export async function huidigSeizoenNaam(): Promise<string | null> {
  const id = await leesSetting(SLEUTEL_HUIDIG);
  if (id === null) return null;
  const map = await haalMap(id);
  return map?.naam ?? null;
}

/**
 * Admin-actie: alles wat vanaf nu wordt ingediend gaat in een nieuwe map onder
 * Bonnen en facturen. Oudere bonnen blijven gewoon in hun eigen seizoensmap staan.
 */
export async function nieuwSeizoenStarten(
  naam: string,
): Promise<{ naam: string } | { fout: string }> {
  const root = await bonnenRootId();
  const aangemaakt = await maakMap(naam, root);
  if ("fout" in aangemaakt) return aangemaakt;
  await schrijfSetting(SLEUTEL_HUIDIG, aangemaakt.id);
  return { naam: naam.trim() };
}
