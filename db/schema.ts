import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  index,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Bedragen staan overal in hele centen als integer. Nooit floats voor geld.
 * Datums zijn ISO-strings (`YYYY-MM-DD`); tijdstempels zijn echte timestamps.
 */

/** Exact twee rijen. `volgorde = 1` is huishouden A, waar `aandeelAPct` naar verwijst. */
export const couples = pgTable("couples", {
  id: serial("id").primaryKey(),
  naam: text("naam").notNull(),
  volgorde: integer("volgorde").notNull().unique(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  coupleId: integer("couple_id")
    .notNull()
    .references(() => couples.id),
  naam: text("naam").notNull(),
  pinHash: text("pin_hash").notNull(),
  pinSalt: text("pin_salt").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  /** Mag de seizoensplanning maken. Minstens een gebruiker hoort dit te zijn. */
  beheerder: boolean("beheerder").notNull().default(false),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/**
 * De posten van de begroting, in twee lagen: een post zonder `ouderId` is een
 * hoofdpost, met `ouderId` is het een subpost daaronder. Dieper gaat het niet.
 *
 * Dit is de enige indeling die de app kent. Een bonregel wijst naar precies een post
 * en dat mag net zo goed een hoofdpost als een subpost zijn: je boekt op het niveau
 * dat je kiest.
 */
export const posten = pgTable("posten", {
  id: serial("id").primaryKey(),
  naam: text("naam").notNull().unique(),
  kleur: text("kleur").notNull().default("#64748b"),
  ouderId: integer("ouder_id").references((): AnyPgColumn => posten.id, {
    onDelete: "set null",
  }),
  actief: boolean("actief").notNull().default(true),
});

/**
 * Begroting: per jaar een bedrag per post. Een jaar zonder rijen is simpelweg niet
 * begroot; een post zonder rij in dat jaar ook niet. Begroten mag op een hoofdpost,
 * op zijn subposten, of allebei -- het scherm telt op wat er staat.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    jaar: integer("jaar").notNull(),
    postId: integer("post_id")
      .notNull()
      .references(() => posten.id, { onDelete: "cascade" }),
    bedragCent: integer("bedrag_cent").notNull(),
  },
  (t) => [unique("budgets_jaar_post").on(t.jaar, t.postId)],
);

export type AnalyseStatus = "geen" | "gelukt" | "mislukt";

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    /** Welk huishouden het geld heeft voorgeschoten. */
    coupleId: integer("couple_id")
      .notNull()
      .references(() => couples.id),
    /** Wie de uitgave heeft ingevoerd. */
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    datum: date("datum").notNull(),
    leverancier: text("leverancier").notNull().default(""),
    opmerking: text("opmerking").notNull().default(""),
    analyseStatus: text("analyse_status")
      .$type<AnalyseStatus>()
      .notNull()
      .default("geen"),
    aangemaaktOp: timestamp("aangemaakt_op", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("expenses_datum_idx").on(t.datum)],
);

export type LineBron = "handmatig" | "ai";

/**
 * Elke uitgave heeft minstens een regel; een handmatige invoer krijgt er precies een
 * met het hele bedrag. Het totaal van een uitgave is de som van de regels en staat
 * daarom nergens apart opgeslagen.
 */
export const expenseLines = pgTable(
  "expense_lines",
  {
    id: serial("id").primaryKey(),
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    omschrijving: text("omschrijving").notNull(),
    aantal: integer("aantal").notNull().default(1),
    bedragCent: integer("bedrag_cent").notNull(),
    /** Waarop deze regel drukt: een hoofdpost of een subpost, jouw keuze. */
    postId: integer("post_id")
      .notNull()
      .references(() => posten.id),
    /** Percentage van deze regel voor huishouden A (volgorde = 1). Rest is voor B. */
    aandeelAPct: integer("aandeel_a_pct").notNull().default(50),
    bron: text("bron").$type<LineBron>().notNull().default("handmatig"),
    volgorde: integer("volgorde").notNull().default(0),
  },
  (t) => [
    index("expense_lines_expense_idx").on(t.expenseId),
    index("expense_lines_post_idx").on(t.postId),
  ],
);

export type Opslag = "blob" | "lokaal" | "drive";

/**
 * Een bon is gewoon een document met een gevulde `expenseId`. Daardoor is er een
 * uploadcomponent, een viewer en een opruimroutine voor de hele app.
 *
 * `opslag` en `externId` staan er nu al in zodat een Drive-koppeling later een extra
 * waarde is in plaats van een migratie.
 */
export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    naam: text("naam").notNull(),
    map: text("map").notNull().default("overig"),
    mime: text("mime").notNull(),
    grootteBytes: integer("grootte_bytes").notNull(),
    opslag: text("opslag").$type<Opslag>().notNull().default("blob"),
    url: text("url").notNull(),
    /**
     * Verkleinde kopie: wat naar het model gaat en tegelijk de voorbeeldweergave in
     * lijsten. Het origineel in `url` blijft onaangeroerd.
     */
    voorbeeldUrl: text("voorbeeld_url"),
    externId: text("extern_id"),
    /**
     * SHA-256 van de bestandsinhoud, hexadecimaal. Daarmee herkent de app een bon
     * die al eerder is ingeladen, ook onder een andere naam. Leeg bij bestanden van
     * voor deze controle en bij browsers zonder `crypto.subtle`.
     */
    hash: text("hash"),
    expenseId: integer("expense_id").references(() => expenses.id, {
      onDelete: "cascade",
    }),
    geuploadDoor: integer("geupload_door")
      .notNull()
      .references(() => users.id),
    geuploadOp: timestamp("geupload_op", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("documents_expense_idx").on(t.expenseId),
    index("documents_hash_idx").on(t.hash),
  ],
);

/**
 * Kleine sleutel-waardetabel voor instellingen die niet in de code of in een
 * omgevingsvariabele thuishoren, zoals de OpenAI-sleutel die iemand via het scherm
 * invult. Geheimen staan hier versleuteld; zie lib/instellingen.ts.
 */
export const settings = pgTable("settings", {
  sleutel: text("sleutel").primaryKey(),
  waarde: text("waarde").notNull(),
  gewijzigdOp: timestamp("gewijzigd_op", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * De seizoensplanning van een jaar, zoals je hem op het scherm hebt staan: wie de
 * oneven weken heeft, aan wie de lange weekenden zijn toegewezen en welke vakanties
 * je hebt ingepland. Eén rij per jaar, gedeeld door iedereen.
 *
 * Bewust één JSON-veld in plaats van drie tabellen: het is een concept dat je in één
 * zitting maakt en in zijn geheel leest of schrijft. `lib/seizoen.ts` rekent er de
 * blokken uit; die hoeven dus niet bewaard te worden.
 */
export const seizoenen = pgTable("seizoenen", {
  jaar: integer("jaar").primaryKey(),
  plan: text("plan").notNull(),
  gewijzigdOp: timestamp("gewijzigd_op", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Wat een uitgelezen bon aan het model heeft gekost, in tokens. OpenAI geeft geen
 * saldo terug, dus dit is de enige manier om te zien wat déze app verbruikt heeft --
 * los van al het andere dat op dezelfde sleutel draait.
 */
export const aiGebruik = pgTable("ai_gebruik", {
  id: serial("id").primaryKey(),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensUit: integer("tokens_uit").notNull(),
  gebeurdOp: timestamp("gebeurd_op", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
