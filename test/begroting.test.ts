import test from "node:test";
import assert from "node:assert/strict";
import {
  bedragVanPost,
  bouwBoom,
  heeftRegels,
  opVolgorde,
  totaalBegroot,
  ontwerpVan,
  begrootVanOntwerp,
  type PostRegel,
} from "../lib/begroting.ts";
import { parseEuro } from "../lib/geld.ts";

/**
 * Het scharnier van dit alles: `naam === null` is het losse bedrag van een post,
 * alles anders -- ook een lege string -- is een begrotingsregel. Daar hangt aan vast
 * of het scherm een invoerveld of een lijst toont, en of het bedrag wordt opgeteld.
 */

const los = (bedragCent: number, id = 1): PostRegel => ({
  id,
  naam: null,
  bedragCent,
  volgorde: 0,
});

const regel = (
  naam: string,
  bedragCent: number,
  id: number,
  volgorde = id,
): PostRegel => ({ id, naam, bedragCent, volgorde });

// --- bedragVanPost ---

test("geen rijen betekent niet begroot, en dat is iets anders dan nul", () => {
  assert.equal(bedragVanPost([]), null);
});

test("alleen een los bedrag levert dat bedrag op", () => {
  assert.equal(bedragVanPost([los(65_000)]), 65_000);
});

test("drie regels tellen op", () => {
  const rijen = [
    regel("haalbeurt", 35_000, 1),
    regel("poetsen", 12_000, 2),
    regel("antifouling", 18_000, 3),
  ];
  assert.equal(bedragVanPost(rijen), 65_000);
});

test("een regel van nul telt gewoon mee", () => {
  assert.equal(bedragVanPost([regel("nog te bepalen", 0, 1)]), 0);
});

test("alleen regels van nul geeft nul, niet niet-begroot", () => {
  const rijen = [regel("a", 0, 1), regel("b", 0, 2)];
  assert.equal(bedragVanPost(rijen), 0);
});

test("een achtergebleven los bedrag telt niet mee zodra er regels zijn", () => {
  // Zo kan een half afgebroken bewerking nooit een bedrag verzinnen.
  const rijen = [los(99_900, 7), regel("haalbeurt", 35_000, 1)];
  assert.equal(bedragVanPost(rijen), 35_000);
});

test("een regel zonder naam ingevuld telt wel mee", () => {
  // De gebruiker heeft hem toegevoegd maar nog niet benoemd; het bedrag hoort te tellen.
  const rijen = [regel("", 5_000, 1), regel("poetsen", 12_000, 2)];
  assert.equal(bedragVanPost(rijen), 17_000);
});

// --- heeftRegels ---

test("een lege naam telt als regel, null niet", () => {
  assert.equal(heeftRegels([regel("", 0, 1)]), true);
  assert.equal(heeftRegels([los(1_000)]), false);
  assert.equal(heeftRegels([]), false);
});

// --- opVolgorde ---

test("regels staan op volgorde, en bij gelijke volgorde op id", () => {
  const rijen = [
    regel("c", 300, 3, 1),
    regel("a", 100, 1, 0),
    regel("b", 200, 2, 1),
  ];
  assert.deepEqual(
    opVolgorde(rijen).map((r) => r.naam),
    ["a", "b", "c"],
  );
});

// --- bouwBoom ---

const POSTEN = [
  { id: 1, naam: "Onderhoud", kleur: "#16283F", actief: true, ouderId: null },
  { id: 2, naam: "Motor", kleur: "#2F5C8A", actief: true, ouderId: 1 },
  { id: 3, naam: "Liggeld", kleur: "#C9A662", actief: true, ouderId: null },
];

test("een hoofdpost zonder eigen bedrag doet mee als zijn subpost meedoet", () => {
  const boom = bouwBoom(POSTEN, new Map([[2, [los(40_000, 5)]]]), new Map());
  const onderhoud = boom.find((p) => p.id === 1);
  assert.ok(onderhoud);
  assert.equal(onderhoud.begrootCent, null, "zelf niets begroot");
  assert.equal(onderhoud.inGebruik, true, "maar de subpost wel");
  assert.equal(onderhoud.subposten.length, 1);
});

test("werkelijk telt de subposten mee, eigen niet", () => {
  const boom = bouwBoom(
    POSTEN,
    new Map(),
    new Map([
      [1, 5_000],
      [2, 8_000],
    ]),
  );
  const onderhoud = boom.find((p) => p.id === 1);
  assert.ok(onderhoud);
  assert.equal(onderhoud.eigenCent, 5_000);
  assert.equal(onderhoud.werkelijkCent, 13_000);
});

