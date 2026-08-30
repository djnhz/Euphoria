import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settings } from "@/db";

/**
 * De OpenAI-sleutel mag ingevuld worden via het instellingenscherm, zodat niet iedereen
 * aan een omgevingsvariabele hoeft te komen. Hij staat versleuteld in de database en
 * verlaat de server nooit: schermen krijgen alleen de status en de laatste vier tekens.
 *
 * De versleuteling is afgeleid van SESSION_SECRET. Verander je dat geheim, dan is de
 * opgeslagen sleutel niet meer te lezen en moet hij opnieuw ingevuld worden. Dat is
 * bewust: een databasedump alleen is dan niets waard.
 */

const SLEUTEL_API = "openai_api_key";
const SLEUTEL_MODEL = "openai_model";
const STANDAARD_MODEL = "gpt-4o";

function sleutelmateriaal(): Buffer {
  const geheim = process.env.SESSION_SECRET ?? "";
  if (geheim.length < 32) {
    throw new Error("SESSION_SECRET ontbreekt of is korter dan 32 tekens");
  }
  // Vaste salt: de sleutel moet na een herstart opnieuw af te leiden zijn.
  return scryptSync(geheim, "euphoria-instellingen", 32);
}

function versleutel(tekst: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sleutelmateriaal(), iv);
  const data = Buffer.concat([cipher.update(tekst, "utf8"), cipher.final()]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    data.toString("hex"),
  ].join(":");
}

