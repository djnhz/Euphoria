import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  index,
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

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  naam: text("naam").notNull().unique(),
  kleur: text("kleur").notNull().default("#64748b"),
  budgetJaarCent: integer("budget_jaar_cent"),
  actief: boolean("actief").notNull().default(true),
});

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
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    /** Percentage van deze regel voor huishouden A (volgorde = 1). Rest is voor B. */
    aandeelAPct: integer("aandeel_a_pct").notNull().default(50),
    bron: text("bron").$type<LineBron>().notNull().default("handmatig"),
    volgorde: integer("volgorde").notNull().default(0),
  },
  (t) => [index("expense_lines_expense_idx").on(t.expenseId)],
);

export type Interval = "maand" | "kwartaal" | "jaar";

export const recurring = pgTable("recurring", {
  id: serial("id").primaryKey(),
  omschrijving: text("omschrijving").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  bedragCent: integer("bedrag_cent").notNull(),
  interval: text("interval").$type<Interval>().notNull(),
  volgendeDatum: date("volgende_datum").notNull(),
  coupleId: integer("couple_id")
    .notNull()
    .references(() => couples.id),
  aandeelAPct: integer("aandeel_a_pct").notNull().default(50),
  actief: boolean("actief").notNull().default(true),
});

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
  (t) => [index("documents_expense_idx").on(t.expenseId)],
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
