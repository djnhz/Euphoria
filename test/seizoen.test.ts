import test from "node:test";
import assert from "node:assert/strict";
import { feestdagenIn, koningsdag, pasen } from "../lib/feestdagen.ts";
import {
  dagenInSeizoen,
  isoWeek,
  maandagVanWeek,
  plusDagen,
  seizoenFout,
} from "../lib/datum.ts";
import {
  dagenVanFeestdag,
  maakSeizoensplanning,
  telling,
} from "../lib/seizoen.ts";

const A = 1; // huishouden met de oneven weken in deze tests
const B = 2;

// --- feestdagen ---

test("paasdata kloppen met de kalender", () => {
  assert.equal(pasen(2026), "2026-04-05");
  assert.equal(pasen(2027), "2027-03-28");
  assert.equal(pasen(2028), "2028-04-16");
});

test("Hemelvaart en Pinksteren volgen uit Pasen", () => {
  const dagen = new Map(feestdagenIn(2027).map((f) => [f.code, f]));
  assert.deepEqual(
    { van: dagen.get("hemelvaart")!.van, tot: dagen.get("hemelvaart")!.tot },
    { van: "2027-05-06", tot: "2027-05-09" },
  );
  assert.deepEqual(
    { van: dagen.get("pinksteren")!.van, tot: dagen.get("pinksteren")!.tot },
    { van: "2027-05-15", tot: "2027-05-17" },
  );
});

test("Pasen loopt van Goede Vrijdag tot en met Tweede Paasdag", () => {
  const paasblok = feestdagenIn(2027).find((f) => f.code === "pasen")!;
  assert.deepEqual(
    { van: paasblok.van, tot: paasblok.tot },
    { van: "2027-03-26", tot: "2027-03-29" },
  );
});

test("Koningsdag schuift een dag terug als 27 april op zondag valt", () => {
  // 27 april 2025 is een zondag.
  assert.equal(koningsdag(2025), "2025-04-26");
  assert.equal(koningsdag(2027), "2027-04-27");
});

// --- ISO-weken ---

test("ISO-weeknummers kloppen ook rond de jaarwisseling", () => {
  assert.equal(isoWeek("2027-05-06"), 18);
  assert.equal(isoWeek("2027-05-16"), 19);
  assert.equal(isoWeek("2027-05-17"), 20);
  // 1 januari 2027 is een vrijdag en hoort nog bij week 53 van 2026.
  assert.equal(isoWeek("2027-01-01"), 53);
  assert.equal(isoWeek("2027-01-04"), 1);
});

test("maandagVanWeek geeft de maandag, ook als het al maandag is", () => {
  assert.equal(maandagVanWeek("2027-05-16"), "2027-05-10");
  assert.equal(maandagVanWeek("2027-05-10"), "2027-05-10");
});

test("het seizoen bestaat uit hele weken en blijft binnen maart tot en met oktober", () => {
  for (const jaar of [2026, 2027, 2028]) {
    const dagen = dagenInSeizoen(jaar);
    assert.equal(dagen.length % 7, 0, `${jaar} moet uit hele weken bestaan`);
    assert.ok(dagen[0] >= `${jaar}-03-01`, "begint niet voor 1 maart");
    assert.ok(dagen.at(-1)! <= `${jaar}-10-31`, "eindigt niet na 31 oktober");
    // Begint op een maandag en eindigt op een zondag.
    assert.equal(new Date(`${dagen[0]}T00:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${dagen.at(-1)}T00:00:00Z`).getUTCDay(), 0);
    // En zo vroeg en zo laat mogelijk: een week ervoor of erna valt buiten het seizoen.
    assert.ok(plusDagen(dagen[0], -7) < `${jaar}-03-01`);
    assert.ok(plusDagen(dagen.at(-1)!, 7) > `${jaar}-10-31`);
  }
});

// --- toewijzing ---

test("een feestdag pakt zijn eigen week plus de maandag erna, en niet meer", () => {
  // Pinksteren 2027: za 15 t/m ma 17 mei. Week 19 loopt van 10 t/m 16 mei.
  const dagen = dagenVanFeestdag("2027-05-15", "2027-05-17");
  assert.equal(dagen[0], "2027-05-10");
  assert.equal(dagen.at(-1), "2027-05-17");
  assert.ok(!dagen.includes("2027-05-18"), "de dinsdag hoort er niet bij");
});

