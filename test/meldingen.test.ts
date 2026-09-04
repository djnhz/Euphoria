import test from "node:test";
import assert from "node:assert/strict";
import {
  keuzesVoor,
  magOntvangen,
  MELDING_LABELS,
  MELDING_SOORTEN,
} from "../lib/meldingregels.ts";

const beheerder = { beheerder: true };
const gewoon = { beheerder: false };

test("de beheerder krijgt alle drie de soorten voorgelegd", () => {
  assert.deepEqual(keuzesVoor(beheerder), ["bon", "taak", "vrijgave"]);
});

test("een gewone gebruiker krijgt alleen vrijgegeven dagen", () => {
  assert.deepEqual(keuzesVoor(gewoon), ["vrijgave"]);
});

test("een bon en een taak zijn niet voor een gewone gebruiker", () => {
  assert.equal(magOntvangen("bon", gewoon), false);
  assert.equal(magOntvangen("taak", gewoon), false);
});

test("vrijgegeven dagen zijn voor iedereen", () => {
  assert.equal(magOntvangen("vrijgave", gewoon), true);
  assert.equal(magOntvangen("vrijgave", beheerder), true);
});

test("de beheerder mag elk soort", () => {
  for (const soort of MELDING_SOORTEN) {
    assert.equal(magOntvangen(soort, beheerder), true, soort);
  }
});

test("elk soort heeft een naam en een uitleg voor het scherm", () => {
  for (const soort of MELDING_SOORTEN) {
    assert.ok(MELDING_LABELS[soort].titel.length > 0, soort);
    assert.ok(MELDING_LABELS[soort].uitleg.length > 0, soort);
  }
});
