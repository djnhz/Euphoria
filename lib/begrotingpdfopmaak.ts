import path from "node:path";
import PDFDocument from "pdfkit";
import type { BegrotingsPost } from "./begroting";
import { perStelPerMaand } from "./begroting";
import {
  overzichtRegels,
  overzichtTotalen,
  type OverzichtRegel,
} from "./begrotingoverzicht";
import { formatEuro } from "./geld";
import { formatDatum, vandaag } from "./datum";

/**
 * De begroting als PDF, in de huisstijl van de app: de marineblauwe balk met het logo
 * bovenaan, de donkere standtegel, en de posten op een wit paneel op linnen. Zelfde
 * lettertypes als de site -- Newsreader voor de titel, Archivo voor namen, Plex Mono
 * voor bedragen -- zodat het er niet uitziet als een ander programma.
 *
 * Los van de database (zie lib/begrotingpdf.ts), zodat hij ook met proefgegevens te
 * maken is: lange namen, veel posten, meerdere pagina's.
 */

// De kleuren uit app/globals.css. Halfdoorzichtige tinten zijn hier vooraf gemengd
// met hun achtergrond: dan zien ze er in elke PDF-lezer en op papier hetzelfde uit.
const K = {
  inkt: "#16283F",
  inktDiep: "#0F2038",
  messing: "#C9A662",
  messingInkt: "#8A6A2F",
  linnen: "#F7F4EC",
  paneel: "#FFFFFF",
  verzonken: "#FBF9F4",
  rand: "#E8E9EB", // rand op paneel
  gedempt: "#5F6B7A", // gedempt op paneel
  zacht: "#9BA4AF",
  marineZacht: "#9DB4CE",
  slecht: "#9B2C1F",
  // Op de donkere tegel
  linnen65: "#AEB3B8",
  linnen20: "#41505F",
  linnen15: "#38475A",
} as const;

const PAGINA = { breedte: 595.28, hoogte: 841.89 }; // A4
const MARGE = 40;
const BREEDTE = PAGINA.breedte - MARGE * 2;
const VOET = 34; // ruimte onderaan voor het paginanummer

// Kolommen binnen het paneel, gemeten vanaf de binnenrand.
const BINNEN = 16;
const PANEEL_BREEDTE = BREEDTE;
const KOLOM_BREEDTE = 74;
const KOLOM = {
  over: PANEEL_BREEDTE - BINNEN * 2 - KOLOM_BREEDTE,
  besteed: PANEEL_BREEDTE - BINNEN * 2 - KOLOM_BREEDTE * 2 - 8,
  begroot: PANEEL_BREEDTE - BINNEN * 2 - KOLOM_BREEDTE * 3 - 16,
};

function bestand(...deel: string[]) {
  return path.join(process.cwd(), ...deel);
}

const LETTERS = {
  titel: bestand("node_modules/@fontsource/newsreader/files/newsreader-latin-500-normal.woff"),
  tekst: bestand("node_modules/@fontsource/archivo/files/archivo-latin-400-normal.woff"),
  tekstVet: bestand("node_modules/@fontsource/archivo/files/archivo-latin-600-normal.woff"),
  cijfers: bestand("node_modules/@ibm/plex-mono/fonts/complete/woff/IBMPlexMono-Regular.woff"),
  cijfersVet: bestand("node_modules/@ibm/plex-mono/fonts/complete/woff/IBMPlexMono-Medium.woff"),
};
const LOGO = bestand("public/euphoria-logo-donker-v2.png");
const LOGO_VERHOUDING = 900 / 642;

type Doc = PDFKit.PDFDocument;

/** Kort een tekst in tot hij op één regel past, met "…" erachter. */
function passend(doc: Doc, tekst: string, breedte: number): string {
  if (doc.widthOfString(tekst) <= breedte) return tekst;
  let kort = tekst;
  while (kort.length > 1 && doc.widthOfString(`${kort.trimEnd()}…`) > breedte) {
    kort = kort.slice(0, -1);
  }
  return `${kort.trimEnd()}…`;
}