test("Hemelvaart blijft binnen één week", () => {
  const dagen = dagenVanFeestdag("2027-05-06", "2027-05-09");
  assert.equal(dagen[0], "2027-05-03");
  assert.equal(dagen.at(-1), "2027-05-09");
  assert.equal(dagen.length, 7);
});

function eigenaarOp(datum: string, planning: ReturnType<typeof maakSeizoensplanning>) {
  const blok = planning.blokken.find((b) => b.van <= datum && b.tot >= datum);
  return blok ? { coupleId: blok.coupleId, reden: blok.reden } : null;
}

test("zonder feestdagen volgen alle weken de even-onevenregel", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: {},
  });
  // 6 mei 2027 valt in week 18 (even), 13 mei in week 19 (oneven).
  assert.deepEqual(eigenaarOp("2027-05-06", planning), {
    coupleId: B,
    reden: "even",
  });
  assert.deepEqual(eigenaarOp("2027-05-13", planning), {
    coupleId: A,
    reden: "oneven",
  });
});

test("Pinksteren aan A geeft A de maandag, maar dinsdag valt terug op B", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { pinksteren: A },
  });
  // Pinksterzondag 16 mei sluit week 19 af; die week is oneven en dus al van A.
  assert.deepEqual(eigenaarOp("2027-05-16", planning), {
    coupleId: A,
    reden: "feestdag",
  });
  // Maandag 17 mei begint week 20 (even, dus normaal B) maar hoort bij het pinksterblok.
  assert.deepEqual(eigenaarOp("2027-05-17", planning), {
    coupleId: A,
    reden: "feestdag",
  });
  // Dinsdag 18 mei valt terug op de eigenaar van week 20. Dit is de kern van de regel.
  assert.deepEqual(eigenaarOp("2027-05-18", planning), {
    coupleId: B,
    reden: "even",
  });
});

test("een feestdag overruled de even-onevenregel voor zijn hele week", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { hemelvaart: A },
  });
  // Hemelvaart 2027 valt in week 18; die is even en zou dus van B zijn.
  assert.deepEqual(eigenaarOp("2027-05-03", planning), {
    coupleId: A,
    reden: "feestdag",
  });
  assert.deepEqual(eigenaarOp("2027-05-09", planning), {
    coupleId: A,
    reden: "feestdag",
  });
  // De week erna is oneven en volgt gewoon weer de basisregel.
  assert.deepEqual(eigenaarOp("2027-05-10", planning), {
    coupleId: A,
    reden: "oneven",
  });
});

test("een handmatige wissel wint van alles", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { hemelvaart: B },
    vakanties: [{ van: "2027-05-03", tot: "2027-05-10", coupleId: A }],
  });
  assert.deepEqual(eigenaarOp("2027-05-05", planning), {
    coupleId: A,
    reden: "handmatig",
  });
});

test("botsende feestdagen worden op datumvolgorde opgelost en gemeld", () => {
  // 2038: Pasen 25 april, Tweede Paasdag 26 april, Koningsdag 27 april.
  const paasblok = feestdagenIn(2038).find((f) => f.code === "pasen")!;
  assert.equal(paasblok.tot, "2038-04-26");

  const planning = maakSeizoensplanning({
    jaar: 2038,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { pasen: A, koningsdag: B },
  });
  // Koningsdag is later en wint de gedeelde dagen.
  assert.equal(eigenaarOp("2038-04-27", planning)?.coupleId, B);
  assert.ok(
    planning.botsingen.some(
      (b) => b.verliezer === "pasen" && b.winnaar === "koningsdag",
    ),
    "de botsing hoort gemeld te worden",
  );
});

// --- telling ---

test("de telling dekt precies alle dagen van het seizoen", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { pasen: A, hemelvaart: B, pinksteren: B, koningsdag: A },
  });
  const uitkomst = telling(planning, [A, B]);
  const totaal = uitkomst.reduce((som, r) => som + r.dagen, 0);
  assert.equal(totaal, dagenInSeizoen(2027).length);
  assert.equal(
    uitkomst.reduce((som, r) => som + r.blokken, 0),
    planning.blokken.length,
  );
});

test("blokken sluiten op elkaar aan zonder gat of overlap", () => {
  const planning = maakSeizoensplanning({
    jaar: 2026,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { pasen: B, pinksteren: A },
  });
  const dagen = dagenInSeizoen(2026);
  assert.equal(planning.blokken[0].van, dagen[0]);
  assert.equal(planning.blokken.at(-1)!.tot, dagen.at(-1));
  for (let i = 1; i < planning.blokken.length; i++) {
    const vorige = planning.blokken[i - 1];
    const huidige = planning.blokken[i];
    const dagNaVorige = dagen[dagen.indexOf(vorige.tot) + 1];
    assert.equal(huidige.van, dagNaVorige, "geen gat tussen blokken");
  }
});