function ontsleutel(opgeslagen: string): string | null {
  try {
    const [iv, tag, data] = opgeslagen.split(":");
    if (!iv || !tag || !data) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      sleutelmateriaal(),
      Buffer.from(iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Verkeerde SESSION_SECRET of beschadigde rij: behandel als niet ingesteld.
    return null;
  }
}

async function leesRuw(sleutel: string): Promise<string | null> {
  const [rij] = await db
    .select()
    .from(settings)
    .where(eq(settings.sleutel, sleutel));
  return rij?.waarde ?? null;
}

async function schrijf(sleutel: string, waarde: string) {
  await db
    .insert(settings)
    .values({ sleutel, waarde })
    .onConflictDoUpdate({
      target: settings.sleutel,
      set: { waarde, gewijzigdOp: new Date() },
    });
}

async function wis(sleutel: string) {
  await db.delete(settings).where(eq(settings.sleutel, sleutel));
}

/** De sleutel waarmee daadwerkelijk gebeld wordt. Omgevingsvariabele gaat voor. */
export async function openAiSleutel(): Promise<string | null> {
  const uitOmgeving = process.env.OPENAI_API_KEY?.trim();
  if (uitOmgeving) return uitOmgeving;
  const opgeslagen = await leesRuw(SLEUTEL_API);
  return opgeslagen ? ontsleutel(opgeslagen) : null;
}

export async function openAiModel(): Promise<string> {
  const uitOmgeving = process.env.OPENAI_MODEL?.trim();
  if (uitOmgeving) return uitOmgeving;
  return (await leesRuw(SLEUTEL_MODEL)) ?? STANDAARD_MODEL;
}

export type SleutelStatus = {
  ingesteld: boolean;
  /** Waar de sleutel vandaan komt die de app gebruikt. */
  herkomst: "omgeving" | "database" | "geen";
  /** Laatste vier tekens, genoeg om te herkennen zonder hem prijs te geven. */
  laatste4: string | null;
  /** Er staat wel iets opgeslagen, maar het is niet te ontsleutelen. */
  onleesbaar: boolean;
  model: string;
  modelUitOmgeving: boolean;
};

export async function sleutelStatus(): Promise<SleutelStatus> {
  const model = await openAiModel();
  const modelUitOmgeving = Boolean(process.env.OPENAI_MODEL?.trim());

  const uitOmgeving = process.env.OPENAI_API_KEY?.trim();
  if (uitOmgeving) {
    return {
      ingesteld: true,
      herkomst: "omgeving",
      laatste4: uitOmgeving.slice(-4),
      onleesbaar: false,
      model,
      modelUitOmgeving,
    };
  }

  const opgeslagen = await leesRuw(SLEUTEL_API);
  if (!opgeslagen) {
    return {
      ingesteld: false,
      herkomst: "geen",
      laatste4: null,
      onleesbaar: false,
      model,
      modelUitOmgeving,
    };
  }

  const leesbaar = ontsleutel(opgeslagen);
  return {
    ingesteld: leesbaar !== null,
    herkomst: leesbaar !== null ? "database" : "geen",
    laatste4: leesbaar?.slice(-4) ?? null,
    onleesbaar: leesbaar === null,
    model,
    modelUitOmgeving,
  };
}

/** Losse controle zodat een plakfout meteen opvalt in plaats van pas bij de eerste bon. */
export function sleutelZietEruitAlsSleutel(sleutel: string): string | null {
  if (/\s/.test(sleutel)) return "De sleutel bevat spaties of regeleinden.";
  if (sleutel.length < 20) return "Dit is te kort voor een API-sleutel.";
  if (!sleutel.startsWith("sk-")) {
    return "Een OpenAI-sleutel begint met sk-. Controleer of je de juiste waarde plakt.";
  }
  return null;
}

export async function zetOpenAiSleutel(sleutel: string) {
  await schrijf(SLEUTEL_API, versleutel(sleutel));
}

export async function verwijderOpenAiSleutel() {
  await wis(SLEUTEL_API);
}

export async function zetOpenAiModel(model: string) {
  const schoon = model.trim();
  if (schoon === "") await wis(SLEUTEL_MODEL);
  else await schrijf(SLEUTEL_MODEL, schoon);
}

const SLEUTEL_GOOGLE = "google_service_account";
const SLEUTEL_AGENDA = "google_calendar_id";

export type AgendaStatus = {
  /** Serviceaccount aanwezig en leesbaar. */
  gekoppeld: boolean;
  /** Het e-mailadres waarmee je de agenda moet delen. */
  serviceEmail: string | null;
  agendaId: string | null;
  onleesbaar: boolean;
};

type ServiceAccount = { client_email: string; private_key: string };

/** De sleutel zelf; alleen voor servercode die Google aanroept. */
export async function googleServiceAccount(): Promise<ServiceAccount | null> {
  const opgeslagen = await leesRuw(SLEUTEL_GOOGLE);
  if (!opgeslagen) return null;
  const leesbaar = ontsleutel(opgeslagen);
  if (!leesbaar) return null;
  try {
    const ontleed = JSON.parse(leesbaar) as Partial<ServiceAccount>;
    if (!ontleed.client_email || !ontleed.private_key) return null;
    return { client_email: ontleed.client_email, private_key: ontleed.private_key };
  } catch {
    return null;
  }
}

export async function googleAgendaId(): Promise<string | null> {
  return leesRuw(SLEUTEL_AGENDA);
}

export async function agendaStatus(): Promise<AgendaStatus> {
  const agendaId = await googleAgendaId();
  const opgeslagen = await leesRuw(SLEUTEL_GOOGLE);
  if (!opgeslagen) {
    return { gekoppeld: false, serviceEmail: null, agendaId, onleesbaar: false };
  }
  const account = await googleServiceAccount();
  return {
    gekoppeld: account !== null,
    serviceEmail: account?.client_email ?? null,
    agendaId,
    onleesbaar: account === null,
  };
}

/** Geeft het e-mailadres terug waarmee de agenda gedeeld moet worden. */
export async function zetGoogleServiceAccount(json: string): Promise<string> {
  let ontleed: Partial<ServiceAccount>;
  try {
    ontleed = JSON.parse(json) as Partial<ServiceAccount>;
  } catch {
    throw new Error("Dit is geen geldige JSON. Plak het hele sleutelbestand.");
  }
  if (!ontleed.client_email || !ontleed.private_key) {
    throw new Error(
      "In deze JSON ontbreekt client_email of private_key. Dit lijkt geen serviceaccountsleutel.",
    );
  }
  await schrijf(SLEUTEL_GOOGLE, versleutel(json));
  return ontleed.client_email;
}

export async function zetGoogleAgendaId(agendaId: string) {
  const schoon = agendaId.trim();
  if (schoon === "") await wis(SLEUTEL_AGENDA);
  else await schrijf(SLEUTEL_AGENDA, schoon);
}

export async function ontkoppelGoogle() {
  await wis(SLEUTEL_GOOGLE);
  await wis(SLEUTEL_AGENDA);
}
