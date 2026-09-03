import "server-only";
import { JWT } from "google-auth-library";
import { googleAgendaId, googleServiceAccount } from "./instellingen";
import { aaneengeslotenBlokken, dagenTotEnMet } from "./datum";

/**
 * Reserveringen staan in Google Agenda en nergens anders. Geen eigen tabel ernaast,
 * dus ook niets dat uit de pas kan lopen als iemand rechtstreeks in zijn agenda iets
 * verzet. Wie geboekt heeft bewaren we in de afspraak zelf.
 */

const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export type Reservering = {
  id: string;
  /** Eerste dag, ISO `JJJJ-MM-DD`. */
  van: string;
  /** Laatste dag waarop gevaren wordt, dus inclusief. */
  tot: string;
  titel: string;
  opmerking: string;
  /** Wie de reservering maakte, voor zover de app dat heeft vastgelegd. */
  userId: number | null;
  coupleId: number | null;
};

export type AgendaFout = { fout: string };

async function verbinding(): Promise<
  { ok: true; token: string; agendaId: string } | { ok: false; fout: string }
> {
  const [account, agendaId] = await Promise.all([
    googleServiceAccount(),
    googleAgendaId(),
  ]);
  if (!account) {
    return { ok: false, fout: "Er is nog geen serviceaccount ingesteld." };
  }
  if (!agendaId) {
    return { ok: false, fout: "Er is nog geen agenda-ID ingesteld." };
  }

  try {
    const jwt = new JWT({
      email: account.client_email,
      key: account.private_key,
      scopes: [SCOPE],
    });
    const { access_token: token } = await jwt.authorize();
    if (!token) return { ok: false, fout: "Google gaf geen toegangstoken." };
    return { ok: true, token, agendaId };
  } catch (fout) {
    return { ok: false, fout: `Aanmelden bij Google mislukte: ${(fout as Error).message}` };
  }
}

