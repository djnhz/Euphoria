import {
  dagenInSeizoen,
  isoWeek,
  maandagVanWeek,
  plusDagen,
  type SeizoenGrenzen,
} from "./datum";
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
  /** Naam van de ingeplande vakantie, als die is meegegeven. */
  naam: string | null;
  /** Gevuld bij een ingeplande vakantie: de dag waarop die vakantie begint. */
  sleutel: string | null;
  /** Wisseltijden van een vakantie; null bij hele dagen, zoals een omgezette week. */
  tijden: Wisseltijden | null;
  aantalDagen: number;
};

export type Wisseltijden = { van: string; tot: string };

export type Invoer = {
  jaar: number;
  /** Huishouden dat de oneven ISO-weken krijgt. */
  onevenCoupleId: number;
  /** Huishouden dat de even ISO-weken krijgt. */
  evenCoupleId: number;
  /** Per feestdag welk huishouden hem krijgt. Ontbreekt een feestdag, dan geldt de gewone regel. */
  feestdagToewijzing: Partial<Record<FeestdagCode, number>>;
  /**
   * Zelf ingeplande vakanties, dwars door het patroon heen. `tot` is de wisseldag:
   * de vakantie beslaat de nachten van `van` tot en met de dag ervoor, en op `tot`
   * zelf is het vanaf 12:00 weer van de volgende.
   */
  vakanties?: readonly IngeplandeVakantie[];
  /** Eigen begin en einde van het seizoen; zonder is het maart tot en met oktober. */
  grenzen?: SeizoenGrenzen;
};

export type IngeplandeVakantie = {
  van: string;
  tot: string;
  coupleId: number;
  naam?: string;
  tijden?: Wisseltijden | null;
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
  naam: string | null;
  /**
   * Alleen dagen met dezelfde sleutel mogen samengevoegd worden. Voor een ingeplande
   * vakantie is dat zijn eerste dag, zodat twee vakanties die op elkaar aansluiten
   * twee regels blijven, ook als ze van hetzelfde huishouden zijn.
   */
  sleutel: string | null;
  tijden: Wisseltijden | null;
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
  const dagen = dagenInSeizoen(invoer.jaar, invoer.grenzen);
  const inSeizoen = new Set(dagen);

  // 1. Basisregel: elke dag hoort bij de eigenaar van zijn ISO-week.
  const eigenaars = new Map<string, DagEigenaar>();
  for (const dag of dagen) {
    const oneven = isoWeek(dag) % 2 === 1;
    eigenaars.set(dag, {
      coupleId: oneven ? invoer.onevenCoupleId : invoer.evenCoupleId,
      reden: oneven ? "oneven" : "even",
      feestdag: null,
      naam: null,
      sleutel: null,
      tijden: null,
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
        naam: feestdag.naam,
        sleutel: null,
        tijden: null,
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

  // 3. Zelf ingeplande vakanties winnen van alles, inclusief de feestdagen. Per
  //    nacht: de wisseldag zelf hoort al bij wie er daarna aan boord komt.
  for (const vakantie of invoer.vakanties ?? []) {
    for (let dag = vakantie.van; dag < vakantie.tot; dag = plusDagen(dag, 1)) {
      if (!inSeizoen.has(dag)) continue;
      eigenaars.set(dag, {
        coupleId: vakantie.coupleId,
        reden: "handmatig",
        feestdag: null,
        naam: vakantie.naam?.trim() ? vakantie.naam.trim() : null,
        sleutel: vakantie.van,
        tijden: vakantie.tijden ?? null,
      });
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
      laatste.naam === eigenaar.naam &&
      laatste.sleutel === eigenaar.sleutel &&
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
      naam: eigenaar.naam,
      sleutel: eigenaar.sleutel,
      tijden: eigenaar.tijden,
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