// --- schoolvakanties en bouwvak, regio midden ---
import {
  bouwvakIn,
  reserveVakanties,
  vakantiesRakend,
  werkdagen,
  werkdagOverlap,
} from "../lib/schoolvakanties.ts";

test("het vangnet klopt met de gepubliceerde data", () => {
  const zomer2027 = reserveVakanties(2027).find(
    (v) => v.naam === "Zomervakantie",
  )!;
  assert.deepEqual(
    { van: zomer2027.van, tot: zomer2027.tot },
    { van: "2027-07-17", tot: "2027-08-29" },
  );
});

test("vakantieperiodes lopen niet achteruit en horen bij hun jaar", () => {
  for (const jaar of [2026, 2027, 2028]) {
    for (const vakantie of reserveVakanties(jaar)) {
      assert.ok(vakantie.van <= vakantie.tot, `${vakantie.naam} loopt achteruit`);
      assert.ok(vakantie.tot.startsWith(String(jaar)));
    }
  }
});

test("de bouwvak valt binnen de zomervakantie van dezelfde regio", () => {
  for (const jaar of [2026, 2027]) {
    const bouwvak = bouwvakIn(jaar)!;
    const zomer = reserveVakanties(jaar).find((v) => v.naam === "Zomervakantie")!;
    assert.ok(bouwvak.van >= zomer.van && bouwvak.tot <= zomer.tot);
  }
});

test("een jaar zonder bouwvakgegevens geeft niets terug in plaats van een gok", () => {
  assert.equal(bouwvakIn(2028), null);
});

test("een week in de bouwvak raakt zowel de bouwvak als de zomervakantie", () => {
  const lijst = [...reserveVakanties(2027), bouwvakIn(2027)!];
  const raakt = vakantiesRakend(lijst, "2027-08-09", "2027-08-15");
  assert.deepEqual(
    raakt.map((v) => v.naam),
    ["Bouwvak", "Zomervakantie"],
    "bouwvak hoort vooraan te staan",
  );
});

test("een week buiten elke vakantie raakt niets", () => {
  assert.deepEqual(vakantiesRakend(reserveVakanties(2027), "2027-06-07", "2027-06-13"), []);
});

test("werkdagen tellen alleen maandag tot en met vrijdag", () => {
  assert.equal(werkdagen("2027-10-11", "2027-10-17"), 5);
  assert.equal(werkdagen("2027-10-16", "2027-10-17"), 0);
});

test("de herfstvakantie vult alleen week 42, niet de week ervoor", () => {
  // Herfstvakantie midden 2027: za 16 t/m zo 24 oktober.
  const herfst = reserveVakanties(2027).find((v) => v.naam === "Herfstvakantie")!;
  // Week 41 loopt van 11 t/m 17 oktober: alleen het weekend valt in de vakantie,
  // en dus geen enkele werkdag.
  assert.equal(werkdagOverlap(herfst, "2027-10-11", "2027-10-17"), 0);
  // Week 42 loopt van 18 t/m 24 oktober: alle vijf de werkdagen zitten erin.
  assert.equal(werkdagOverlap(herfst, "2027-10-18", "2027-10-24"), 5);
  assert.equal(werkdagOverlap(herfst, "2027-10-25", "2027-10-31"), 0);
});

test("de zomervakantie begint pas te tellen in de week met vrije werkdagen", () => {
  // Zomervakantie midden 2027 begint op zaterdag 17 juli.
  const zomer = reserveVakanties(2027).find((v) => v.naam === "Zomervakantie")!;
  assert.equal(werkdagOverlap(zomer, "2027-07-12", "2027-07-18"), 0);
  assert.equal(werkdagOverlap(zomer, "2027-07-19", "2027-07-25"), 5);
  // En houdt op na 29 augustus.
  assert.equal(werkdagOverlap(zomer, "2027-08-23", "2027-08-29"), 5);
  assert.equal(werkdagOverlap(zomer, "2027-08-30", "2027-09-05"), 0);
});

