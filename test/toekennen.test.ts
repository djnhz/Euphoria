import test from "node:test";
import assert from "node:assert/strict";
import { toegekenden } from "../lib/toekennen.ts";

const MENSEN = [
  { id: 1, coupleId: 10 },
  { id: 2, coupleId: 10 },
  { id: 3, coupleId: 20 },
  { id: 4, coupleId: 20 },
];

const leeg = { helpers: [], userId: null, coupleId: null };

test("een taak zonder toewijzing vinkt niemand aan", () => {
  assert.deepEqual(toegekenden(leeg, MENSEN), []);
});

test("toegekende personen worden aangevinkt", () => {
  const taak = { ...leeg, helpers: [{ userId: 2 }, { userId: 3 }] };
  assert.deepEqual(toegekenden(taak, MENSEN).sort(), [2, 3]);
});

test("een eigenaar uit de tijd van de losse keuzes blijft aangevinkt", () => {
  const taak = { ...leeg, userId: 4 };
  assert.deepEqual(toegekenden(taak, MENSEN), [4]);
});

test("een eigenaar die ook is toegekend telt maar een keer", () => {
  const taak = { ...leeg, userId: 2, helpers: [{ userId: 2 }] };
  assert.deepEqual(toegekenden(taak, MENSEN), [2]);
});

test("een taak voor een huishouden vinkt beide leden aan", () => {
  const taak = { ...leeg, coupleId: 20 };
  assert.deepEqual(toegekenden(taak, MENSEN).sort(), [3, 4]);
});

test("een huishouden telt niet mee zodra er personen bij staan", () => {
  // Dan zijn de personen de toewijzing; het huishouden erbij zou er twee leden
  // bij verzinnen die niemand heeft gekozen.
  const taak = { ...leeg, coupleId: 20, helpers: [{ userId: 1 }] };
  assert.deepEqual(toegekenden(taak, MENSEN), [1]);
});

test("een huishouden zonder leden in de lijst vinkt niemand aan", () => {
  const taak = { ...leeg, coupleId: 99 };
  assert.deepEqual(toegekenden(taak, MENSEN), []);
});