test("een post waar niets mee is doet niet mee", () => {
  const boom = bouwBoom(POSTEN, new Map(), new Map());
  assert.equal(
    boom.every((p) => p.inGebruik === false),
    true,
  );
});

test("alleen hoofdposten staan in de wortel", () => {
  const boom = bouwBoom(POSTEN, new Map(), new Map());
  assert.deepEqual(
    boom.map((p) => p.naam),
    ["Onderhoud", "Liggeld"],
  );
});

// --- totaalBegroot ---

test("totaalBegroot is null als er nergens iets staat", () => {
  const boom = bouwBoom(POSTEN, new Map(), new Map());
  assert.equal(totaalBegroot(boom[0]), null);
});

test("totaalBegroot telt de post en zijn subposten op", () => {
  const boom = bouwBoom(
    POSTEN,
    new Map([
      [1, [regel("klein spul", 10_000, 1)]],
      [2, [regel("olie", 15_000, 2), regel("filters", 5_000, 3)]],
    ]),
    new Map(),
  );
  assert.equal(totaalBegroot(boom[0]), 30_000);
});

// --- uitgaven per post ---

test("het aantal bonregels komt per post mee, en telt niet op naar de hoofdpost", () => {
  const boom = bouwBoom(
    POSTEN,
    new Map(),
    new Map([[2, 5_000]]),
    new Map([
      [1, 2],
      [2, 3],
    ]),
  );
  const onderhoud = boom.find((p) => p.id === 1);
  assert.ok(onderhoud);
  assert.equal(onderhoud.uitgaven, 2);
  assert.equal(onderhoud.subposten[0].uitgaven, 3);
});

test("zonder telling staat er gewoon nul, geen undefined", () => {
  const boom = bouwBoom(POSTEN, new Map(), new Map());
  assert.equal(boom[0].uitgaven, 0);
});

// --- ontwerpVan: van database naar velden op het scherm ---

function bouw(regels: PostRegel[]) {
  const boom = bouwBoom([POSTEN[0]], new Map([[1, regels]]), new Map());
  return ontwerpVan(boom[0]);
}

test("een los bedrag komt in het snelle veld te staan, met een komma", () => {
  const ontwerp = bouw([los(65_050)]);
  assert.equal(ontwerp.los, "650,50");
  assert.deepEqual(ontwerp.regels, []);
});

test("zijn er regels, dan blijft het snelle veld leeg", () => {
  const ontwerp = bouw([los(65_000), regel("haalbeurt", 35_000, 2)]);
  assert.equal(ontwerp.los, "", "anders zou je twee bedragen zien staan");
  assert.equal(ontwerp.regels.length, 1);
  assert.equal(ontwerp.regels[0].naam, "haalbeurt");
  assert.equal(ontwerp.regels[0].bedrag, "350,00");
});

test("elke regel houdt een eigen sleutel, ook als twee namen gelijk zijn", () => {
  const ontwerp = bouw([regel("poetsen", 100, 7), regel("poetsen", 200, 9)]);
  assert.notEqual(ontwerp.regels[0].sleutel, ontwerp.regels[1].sleutel);
});

// --- begrootVanOntwerp: hetzelfde antwoord als de server, maar tijdens het typen ---

const leeg = {
  naam: "Onderhoud",
  kleur: "#16283F",
  actief: true,
  ouderId: null,
  los: "",
  regels: [],
};

test("een leeg scherm is niet begroot, niet nul", () => {
  assert.equal(begrootVanOntwerp(leeg, parseEuro), null);
});

test("het losse veld telt zoals je het typt", () => {
  assert.equal(
    begrootVanOntwerp({ ...leeg, los: "1250,40" }, parseEuro),
    125_040,
  );
});

test("regels tellen op, en een half getypte regel telt als nul", () => {
  const ontwerp = {
    ...leeg,
    los: "9999",
    regels: [
      { sleutel: "a", naam: "haalbeurt", bedrag: "350" },
      { sleutel: "b", naam: "", bedrag: "" },
      { sleutel: "c", naam: "antifouling", bedrag: "180,50" },
    ],
  };
  // Het losse bedrag doet niet meer mee zodra er regels staan -- dezelfde regel als
  // op de server, zodat het scherm niet iets anders optelt dan wat wordt opgeslagen.
  assert.equal(begrootVanOntwerp(ontwerp, parseEuro), 53_050);
});