test("een vakantie van zaterdag tot zaterdag is zeven nachten; de wisseldag is van de volgende", () => {
  // Za 17 juli 12:00 tot za 7 augustus 12:00, dwars door even en oneven heen.
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: {},
    vakanties: [{ van: "2027-07-17", tot: "2027-08-07", coupleId: B, naam: "Zomer" }],
  });
  const eigen = planning.blokken.filter((b) => b.naam === "Zomer");
  // Eén vakantie is één blok, ook over drie weken: zo komt hij ook als één afspraak
  // in de agenda.
  assert.deepEqual(
    eigen.map((b) => [b.van, b.tot, b.aantalDagen, b.coupleId]),
    [["2027-07-17", "2027-08-06", 21, B]],
  );
  // De vrijdag ervoor en de wisselzaterdag zelf volgen weer het patroon.
  assert.notEqual(eigenaarOp("2027-07-16", planning)?.reden, "handmatig");
  assert.notEqual(eigenaarOp("2027-08-07", planning)?.reden, "handmatig");
});

test("de ander kan op de wisselzaterdag meteen zijn eigen vakantie beginnen", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: {},
    vakanties: [
      { van: "2027-07-17", tot: "2027-07-31", coupleId: A, naam: "Zomer A" },
      { van: "2027-07-31", tot: "2027-08-14", coupleId: B, naam: "Zomer B" },
    ],
  });
  const vakantieblokken = planning.blokken.filter((b) => b.reden === "handmatig");
  assert.deepEqual(
    vakantieblokken.map((b) => [b.van, b.tot, b.coupleId, b.aantalDagen]),
    [
      ["2027-07-17", "2027-07-30", A, 14],
      ["2027-07-31", "2027-08-13", B, 14],
    ],
  );
});

test("twee aansluitende vakanties van hetzelfde huishouden blijven aparte blokken", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: {},
    vakanties: [
      { van: "2027-05-08", tot: "2027-05-15", coupleId: A, naam: "Meiweek" },
      { van: "2027-05-15", tot: "2027-05-22", coupleId: A, naam: "Meiweek" },
    ],
  });
  const eigen = planning.blokken.filter((b) => b.reden === "handmatig");
  assert.equal(eigen.length, 2);
});

test("een ingeplande vakantie wint ook van een toegewezen feestdag", () => {
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: { hemelvaart: A },
    vakanties: [{ van: "2027-05-03", tot: "2027-05-10", coupleId: B, naam: "Werkweek" }],
  });
  assert.deepEqual(eigenaarOp("2027-05-05", planning), {
    coupleId: B,
    reden: "handmatig",
  });
});

// --- feestdagen in het weekoverzicht ---
import { feestdagenRakend } from "../lib/feestdagen.ts";

test("een week toont de feestdag die erin valt, ook een halve", () => {
  const feestdagen = feestdagenIn(2027);
  // Hemelvaart 2027 is do 6 t/m zo 9 mei; die week loopt van maandag 3 mei.
  const inWeek = feestdagenRakend(feestdagen, "2027-05-03", "2027-05-09");
  assert.deepEqual(
    inWeek.map((f) => f.code),
    ["hemelvaart"],
  );

  // Het paasblok loopt door tot en met maandag; die maandag hoort er ook bij.
  const pasen = feestdagen.find((f) => f.code === "pasen")!;
  assert.equal(feestdagenRakend(feestdagen, pasen.tot, pasen.tot).length, 1);

  // Een week ver van elke feestdag levert niets op.
  assert.deepEqual(feestdagenRakend(feestdagen, "2027-08-02", "2027-08-08"), []);
});

// --- Eigen begin en einde van het seizoen ------------------------------------------

test("zonder grenzen blijft het seizoen maart tot en met oktober", () => {
  assert.deepEqual(
    dagenInSeizoen(2027),
    dagenInSeizoen(2027, { start: "2027-03-01", eind: "2027-10-31" }),
  );
});

test("een eigen seizoen loopt in hele weken binnen de gekozen datums", () => {
  // 1 april 2027 is een donderdag, 30 september een donderdag.
  const dagen = dagenInSeizoen(2027, { start: "2027-04-01", eind: "2027-09-30" });
  assert.equal(dagen[0], "2027-04-05"); // eerste maandag op of na het begin
  assert.equal(dagen.at(-1), "2027-09-26"); // laatste zondag op of voor het einde
  assert.equal(dagen.length % 7, 0);
});

test("een planning met eigen grenzen verdeelt precies die dagen", () => {
  const grenzen = { start: "2027-05-01", eind: "2027-08-31" };
  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: 1,
    evenCoupleId: 2,
    feestdagToewijzing: {},
    grenzen,
  });
  const totaal = planning.blokken.reduce((som, b) => som + b.aantalDagen, 0);
  assert.equal(totaal, dagenInSeizoen(2027, grenzen).length);
  assert.ok(planning.blokken.every((b) => b.van >= "2027-05-01" && b.tot <= "2027-08-31"));
});