async function roepAan(
  token: string,
  pad: string,
  opties: RequestInit = {},
): Promise<{ ok: true; data: unknown } | { ok: false; fout: string }> {
  const antwoord = await fetch(`${API}${pad}`, {
    ...opties,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opties.headers,
    },
    cache: "no-store",
  });

  if (antwoord.status === 204) return { ok: true, data: null };

  const data: unknown = await antwoord.json().catch(() => null);
  if (!antwoord.ok) {
    const bericht =
      (data as { error?: { message?: string } } | null)?.error?.message ??
      `Google gaf status ${antwoord.status}`;
    return {
      ok: false,
      fout:
        antwoord.status === 404
          ? "Die agenda is niet gevonden. Klopt het agenda-ID, en is de agenda gedeeld met het serviceaccount?"
          : bericht,
    };
  }
  return { ok: true, data };
}

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string };
  end?: { date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/** Google zet bij een dagafspraak de einddatum op de dag ná de laatste dag. */
function vorigeDag(iso: string): string {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  const datum = new Date(Date.UTC(jaar, maand - 1, dag - 1));
  return datum.toISOString().slice(0, 10);
}

function volgendeDag(iso: string): string {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  const datum = new Date(Date.UTC(jaar, maand - 1, dag + 1));
  return datum.toISOString().slice(0, 10);
}

export async function haalReserveringen(
  vanaf: string,
  totEnMet: string,
): Promise<Reservering[] | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const query = new URLSearchParams({
    timeMin: `${vanaf}T00:00:00Z`,
    timeMax: `${volgendeDag(totEnMet)}T00:00:00Z`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const resultaat = await roepAan(
    verbonden.token,
    `/calendars/${encodeURIComponent(verbonden.agendaId)}/events?${query}`,
  );
  if (!resultaat.ok) return { fout: resultaat.fout };

  const items = (resultaat.data as { items?: GoogleEvent[] }).items ?? [];
  return items
    .filter((item) => item.start?.date && item.end?.date)
    .map((item) => {
      const eigen = item.extendedProperties?.private ?? {};
      return {
        id: item.id,
        van: item.start!.date!,
        tot: vorigeDag(item.end!.date!),
        titel: item.summary ?? "Gereserveerd",
        opmerking: item.description ?? "",
        userId: eigen.userId ? Number(eigen.userId) : null,
        coupleId: eigen.coupleId ? Number(eigen.coupleId) : null,
      };
    });
}

export async function maakReservering(invoer: {
  van: string;
  totEnMet: string;
  titel: string;
  opmerking: string;
  userId: number;
  coupleId: number;
}): Promise<{ ok: true; id: string } | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const resultaat = await roepAan(
    verbonden.token,
    `/calendars/${encodeURIComponent(verbonden.agendaId)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: invoer.titel,
        description: invoer.opmerking,
        start: { date: invoer.van },
        // Google verwacht hier de dag ná de laatste vaardag.
        end: { date: volgendeDag(invoer.totEnMet) },
        extendedProperties: {
          private: {
            userId: String(invoer.userId),
            coupleId: String(invoer.coupleId),
            bron: "euphoria",
          },
        },
      }),
    },
  );
  if (!resultaat.ok) return { fout: resultaat.fout };
  return { ok: true, id: (resultaat.data as { id: string }).id };
}

export async function verwijderReservering(
  id: string,
): Promise<{ ok: true } | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const resultaat = await roepAan(
    verbonden.token,
    `/calendars/${encodeURIComponent(verbonden.agendaId)}/events/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return resultaat.ok ? { ok: true } : { fout: resultaat.fout };
}

/** Losse controle voor het instellingenscherm: lukt aanmelden en is de agenda leesbaar? */
export async function testAgenda(): Promise<
  { ok: true; melding: string } | AgendaFout
> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const resultaat = await roepAan(
    verbonden.token,
    `/calendars/${encodeURIComponent(verbonden.agendaId)}/events?maxResults=1`,
  );
  if (!resultaat.ok) return { fout: resultaat.fout };
  return { ok: true, melding: "Verbinding werkt en de agenda is leesbaar." };
}

/** Merkteken waaraan de app haar eigen seizoensafspraken herkent. */
const SEIZOEN_BRON = "euphoria-seizoen";

export type SeizoensBlok = {
  van: string;
  /** Laatste dag, inclusief. */
  tot: string;
  titel: string;
  opmerking: string;
  coupleId: number;
};

export type SeizoenStand = {
  /** Afspraken van een eerdere seizoensplanning voor dit jaar. */
  vanSeizoen: number;
  /** Alles wat er verder al staat en dus met rust gelaten wordt. */
  handmatig: number;
};

/** Wat er nu in de agenda staat over dit seizoen, voordat je iets overschrijft. */
export async function seizoenStand(
  jaar: number,
  vanaf: string,
  totEnMet: string,
): Promise<SeizoenStand | AgendaFout> {
  const gevonden = await haalSeizoensAfspraken(jaar, vanaf, totEnMet);
  if ("fout" in gevonden) return gevonden;
  return { vanSeizoen: gevonden.vanSeizoen.length, handmatig: gevonden.overig };
}

async function haalSeizoensAfspraken(
  jaar: number,
  vanaf: string,
  totEnMet: string,
): Promise<{ vanSeizoen: string[]; overig: number } | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const query = new URLSearchParams({
    timeMin: `${vanaf}T00:00:00Z`,
    timeMax: `${volgendeDag(totEnMet)}T00:00:00Z`,
    singleEvents: "true",
    maxResults: "2500",
  });
  const resultaat = await roepAan(
    verbonden.token,
    `/calendars/${encodeURIComponent(verbonden.agendaId)}/events?${query}`,
  );
  if (!resultaat.ok) return { fout: resultaat.fout };

  const items = (resultaat.data as { items?: GoogleEvent[] }).items ?? [];
  const vanSeizoen: string[] = [];
  let overig = 0;
  for (const item of items) {
    const eigen = item.extendedProperties?.private ?? {};
    if (eigen.bron === SEIZOEN_BRON && eigen.seizoen === String(jaar)) {
      vanSeizoen.push(item.id);
    } else {
      overig++;
    }
  }
  return { vanSeizoen, overig };
}

/**
 * Vervangt de seizoensplanning van een jaar. Verwijdert uitsluitend afspraken met het
 * merkteken van datzelfde jaar; handmatige reserveringen en alles wat iemand zelf in
 * Google Agenda zette blijven staan. Dat is de belangrijkste regel hier.
 */
