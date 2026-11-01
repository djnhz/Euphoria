import { test } from "node:test";
import assert from "node:assert/strict";
import {
  opgedeeld,
  perHoofdpost,
  type BonMetDelen,
  type Deel,
} from "../lib/kostenverdeling";

const interieur = (cent: number): Deel => ({
  postNaam: "Interieur",
  postKleur: "#667",
  hoofdpostNaam: "Interieur",
  hoofdpostKleur: "#667",
  cent,
});
const exterieur = (cent: number): Deel => ({
  postNaam: "Exterieur",
  postKleur: "#f60",
  hoofdpostNaam: "Exterieur",
  hoofdpostKleur: "#f60",
  cent,
});

function bon(delen: Deel[]): BonMetDelen {
  const totaalCent = delen.reduce((som, d) => som + d.cent, 0);
  const grootste = [...delen].sort((a, b) => b.cent - a.cent)[0];
  return {
    totaalCent,
    post: grootste?.postNaam ?? "Zonder post",
    postKleur: grootste?.postKleur ?? "#000",
    hoofdpost: grootste?.hoofdpostNaam ?? "Zonder post",
    hoofdpostKleur: grootste?.hoofdpostKleur ?? "#000",
    delen,
  };
}

test("een gemengde bon staat in elke groep met alleen zijn eigen deel", () => {
  // De bon van L.J. van der Winden: 138,00 Interieur en 25,90 Exterieur.
  const rijen = opgedeeld(bon([interieur(13800), exterieur(2590)]), "hoofdpost");
  assert.equal(rijen.length, 2);
  assert.deepEqual(
    rijen.map((r) => [r.hoofdpost, r.totaalCent]),
    [
      ["Interieur", 13800],
      ["Exterieur", 2590],
    ],
  );
});

test("de delen van een opgedeelde bon tellen op tot de hele bon", () => {
  const origineel = bon([interieur(13800), exterieur(2590)]);
  const som = opgedeeld(origineel, "post").reduce((s, r) => s + r.totaalCent, 0);
  assert.equal(som, origineel.totaalCent);
});

test("een bon met een post blijft een rij met zijn volle bedrag", () => {
  const rijen = opgedeeld(bon([exterieur(9623)]), "hoofdpost");
  assert.equal(rijen.length, 1);
  assert.equal(rijen[0].totaalCent, 9623);
});

test("een bon zonder regels blijft een rij", () => {
  const leeg = bon([]);
  assert.deepEqual(opgedeeld(leeg, "post"), [leeg]);
});

test("subposten onder een hoofdpost worden bij hoofdpost samengenomen, bij post apart", () => {
  const sub = (cent: number): Deel => ({
    postNaam: "Bestickering",
    postKleur: "#f60",
    hoofdpostNaam: "Exterieur",
    hoofdpostKleur: "#f60",
    cent,
  });
  const origineel = bon([exterieur(1000), sub(500)]);
  assert.equal(opgedeeld(origineel, "hoofdpost").length, 1);
  assert.equal(opgedeeld(origineel, "hoofdpost")[0].totaalCent, 1500);
  assert.equal(opgedeeld(origineel, "post").length, 2);
});

test("de grafiek telt per hoofdpost uit de regels, niet uit de grootste regel van een bon", () => {
  // Per bon gerekend zou de bon van 163,90 helemaal Interieur zijn: Exterieur 28,50
  // te weinig, en dat is precies het verschil dat de begroting liet zien.
  const rijen = [
    bon([interieur(13800), exterieur(2590)]),
    bon([interieur(490), exterieur(260)]),
    bon([exterieur(9623)]),
    bon([exterieur(2856)]),
  ];
  const uitkomst = perHoofdpost(rijen);
  assert.deepEqual(
    uitkomst.map((u) => [u.naam, u.cent]),
    [
      ["Interieur", 14290],
      ["Exterieur", 15329],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)),
  );
});