test("seizoenFout keurt een onbruikbaar seizoen af en een goed seizoen goed", () => {
  assert.equal(seizoenFout(2027, { start: "2027-04-01", eind: "2027-10-15" }), null);
  assert.match(seizoenFout(2027, { start: "2027-10-01", eind: "2027-04-01" }) ?? "", /na het begin/);
  assert.match(seizoenFout(2027, { start: "2026-04-01", eind: "2027-10-01" }) ?? "", /2027/);
  // Woensdag tot en met zondag: geen hele week.
  assert.match(seizoenFout(2027, { start: "2027-06-02", eind: "2027-06-06" }) ?? "", /hele week/);
  assert.match(seizoenFout(2027, { start: "", eind: "2027-06-06" }) ?? "", /Vul/);
});

// --- bewaarde plannen ---
import { leesPlan } from "../lib/seizoenplan.ts";

test("een plan met hele weken van vroeger wordt een vakantie met exacte datums", () => {
  const plan = leesPlan(
    JSON.stringify({
      onevenCoupleId: A,
      feestdagen: {},
      periodes: [
        {
          id: "oud",
          vanMaandag: "2027-07-19",
          totMaandag: "2027-08-02",
          coupleId: B,
          naam: "Zomerweken",
        },
      ],
    }),
  );
  // Maandag 19 juli tot en met de week van 2 augustus: tot de maandag erna.
  assert.deepEqual(plan?.periodes, [
    {
      id: "oud",
      van: "2027-07-19",
      tot: "2027-08-09",
      coupleId: B,
      naam: "Zomerweken",
      tijden: null,
    },
  ]);
});

test("periodes met datums maar zonder tijden: zaterdag tot zaterdag krijgt 12:00, de rest hele dagen", () => {
  const plan = leesPlan(
    JSON.stringify({
      onevenCoupleId: A,
      feestdagen: {},
      periodes: [
        { id: "vakantie", van: "2027-07-17", tot: "2027-07-24", coupleId: B, naam: "" },
        { id: "omgezet", van: "2027-05-03", tot: "2027-05-10", coupleId: A, naam: "" },
      ],
    }),
  );
  assert.deepEqual(
    plan?.periodes.map((p) => [p.id, p.tijden]),
    [
      ["vakantie", { van: "12:00", tot: "12:00" }],
      ["omgezet", null],
    ],
  );
});

test("eigen wisseltijden blijven bewaard en komen in het blok terecht", () => {
  const plan = leesPlan(
    JSON.stringify({
      onevenCoupleId: A,
      feestdagen: {},
      periodes: [
        {
          id: "v",
          van: "2027-07-17",
          tot: "2027-07-24",
          coupleId: B,
          naam: "Zomer",
          tijden: { van: "10:00", tot: "16:30" },
        },
      ],
    }),
  );
  assert.deepEqual(plan?.periodes[0].tijden, { van: "10:00", tot: "16:30" });

  const planning = maakSeizoensplanning({
    jaar: 2027,
    onevenCoupleId: A,
    evenCoupleId: B,
    feestdagToewijzing: {},
    vakanties: plan!.periodes,
  });
  const blok = planning.blokken.find((b) => b.naam === "Zomer");
  assert.deepEqual(blok?.tijden, { van: "10:00", tot: "16:30" });
  // Gewone weken hebben geen wisseltijd.
  assert.ok(planning.blokken.filter((b) => b.reden !== "handmatig").every((b) => b.tijden === null));
});

test("een ongeldige tijd wordt niet bewaard", () => {
  const plan = leesPlan(
    JSON.stringify({
      onevenCoupleId: A,
      feestdagen: {},
      periodes: [
        {
          id: "v",
          van: "2027-07-17",
          tot: "2027-07-24",
          coupleId: B,
          naam: "",
          tijden: { van: "25:00", tot: "12:00" },
        },
      ],
    }),
  );
  assert.equal(plan, null);
});

test("een vakantie waarvan de wisseldag niet na het begin ligt wordt niet bewaard", () => {
  const plan = leesPlan(
    JSON.stringify({
      onevenCoupleId: A,
      feestdagen: {},
      periodes: [{ id: "x", van: "2027-07-17", tot: "2027-07-17", coupleId: B, naam: "" }],
    }),
  );
  assert.equal(plan, null);
});
