import { dagenInSeizoen, isoWeek, maandagVanWeek, plusDagen } from "./datum";
import { feestdagenIn, type FeestdagCode } from "./feestdagen";

/**
 * De seizoensplanning wordt per dag uitgerekend en daarna samengevoegd tot blokken.
 * Dat moet, want een lang weekend loopt tot en met de maandag en snijdt de week erna
 * dus doormidden: die maandag hoort bij het feestdaggezin, de rest van die week valt
 * terug op de even-onevenregel.
 */

export type Reden = "oneven" | "even" | "feestdag" | "handmatig";

export type Blok = {
  /** Eerste dag, ISO. */
  van: string;
  /** Laatste dag, inclusief. */
  tot: string;
  coupleId: number;
  reden: Reden;
  /** Gevuld als dit blok uit een feestdag voortkomt. */
  feestdag: FeestdagCode | null;
  aantalDagen: number;
};

export type Invoer = {
  jaar: number;
  /** Huishouden dat de oneven ISO-weken krijgt. */
  onevenCoupleId: number;
  /** Huishouden dat de even ISO-weken krijgt. */
  evenCoupleId: number;
  /** Per feestdag welk huishouden hem krijgt. Ontbreekt een feestdag, dan geldt de gewone regel. */
  feestdagToewijzing: Partial<Record<FeestdagCode, number>>;
  /** Handmatige wissels, per maandag van de betrokken week. */
  overrides?: Record<string, number>;
};

export type Botsing = {
  /** De feestdag die het onderspit delft. */
  verliezer: FeestdagCode;
  winnaar: FeestdagCode;
  dagen: string[];
};

export type Planning = {
  blokken: Blok[];
  botsingen: Botsing[];
};

type DagEigenaar = {
  coupleId: number;
  reden: Reden;
  feestdag: FeestdagCode | null;
};

/**
 * Welke dagen een feestdag opeist: de hele ISO-week waarin het blok begint, plus de
 * dagen waarmee het blok in de week erna doorloopt.
 */
export function dagenVanFeestdag(van: string, tot: string): string[] {
  const dagen: string[] = [];
  let dag = maandagVanWeek(van);
  const eindeEersteWeek = plusDagen(dag, 6);
  const laatste = tot > eindeEersteWeek ? tot : eindeEersteWeek;
  while (dag <= laatste) {
    dagen.push(dag);
    dag = plusDagen(dag, 1);
  }
  return dagen;
}

export function maakSeizoensplanning(invoer: Invoer): Planning {
  const dagen = dagenInSeizoen(invoer.jaar);
  const inSeizoen = new Set(dagen);

  // 1. Basisregel: elke dag hoort bij de eigenaar van zijn ISO-week.
  const eigenaars = new Map<string, DagEigenaar>();
  for (const dag of dagen) {
    const oneven = isoWeek(dag) % 2 === 1;
    eigenaars.set(dag, {
      coupleId: oneven ? invoer.onevenCoupleId : invoer.evenCoupleId,
      reden: oneven ? "oneven" : "even",
      feestdag: null,
    });
  }

  // 2. Feestdagen overschrijven, op datumvolgorde: de latere wint bij overlap.
  const botsingen: Botsing[] = [];
  for (const feestdag of feestdagenIn(invoer.jaar)) {
    const coupleId = invoer.feestdagToewijzing[feestdag.code];
    if (coupleId === undefined) continue;

    const geraakt: string[] = [];
    const verdrongen = new Map<FeestdagCode, string[]>();
    for (const dag of dagenVanFeestdag(feestdag.van, feestdag.tot)) {
      if (!inSeizoen.has(dag)) continue;
      const vorige = eigenaars.get(dag);
      if (vorige?.feestdag && vorige.feestdag !== feestdag.code) {
        verdrongen.set(vorige.feestdag, [
          ...(verdrongen.get(vorige.feestdag) ?? []),
          dag,
        ]);
      }
      eigenaars.set(dag, {
        coupleId,
        reden: "feestdag",
        feestdag: feestdag.code,
      });
      geraakt.push(dag);
    }
    for (const [verliezer, dagenVanVerliezer] of verdrongen) {
      botsingen.push({
        verliezer,
        winnaar: feestdag.code,
        dagen: dagenVanVerliezer,
      });
    }
  }

  // 3. Handmatige wissels: per week, aangeduid met de maandag van die week.
  for (const [maandag, coupleId] of Object.entries(invoer.overrides ?? {})) {
    for (let i = 0; i < 7; i++) {
      const dag = plusDagen(maandag, i);
      if (!inSeizoen.has(dag)) continue;
      eigenaars.set(dag, { coupleId, reden: "handmatig", feestdag: null });
    }
  }

  // 4. Aaneengesloten dagen met dezelfde eigenaar samenvoegen tot blokken.
  const blokken: Blok[] = [];
  for (const dag of dagen) {
    const eigenaar = eigenaars.get(dag)!;
    const laatste = blokken.at(-1);
    if (
      laatste &&
      laatste.coupleId === eigenaar.coupleId &&
      laatste.reden === eigenaar.reden &&
      laatste.feestdag === eigenaar.feestdag &&
      plusDagen(laatste.tot, 1) === dag
    ) {
      laatste.tot = dag;
      laatste.aantalDagen++;
      continue;
    }
    blokken.push({
      van: dag,
      tot: dag,
      coupleId: eigenaar.coupleId,
      reden: eigenaar.reden,
      feestdag: eigenaar.feestdag,
      aantalDagen: 1,
    });
  }

  return { blokken, botsingen };
}

export type Telling = {
  coupleId: number;
  /** Hoe vaak dit huishouden aan de beurt is. */
  blokken: number;
  dagen: number;
}[];

export function telling(planning: Planning, coupleIds: number[]): Telling {
  return coupleIds.map((coupleId) => {
    const eigen = planning.blokken.filter((b) => b.coupleId === coupleId);
    return {
      coupleId,
      blokken: eigen.length,
      dagen: eigen.reduce((som, b) => som + b.aantalDagen, 0),
    };
  });
}
