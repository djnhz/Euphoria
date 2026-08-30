import "server-only";
import { JWT } from "google-auth-library";
import { googleAgendaId, googleServiceAccount } from "./instellingen";

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