export async function publiceerSeizoen(
  jaar: number,
  blokken: SeizoensBlok[],
  vanaf: string,
  totEnMet: string,
): Promise<{ ok: true; verwijderd: number; aangemaakt: number } | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const bestaand = await haalSeizoensAfspraken(jaar, vanaf, totEnMet);
  if ("fout" in bestaand) return bestaand;

  for (const id of bestaand.vanSeizoen) {
    const weg = await roepAan(
      verbonden.token,
      `/calendars/${encodeURIComponent(verbonden.agendaId)}/events/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!weg.ok) return { fout: weg.fout };
  }

  for (const blok of blokken) {
    const gemaakt = await roepAan(
      verbonden.token,
      `/calendars/${encodeURIComponent(verbonden.agendaId)}/events`,
      {
        method: "POST",
        body: JSON.stringify({
          summary: blok.titel,
          description: blok.opmerking,
          start: { date: blok.van },
          end: { date: volgendeDag(blok.tot) },
          extendedProperties: {
            private: {
              coupleId: String(blok.coupleId),
              bron: SEIZOEN_BRON,
              seizoen: String(jaar),
            },
          },
        }),
      },
    );
    if (!gemaakt.ok) return { fout: gemaakt.fout };
  }

  return {
    ok: true,
    verwijderd: bestaand.vanSeizoen.length,
    aangemaakt: blokken.length,
  };
}

/** Eén reservering ophalen, met alles wat nodig is om hem opnieuw weg te schrijven. */
async function haalRuweAfspraak(
  token: string,
  agendaId: string,
  id: string,
): Promise<{ ok: true; item: GoogleEvent } | AgendaFout> {
  const resultaat = await roepAan(
    token,
    `/calendars/${encodeURIComponent(agendaId)}/events/${encodeURIComponent(id)}`,
  );
  if (!resultaat.ok) return { fout: resultaat.fout };
  const item = resultaat.data as GoogleEvent;
  if (!item?.start?.date || !item.end?.date) {
    return { fout: "Dit is geen reservering van hele dagen." };
  }
  return { ok: true, item };
}

/**
 * Dagen uit een reservering halen. Geef je de eerste of laatste dagen vrij, dan
 * krimpt de afspraak; haal je er een dag middenuit, dan valt hij in twee afspraken
 * uiteen. Blijft er niets over, dan gaat de hele reservering weg.
 *
 * De nieuwe stukken erven titel, opmerking en de gegevens over wie geboekt heeft,
 * zodat ze in de app en in de agenda hetzelfde blijven heten.
 */
export async function geefDagenVrij(
  id: string,
  vrij: readonly string[],
): Promise<{ ok: true; resterend: number } | AgendaFout> {
  const verbonden = await verbinding();
  if (!verbonden.ok) return { fout: verbonden.fout };

  const gevonden = await haalRuweAfspraak(verbonden.token, verbonden.agendaId, id);
  if ("fout" in gevonden) return gevonden;
  const { item } = gevonden;

  const weg = new Set(vrij);
  const over = dagenTotEnMet(
    item.start!.date!,
    vorigeDag(item.end!.date!),
  ).filter((dag) => !weg.has(dag));

  const pad = `/calendars/${encodeURIComponent(verbonden.agendaId)}/events`;

  if (over.length === 0) {
    const gewist = await roepAan(
      verbonden.token,
      `${pad}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return gewist.ok ? { ok: true, resterend: 0 } : { fout: gewist.fout };
  }

  const stukken = aaneengeslotenBlokken(over);

  // Het eerste stuk blijft dezelfde afspraak; zo houdt hij zijn plek in de agenda
  // van iedereen die hem al ziet staan.
  const bijgewerkt = await roepAan(
    verbonden.token,
    `${pad}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        start: { date: stukken[0].van },
        end: { date: volgendeDag(stukken[0].tot) },
      }),
    },
  );
  if (!bijgewerkt.ok) return { fout: bijgewerkt.fout };

  for (const stuk of stukken.slice(1)) {
    const gemaakt = await roepAan(verbonden.token, pad, {
      method: "POST",
      body: JSON.stringify({
        summary: item.summary ?? "Gereserveerd",
        description: item.description ?? "",
        start: { date: stuk.van },
        end: { date: volgendeDag(stuk.tot) },
        extendedProperties: {
          private: item.extendedProperties?.private ?? {},
        },
      }),
    });
    if (!gemaakt.ok) return { fout: gemaakt.fout };
  }

  return { ok: true, resterend: over.length };
}