function bedrag(cent: number | null): string {
  return cent === null ? "—" : formatEuro(cent);
}

/** De kleine kapitalen boven een blok, zoals `.bovenschrift` op de site. */
function bovenschrift(
  doc: Doc,
  tekst: string,
  x: number,
  y: number,
  kleur: string,
  opties: PDFKit.Mixins.TextOptions = {},
) {
  doc
    .font("cijfers")
    .fontSize(7)
    .fillColor(kleur)
    .text(tekst.toUpperCase(), x, y, {
      characterSpacing: 1.1,
      lineBreak: false,
      ...opties,
    });
}

function rijHoogte(regel: OverzichtRegel): number {
  if (regel.soort === "onderbouwing") return 15;
  return regel.niveau === 0 ? 28 : 20;
}

export function tekenBegrotingPdf(
  jaar: number,
  posten: readonly BegrotingsPost[],
  vandaagIso: string = vandaag(),
): Promise<Buffer> {
  const regels = overzichtRegels(posten);
  const { begrootCent, besteedCent } = overzichtTotalen(posten);
  const gemaakt = formatDatum(vandaagIso);

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    info: { Title: `Begroting ${jaar}`, Author: "Euphoria" },
  });
  doc.registerFont("titel", LETTERS.titel);
  doc.registerFont("tekst", LETTERS.tekst);
  doc.registerFont("tekstVet", LETTERS.tekstVet);
  doc.registerFont("cijfers", LETTERS.cijfers);
  doc.registerFont("cijfersVet", LETTERS.cijfersVet);

  const delen: Buffer[] = [];
  doc.on("data", (deel: Buffer) => delen.push(deel));
  const klaar = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(delen))),
  );

  /** Nieuwe pagina in linnen, met de marineblauwe balk. Geeft de y onder de balk. */
  function nieuwePagina(eerste: boolean): number {
    doc.addPage({ size: "A4", margin: 0 });
    doc.rect(0, 0, PAGINA.breedte, PAGINA.hoogte).fill(K.linnen);

    const balk = eerste ? 108 : 58;
    doc.rect(0, 0, PAGINA.breedte, balk).fill(K.inktDiep);
    const logoHoogte = eerste ? 72 : 38;
    doc.image(LOGO, MARGE, (balk - logoHoogte) / 2, {
      height: logoHoogte,
      width: logoHoogte * LOGO_VERHOUDING,
    });

    const rechts = PAGINA.breedte - MARGE;
    if (eerste) {
      bovenschrift(doc, "Begroting", rechts - 200, 34, K.messing, {
        width: 200,
        align: "right",
      });
      doc
        .font("titel")
        .fontSize(34)
        .fillColor(K.linnen)
        .text(String(jaar), rechts - 200, 46, {
          width: 200,
          align: "right",
          lineBreak: false,
        });
    } else {
      doc
        .font("titel")
        .fontSize(15)
        .fillColor(K.linnen)
        .text(`Begroting ${jaar}`, rechts - 220, 20, {
          width: 220,
          align: "right",
          lineBreak: false,
        });
    }
    return balk + 22;
  }

  // --- Pagina 1: de stand --------------------------------------------------------
  let y = nieuwePagina(true);

  doc
    .font("tekst")
    .fontSize(8.5)
    .fillColor(K.gedempt)
    .text(`Inclusief btw · gemaakt op ${gemaakt}`, MARGE, y, {
      lineBreak: false,
    });
  y += 20;

  const over = begrootCent - besteedCent;
  const tegelHoogte = begrootCent > 0 || besteedCent > 0 ? 184 : 86;
  doc.roundedRect(MARGE, y, BREEDTE, tegelHoogte, 14).fill(K.inkt);
  const tx = MARGE + 20;
  const tb = BREEDTE - 40;
  bovenschrift(
    doc,
    begrootCent === 0
      ? "Nog niets begroot"
      : over < 0
        ? "Boven begroting"
        : "Nog te besteden",
    tx,
    y + 18,
    K.messing,
  );
  doc
    .font("cijfersVet")
    .fontSize(26)
    .fillColor(K.linnen)
    .text(formatEuro(Math.abs(over)), tx, y + 32, { lineBreak: false });

  if (begrootCent > 0 || besteedCent > 0) {
    // De voortgangsbalk.
    const by = y + 72;
    doc.roundedRect(tx, by, tb, 6, 3).fill(K.linnen20);
    if (begrootCent > 0) {
      const deel = Math.min(1, besteedCent / begrootCent);
      if (deel > 0) {
        doc.roundedRect(tx, by, Math.max(6, tb * deel), 6, 3).fill(K.marineZacht);
      }
      doc
        .font("cijfers")
        .fontSize(7.5)
        .fillColor(K.linnen65)
        .text(
          `${Math.round((besteedCent / begrootCent) * 100)}% van de begroting besteed`,
          tx,
          by + 12,
          { lineBreak: false },
        );
    }

    // Begroot en gerealiseerd naast elkaar, als in de tegel op het scherm.
    const ly = by + 34;
    doc
      .moveTo(tx, ly)
      .lineTo(tx + tb, ly)
      .lineWidth(0.6)
      .strokeColor(K.linnen15)
      .stroke();
    const kolA = tx + 150;
    const kolB = tx + 300;
    bovenschrift(doc, "Begroot", kolA, ly + 12, K.linnen65);
    bovenschrift(doc, "Gerealiseerd", kolB, ly + 12, K.linnen65);
    const rijen: [string, string, string, string][] = [
      [
        "Totaal",
        begrootCent > 0 ? formatEuro(begrootCent) : "—",
        formatEuro(besteedCent),
        K.linnen,
      ],
      [
        "Per stel per maand",
        begrootCent > 0 ? formatEuro(perStelPerMaand(begrootCent)) : "—",
        formatEuro(perStelPerMaand(besteedCent)),
        K.messing,
      ],
    ];
    rijen.forEach(([label, a, b, kleur], i) => {
      const ry = ly + 28 + i * 20;
      doc
        .font("tekst")
        .fontSize(8.5)
        .fillColor(K.linnen65)
        .text(label, tx, ry + 2, { lineBreak: false });
      doc
        .font("cijfers")
        .fontSize(12)
        .fillColor(kleur)
        .text(a, kolA, ry, { lineBreak: false })
        .text(b, kolB, ry, { lineBreak: false });
    });
  }
  y += tegelHoogte + 22;

  // --- De posten, verdeeld over pagina's --------------------------------------------
  bovenschrift(doc, `Posten ${jaar}`, MARGE + 2, y, K.gedempt);
  y += 14;

  const KOP = 30; // kopregel van het paneel
  const onderkant = PAGINA.hoogte - VOET - 10;

  if (regels.length === 0) {
    doc.roundedRect(MARGE, y, BREEDTE, 56, 14).fillAndStroke(K.paneel, K.rand);
    doc
      .font("tekst")
      .fontSize(10)
      .fillColor(K.gedempt)
      .text(`Voor ${jaar} staat nog niets begroot of geboekt.`, MARGE + BINNEN, y + 22, {
        lineBreak: false,
      });
  }

  let i = 0;
  while (i < regels.length) {
    // Hoeveel regels passen er op deze pagina, onder de kopregel van het paneel?
    let ruimte = onderkant - y - KOP - 8;
    let tot = i;
    while (tot < regels.length && ruimte - rijHoogte(regels[tot]) >= 0) {
      ruimte -= rijHoogte(regels[tot]);
      tot++;
    }
    // Een hoofdpost niet als laatste regel onderaan laten staan, los van zijn inhoud.
    if (
      tot < regels.length &&
      tot - 1 > i &&
      regels[tot - 1].soort === "post" &&
      regels[tot - 1].niveau === 0
    ) {
      tot--;
    }
    const stuk = regels.slice(i, Math.max(tot, i + 1));
    const hoogte = KOP + stuk.reduce((som, r) => som + rijHoogte(r), 0) + 8;

    doc.roundedRect(MARGE, y, BREEDTE, hoogte, 14).fillAndStroke(K.paneel, K.rand);
    doc.lineWidth(0.6);

    // Kopregel van het paneel.
    const kx = MARGE + BINNEN;
    bovenschrift(doc, "Post", kx, y + 13, K.gedempt);
    for (const [kolom, titel] of [
      ["begroot", "Begroot"],
      ["besteed", "Besteed"],
      ["over", "Over"],
    ] as const) {
      bovenschrift(doc, titel, kx + KOLOM[kolom], y + 13, K.gedempt, {
        width: KOLOM_BREEDTE,
        align: "right",
      });
    }
    doc
      .moveTo(MARGE, y + KOP - 4)
      .lineTo(MARGE + BREEDTE, y + KOP - 4)
      .strokeColor(K.rand)
      .stroke();

    let ry = y + KOP + 2;
    stuk.forEach((regel, n) => {
      const h = rijHoogte(regel);
      const inspring = regel.niveau * 14;
      const naamX = kx + inspring + (regel.soort === "post" ? 12 : 12);
      const naamBreedte = KOLOM.begroot - inspring - 22;

      if (regel.soort === "post") {
        const hoofd = regel.niveau === 0;
        if (hoofd && n > 0) {
          doc
            .moveTo(MARGE + BINNEN, ry + 2)
            .lineTo(MARGE + BREEDTE - BINNEN, ry + 2)
            .strokeColor(K.rand)
            .stroke();
        }
        const tekstY = ry + (hoofd ? 10 : 4);
        doc
          .roundedRect(kx + inspring, tekstY + 2, 7, 7, 1.5)
          .fill(regel.kleur);
        doc
          .font(hoofd ? "tekstVet" : "tekst")
          .fontSize(hoofd ? 10 : 9.5)
          .fillColor(K.inkt);
        doc.text(passend(doc, regel.naam, naamBreedte), naamX, tekstY, {
          lineBreak: false,
        });

        const overCent =
          regel.begrootCent === null ? null : regel.begrootCent - regel.besteedCent;
        doc.font(hoofd ? "cijfersVet" : "cijfers").fontSize(hoofd ? 9.5 : 9);
        const cellen: [keyof typeof KOLOM, string, string][] = [
          ["begroot", bedrag(regel.begrootCent), K.inkt],
          ["besteed", formatEuro(regel.besteedCent), K.inkt],
          [
            "over",
            overCent === null ? "—" : formatEuro(overCent),
            overCent !== null && overCent < 0 ? K.slecht : K.gedempt,
          ],
        ];
        for (const [kolom, tekst, kleur] of cellen) {
          doc.fillColor(kleur).text(tekst, kx + KOLOM[kolom], tekstY - 1, {
            width: KOLOM_BREEDTE,
            align: "right",
            lineBreak: false,
          });
        }
      } else {
        const tekstY = ry + 3;
        doc.font("tekst").fontSize(8.5).fillColor(K.gedempt);
        doc.text(passend(doc, regel.naam, naamBreedte), naamX, tekstY, {
          lineBreak: false,
        });
        doc
          .font("cijfers")
          .fontSize(8.5)
          .fillColor(K.gedempt)
          .text(formatEuro(regel.bedragCent), kx + KOLOM.begroot, tekstY - 0.8, {
            width: KOLOM_BREEDTE,
            align: "right",
            lineBreak: false,
          });
      }
      ry += h;
    });

    i += stuk.length;
    if (i < regels.length) y = nieuwePagina(false);
  }

  // --- Voet op elke pagina -------------------------------------------------------
  const bereik = doc.bufferedPageRange();
  for (let p = 0; p < bereik.count; p++) {
    doc.switchToPage(bereik.start + p);
    const vy = PAGINA.hoogte - VOET + 6;
    doc
      .font("cijfers")
      .fontSize(7)
      .fillColor(K.zacht)
      .text(`Euphoria · begroting ${jaar} · ${gemaakt}`, MARGE, vy, {
        lineBreak: false,
      })
      .text(`pagina ${p + 1} van ${bereik.count}`, MARGE, vy, {
        width: BREEDTE,
        align: "right",
        lineBreak: false,
      });
  }

  doc.end();
  return klaar;
}
