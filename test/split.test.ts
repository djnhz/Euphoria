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

// --- datumstappen voor vaste lasten ---
import { volgendeDatum } from "../lib/datum.ts";

test("maandstap klemt naar het maandeinde in plaats van door te lopen", () => {
  assert.equal(volgendeDatum("2026-01-31", "maand"), "2026-02-28");
  assert.equal(volgendeDatum("2028-01-31", "maand"), "2028-02-29");
  assert.equal(volgendeDatum("2026-03-31", "maand"), "2026-04-30");
});

test("maandstap rolt netjes over het jaar heen", () => {
  assert.equal(volgendeDatum("2026-12-15", "maand"), "2027-01-15");
  assert.equal(volgendeDatum("2026-11-30", "kwartaal"), "2027-02-28");
  assert.equal(volgendeDatum("2028-02-29", "jaar"), "2029-02-28");
});

test("gewone stappen laten de dag staan", () => {
  assert.equal(volgendeDatum("2026-05-10", "maand"), "2026-06-10");
  assert.equal(volgendeDatum("2026-05-10", "kwartaal"), "2026-08-10");
  assert.equal(volgendeDatum("2026-05-10", "jaar"), "2027-05-10");
});
