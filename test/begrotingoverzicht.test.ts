import test from "node:test";
import assert from "node:assert/strict";
import type { BegrotingsPost } from "../lib/begroting.ts";
import { overzichtRegels, overzichtTotalen } from "../lib/begrotingoverzicht.ts";

function post(
  deel: Partial<BegrotingsPost> & Pick<BegrotingsPost, "id" | "naam">,
): BegrotingsPost {
  return {
    kleur: "#123456",
    actief: true,
    ouderId: null,
    regels: [],
    begrootCent: null,
    eigenCent: 0,
    uitgaven: 0,
    werkelijkCent: 0,
    inGebruik: true,
    subposten: [],
    ...deel,
  };
}

test("een hoofdpost telt zijn subposten mee in het begrote bedrag", () => {
  const sub = post({ id: 2, naam: "Kaartplotter", ouderId: 1, begrootCent: 140000 });
  const hoofd = post({ id: 1, naam: "Elektronica", begrootCent: 5000, subposten: [sub] });
  const regels = overzichtRegels([hoofd]);
  assert.equal(regels[0].soort === "post" && regels[0].begrootCent, 145000);
  assert.equal(regels[1].soort === "post" && regels[1].naam, "Kaartplotter");
});

test("posten en subposten die dit jaar niet meedoen staan er niet in", () => {
  const weg = post({ id: 3, naam: "Diepte meter", ouderId: 1, inGebruik: false });
  const blijft = post({ id: 4, naam: "Windmeter", ouderId: 1, begrootCent: 72000 });
  const hoofd = post({ id: 1, naam: "Elektronica", subposten: [weg, blijft] });
  const ongebruikt = post({ id: 5, naam: "Winterstalling", inGebruik: false });
  const namen = overzichtRegels([hoofd, ongebruikt]).map((r) => r.naam);
  assert.deepEqual(namen, ["Elektronica", "Windmeter"]);
});

test("benoemde regels komen als onderbouwing onder hun post, het losse bedrag niet", () => {
  const hoofd = post({
    id: 1,
    naam: "Onderhoud",
    begrootCent: 65000,
    regels: [
      { id: 1, naam: "haalbeurt", bedragCent: 35000, volgorde: 0 },
      { id: 2, naam: "antifouling", bedragCent: 30000, volgorde: 1 },
    ],
  });
  const losBedrag = post({
    id: 2,
    naam: "Liggeld",
    begrootCent: 190000,
    regels: [{ id: 3, naam: null, bedragCent: 190000, volgorde: 0 }],
  });
  const regels = overzichtRegels([hoofd, losBedrag]);
  assert.deepEqual(
    regels.map((r) => `${r.soort}:${r.naam}`),
    ["post:Onderhoud", "onderbouwing:haalbeurt", "onderbouwing:antifouling", "post:Liggeld"],
  );
});

test("de totalen tellen subposten niet dubbel", () => {
  const sub = post({ id: 2, naam: "Zonnepaneel", ouderId: 1, begrootCent: 50000, eigenCent: 34360, werkelijkCent: 34360 });
  const hoofd = post({ id: 1, naam: "Elektronica", begrootCent: 10000, eigenCent: 1000, werkelijkCent: 35360, subposten: [sub] });
  assert.deepEqual(overzichtTotalen([hoofd]), { begrootCent: 60000, besteedCent: 35360 });
});
