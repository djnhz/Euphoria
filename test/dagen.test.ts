import test from "node:test";
import assert from "node:assert/strict";
import { aaneengeslotenBlokken, dagenTotEnMet } from "../lib/datum.ts";

/**
 * Hier zit het rekenwerk achter "geef deze dagen vrij". Een reservering is in
 * Google Agenda één afspraak; haal je er een dag middenuit, dan moeten het er twee
 * worden. Dat is precies het soort som dat er goed uitziet en toch een dag misloopt.
 */

test("dagenTotEnMet levert de eerste en de laatste dag mee", () => {
  assert.deepEqual(dagenTotEnMet("2026-09-07", "2026-09-09"), [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
  ]);
});

test("één dag levert precies die dag op", () => {
  assert.deepEqual(dagenTotEnMet("2026-09-07", "2026-09-07"), ["2026-09-07"]);
});

test("dagenTotEnMet loopt over een maandgrens heen", () => {
  assert.deepEqual(dagenTotEnMet("2026-08-30", "2026-09-01"), [
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
  ]);
});

test("een reeks aaneengesloten dagen wordt één blok", () => {
  const dagen = dagenTotEnMet("2026-09-07", "2026-09-13");
  assert.deepEqual(aaneengeslotenBlokken(dagen), [
    { van: "2026-09-07", tot: "2026-09-13" },
  ]);
});

test("een dag uit het midden vrijgeven splitst de reservering in tweeën", () => {
  const over = dagenTotEnMet("2026-09-07", "2026-09-13").filter(
    (dag) => dag !== "2026-09-10",
  );
  assert.deepEqual(aaneengeslotenBlokken(over), [
    { van: "2026-09-07", tot: "2026-09-09" },
    { van: "2026-09-11", tot: "2026-09-13" },
  ]);
});

test("de eerste dagen vrijgeven laat de reservering later beginnen", () => {
  const over = dagenTotEnMet("2026-09-07", "2026-09-13").filter(
    (dag) => dag > "2026-09-08",
  );
  assert.deepEqual(aaneengeslotenBlokken(over), [
    { van: "2026-09-09", tot: "2026-09-13" },
  ]);
});

test("alles vrijgeven laat niets over", () => {
  assert.deepEqual(aaneengeslotenBlokken([]), []);
});

test("blokken over een jaargrens blijven aaneengesloten", () => {
  const dagen = dagenTotEnMet("2026-12-30", "2027-01-02");
  assert.deepEqual(aaneengeslotenBlokken(dagen), [
    { van: "2026-12-30", tot: "2027-01-02" },
  ]);
});

test("dubbele en ongesorteerde dagen leveren hetzelfde blok op", () => {
  assert.deepEqual(
    aaneengeslotenBlokken([
      "2026-09-09",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
    ]),
    [{ van: "2026-09-07", tot: "2026-09-09" }],
  );
});
