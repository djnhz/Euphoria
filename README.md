# Euphoria

Bootfinanciën voor twee huishoudens. Vier eigen logins met een pincode, bonnen die per
regel worden uitgelezen, verrekening tussen de twee huishoudens, vaste lasten, jaarbudget
per categorie en een documentenopslag.

## Opzetten

```bash
npm install
```

### Lokaal, zonder cloudaccount

Laat `DATABASE_URL` leeg en de app valt terug op **PGlite**: echte Postgres gecompileerd
naar WebAssembly, met de data in `.pglite/`. Geen server, geen account. Dit gebeurt alleen
buiten productie; op Vercel is een ontbrekende `DATABASE_URL` gewoon een fout.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
npm run db:push
npm run seed
npm run dev
```

Bonnen uploaden werkt in die opzet niet — daar is een `BLOB_READ_WRITE_TOKEN` voor nodig.
De app blijft wel gewoon werken: de upload meldt netjes dat het misging en je vult de
regels zelf in.

### Volledig, met Neon en Blob

Maak `.env.local` op basis van `.env.example`:

| Variabele | Waar vandaan |
|---|---|
| `DATABASE_URL` | Neon, via Vercel → Storage → Neon Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPENAI_API_KEY` | je eigen OpenAI-account |
| `OPENAI_MODEL` | een model dat afbeeldingen aankan, bijvoorbeeld `gpt-4o` |

Daarna het schema wegschrijven en vullen:

```bash
npm run db:push
npm run seed
```

`npm run seed` maakt twee huishoudens, vier gebruikers en een set categorieën aan, en
drukt vier willekeurige startpincodes af. Wijzig ze na de eerste login bij Instellingen;
daar pas je ook de namen aan.

```bash
npm run dev
```

## Controleren

```bash
npm test
```

Dekt het verdelen, het saldo en de datumstappen van de vaste lasten — de plekken waar een
afrondings- of kalenderfout geld scheeft zet.

```bash
npm run db:smoke
```

Draait dezelfde logica een keer tegen de database die is ingesteld (Neon of de lokale PGlite): een uitgave van elk huishouden,
het saldo dat daaruit volgt, en een achterstallige vaste last die precies één keer
uitrolt. Alles wat het script aanmaakt draagt het merkteken `[smoke]` en wordt daarna
weer verwijderd, ook als er iets misgaat.

## Hoe het in elkaar zit

- **Bedragen** staan overal in hele centen als integer. De verdeelregel rondt het deel van
  huishouden A af en geeft de rest aan B, zodat er nooit een cent weglekt. Zie
  [lib/geld.ts](lib/geld.ts).
- **Een uitgave heeft altijd regels.** Handmatige invoer krijgt er één met het hele
  bedrag, een uitgelezen bon meerdere. Eén codepad voor optellen, verdelen en budgetteren.
- **Het totaal van een uitgave staat nergens opgeslagen**; het is de som van de regels.
- **Een bon is een document** met een gevulde `expenseId`. Eén uploadcomponent, één
  viewer, één opruimroutine.
- **Het origineel van een foto wordt onaangeroerd bewaard.** Alleen een verkleinde kopie
  (2576 px lange zijde) gaat naar het model, en dient tegelijk als voorbeeldweergave in
  lijsten.
- **Vaste lasten** worden lui aangemaakt bij het openen van het dashboard, zonder cron. De
  voorwaardelijke `UPDATE` in [lib/data.ts](lib/data.ts) zorgt dat er precies één wint als
  twee mensen tegelijk inladen.
- **Pincodes** worden gehasht met `crypto.scrypt`. De echte bescherming is de teller: vijf
  mislukte pogingen en het account ligt een kwartier op slot. Zonder die rem is een code
  van vier cijfers in seconden te raden.

## Bonanalyse vervangen

De hele koppeling met het model zit in [lib/receipt.ts](lib/receipt.ts), achter één
functie. Wil je naar Claude of een lokaal model, dan is dat dat ene bestand.

## Wat er bewust niet in zit

- **Onderlinge betalingen registreren.** Het saldo telt alleen uitgaven op. Maak je
  onderling €500 over, dan blijft de app die als openstaand tonen. Toevoegen is één tabel
  en een aftrekterm in `saldoCent`.
- **Google Drive.** Het model is er klaar voor: `documents.opslag` en `documents.externId`
  staan er al in, dus een koppeling wordt een extra waarde en geen migratie.
- Export naar Excel, meerdere boten, meer dan twee huishoudens, meldingen, offline gebruik.
