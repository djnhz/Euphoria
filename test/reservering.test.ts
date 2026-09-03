import test from "node:test";
import assert from "node:assert/strict";
import { plandVrijgeven } from "../lib/reservering.ts";

/**
 * Een week van maandag 5 tot en met zondag 11 januari. Dat is de reservering waar
 * al deze proeven dagen uit halen.
 */
const VAN = "2026-01-05";
const TOT = "2026-01-11";

test("een dag uit het midden levert twee losse reserveringen op", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-08"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-05", tot: "2026-01-07" },
    extra: [{ van: "2026-01-09", tot: "2026-01-11" }],
  });
});

test("de zaterdag uit een week halen splitst hem ook", () => {
  // Zaterdag 10 januari; zondag 11 blijft dus apart staan.
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-10"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-05", tot: "2026-01-09" },
    extra: [{ van: "2026-01-11", tot: "2026-01-11" }],
  });
});

test("twee losse dagen uit het midden leveren drie stukken op", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-07", "2026-01-10"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-05", tot: "2026-01-06" },
    extra: [
      { van: "2026-01-08", tot: "2026-01-09" },
      { van: "2026-01-11", tot: "2026-01-11" },
    ],
  });
});

test("de laatste dag weghalen kort alleen in, zonder tweede afspraak", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-11"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-05", tot: "2026-01-10" },
    extra: [],
  });
});

test("de eerste dagen weghalen laat de reservering later beginnen", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-05", "2026-01-06"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-07", tot: "2026-01-11" },
    extra: [],
  });
});

test("twee aangrenzende dagen uit het midden blijven één gat", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-01-08", "2026-01-09"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-05", tot: "2026-01-07" },
    extra: [{ van: "2026-01-10", tot: "2026-01-11" }],
  });
});

test("alle dagen weghalen betekent de reservering verwijderen", () => {
  const alle = [
    "2026-01-05",
    "2026-01-06",
    "2026-01-07",
    "2026-01-08",
    "2026-01-09",
    "2026-01-10",
    "2026-01-11",
  ];
  assert.deepEqual(plandVrijgeven(VAN, TOT, alle), { soort: "verwijderen" });
});

test("niets aanvinken laat de reservering ongemoeid", () => {
  const plan = plandVrijgeven(VAN, TOT, []);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: VAN, tot: TOT },
    extra: [],
  });
});

test("een dag die er niet in zit verandert niets", () => {
  const plan = plandVrijgeven(VAN, TOT, ["2026-02-01"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: VAN, tot: TOT },
    extra: [],
  });
});

test("een reservering van één dag verdwijnt als je die dag weghaalt", () => {
  assert.deepEqual(plandVrijgeven(VAN, VAN, [VAN]), { soort: "verwijderen" });
});

test("splitsen werkt ook over een maandgrens heen", () => {
  const plan = plandVrijgeven("2026-01-29", "2026-02-04", ["2026-02-01"]);
  assert.deepEqual(plan, {
    soort: "inkorten",
    houden: { van: "2026-01-29", tot: "2026-01-31" },
    extra: [{ van: "2026-02-02", tot: "2026-02-04" }],
  });
});
