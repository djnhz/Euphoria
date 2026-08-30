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

Uploads werken ook zonder `BLOB_READ_WRITE_TOKEN`: bestanden komen dan in `.uploads/`
naast het project te staan en worden uitgeserveerd via `/api/bestand`, alleen aan wie is
ingelogd. Op Vercel is die token wel verplicht — daar is geen schijf die een deploy
overleeft.

PGlite is single-writer. Stop de dev-server voordat je `db:push`, `seed` of `db:smoke`
draait, anders praten twee processen tegelijk tegen dezelfde map en ziet de draaiende
server de wijziging niet.

### Volledig, met Neon en Blob

Maak `.env.local` op basis van `.env.example`:

| Variabele | Waar vandaan |
|---|---|
| `DATABASE_URL` | Neon, via Vercel → Storage → Neon Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPENAI_API_KEY` | optioneel; kan ook via Instellingen |
| `OPENAI_MODEL` | optioneel; kan ook via Instellingen |

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

## Bon uploaden en uitlezen

Dit zijn twee losse stappen. **Uploaden slaat altijd op**: het bestand staat vast zodra het
binnen is, ongeacht of er een OpenAI-sleutel is en of het uitlezen later lukt. Pas als je
bij de miniatuur op **Analyseren** klikt gaat er een verkleinde kopie naar het model, en
vult het antwoord de regels van het formulier. Dat kan zo vaak als je wilt, en de regels
blijven daarna gewoon aanpasbaar; wat uit een bon kwam is gemerkt met "uit bon".

Grote bestanden gaan met Blob rechtstreeks vanuit de browser naar de opslag, want een
server mag maar 4,5 MB per verzoek ontvangen en een telefoonfoto is zo 12 MB. Zonder Blob
loopt het via `/api/upload`, wat lokaal prima werkt.

## De OpenAI-sleutel

Je hoeft er geen omgevingsvariabele voor aan te raken: vul hem in bij **Instellingen →
Bonanalyse**. Hij wordt met AES-256-GCM versleuteld opgeslagen, afgeleid van
`SESSION_SECRET`, en gaat nooit terug naar de browser — je ziet er alleen de laatste vier
tekens van. **Verbinding testen** haalt het ingestelde model op; dat kost geen tokens maar
valt wel meteen door de mand bij een verkeerde sleutel of modelnaam.

Staat `OPENAI_API_KEY` wél in de omgeving, dan gaat die voor en zet het scherm zichzelf op
alleen-lezen. Verander je `SESSION_SECRET`, dan is de opgeslagen sleutel niet meer te lezen
en vraagt het scherm om hem opnieuw in te vullen.

## Bonanalyse vervangen

De hele koppeling met het model zit in [lib/receipt.ts](lib/receipt.ts), achter één
functie. Wil je naar Claude of een lokaal model, dan is dat dat ene bestand.

## Vaarplanning met Google Agenda

Reserveringen staan in Google Agenda en nergens anders: geen eigen tabel ernaast, dus
niets dat uit de pas loopt als iemand rechtstreeks in zijn agenda iets verzet. Wie
geboekt heeft bewaart de app in de afspraak zelf, in extendedProperties.

Koppelen gaat via een **serviceaccount**, niet via inloggen met je eigen Google-account.
Agenda-toegang is bij Google een gevoelige machtiging: zolang de app hun verificatie niet
doorlopen heeft verloopt zo een koppeling elke zeven dagen. Een serviceaccount is gewoon
een adres waarmee je de agenda deelt, en dat verloopt niet.

Opzetten: in Google Cloud een project maken, de Calendar API inschakelen, een
serviceaccount aanmaken met een JSON-sleutel, en die sleutel plus het agenda-ID invullen
bij Instellingen. Deel daarna de agenda met het adres van het serviceaccount, met rechten
om afspraken te wijzigen. De sleutel wordt versleuteld opgeslagen, net als die van OpenAI.

Je reserveert hele dagen. Overlap wordt gemeld maar niet geblokkeerd: de tweede druk op
de knop boekt hem er alsnog bij, zodat samen varen gewoon kan.

## Wat er bewust niet in zit

- **Onderlinge betalingen registreren.** Het saldo telt alleen uitgaven op. Maak je
  onderling €500 over, dan blijft de app die als openstaand tonen. Toevoegen is één tabel
  en een aftrekterm in `saldoCent`.
- **Google Drive.** Het model is er klaar voor: `documents.opslag` en `documents.externId`
  staan er al in, dus een koppeling wordt een extra waarde en geen migratie.
- Export naar Excel, meerdere boten, meer dan twee huishoudens, meldingen, offline gebruik.
