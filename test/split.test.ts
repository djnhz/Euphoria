import test from "node:test";
import assert from "node:assert/strict";
import { verdeelRegel, saldoCent, parseEuro } from "../lib/geld.ts";

test("50/50 op een oneven bedrag verliest geen cent", () => {
  const { deelA, deelB } = verdeelRegel(1501, 50);
  assert.equal(deelA + deelB, 1501);
  assert.deepEqual([deelA, deelB], [751, 750]);
});

test("0 procent en 100 procent leggen alles bij een huishouden", () => {
  assert.deepEqual(verdeelRegel(999, 0), { deelA: 0, deelB: 999 });
  assert.deepEqual(verdeelRegel(999, 100), { deelA: 999, deelB: 0 });
});

test("percentage buiten bereik wordt vastgeklemd", () => {
  assert.deepEqual(verdeelRegel(1000, 150), { deelA: 1000, deelB: 0 });
  assert.deepEqual(verdeelRegel(1000, -20), { deelA: 0, deelB: 1000 });
});

test("een creditbedrag houdt de som kloppend", () => {
  const { deelA, deelB } = verdeelRegel(-1501, 50);
  assert.equal(deelA + deelB, -1501);
});

test("saldo over gemengde uitgaven van beide huishoudens", () => {
  // A schiet 100,00 voor, half om half -> B is 50,00 schuldig.
  // B schiet 30,00 voor, volledig voor A -> A is 30,00 schuldig.
  // Netto houdt B 20,00 schuld over aan A.
  const saldo = saldoCent([
    { bedragCent: 10000, aandeelAPct: 50, betaaldDoorA: true },
    { bedragCent: 3000, aandeelAPct: 100, betaaldDoorA: false },
  ]);
  assert.equal(saldo, 2000);
});

test("een uitgave die volledig voor de betaler zelf is, verschuift niets", () => {
  assert.equal(
    saldoCent([{ bedragCent: 4567, aandeelAPct: 100, betaaldDoorA: true }]),
    0,
  );
  assert.equal(
    saldoCent([{ bedragCent: 4567, aandeelAPct: 0, betaaldDoorA: false }]),
    0,
  );
});

test("lege administratie geeft saldo nul", () => {
  assert.equal(saldoCent([]), 0);
});

test("parseEuro accepteert komma, punt en rommel eromheen", () => {
  assert.equal(parseEuro("12,34"), 1234);
  assert.equal(parseEuro("12.34"), 1234);
  assert.equal(parseEuro("€ 1200"), 120000);
  assert.equal(parseEuro(""), null);
  assert.equal(parseEuro("abc"), null);
});

// --- verrekeningsoverzicht ---
import { verrekening } from "../lib/geld.ts";

test("voorgeschoten min eigen aandeel is exact het saldo", () => {
  const regels = [
    { bedragCent: 10000, aandeelAPct: 50, betaaldDoorA: true },
    { bedragCent: 3000, aandeelAPct: 100, betaaldDoorA: false },
    { bedragCent: 4567, aandeelAPct: 35, betaaldDoorA: true },
    { bedragCent: 999, aandeelAPct: 0, betaaldDoorA: false },
  ];
  const overzicht = verrekening(regels);
  assert.equal(overzicht.saldo, saldoCent(regels));
});

test("de twee aandelen samen zijn het totaal, zonder zoekgeraakte cent", () => {
  const regels = [
    { bedragCent: 1501, aandeelAPct: 50, betaaldDoorA: true },
    { bedragCent: 333, aandeelAPct: 33, betaaldDoorA: false },
  ];
  const overzicht = verrekening(regels);
  assert.equal(overzicht.aandeelA + overzicht.aandeelB, overzicht.totaal);
  assert.equal(overzicht.voorgeschotenA + overzicht.voorgeschotenB, overzicht.totaal);
});

test("betaalt een huishouden precies zijn eigen aandeel, dan is het saldo nul", () => {
  const overzicht = verrekening([
    { bedragCent: 8000, aandeelAPct: 100, betaaldDoorA: true },
    { bedragCent: 5000, aandeelAPct: 0, betaaldDoorA: false },
  ]);
  assert.equal(overzicht.saldo, 0);
  assert.equal(overzicht.voorgeschotenA, overzicht.aandeelA);
});
