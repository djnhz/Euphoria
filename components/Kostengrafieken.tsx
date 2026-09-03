"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import Chart from "./Chart";
import { MAANDEN } from "@/lib/datum";
import { formatEuro } from "@/lib/geld";
import { HUISHOUDKLEUREN } from "@/lib/kleuren";
import { Bovenschrift } from "./Scherm";

export type GrafiekData = {
  /** Per maand wat elk huishouden heeft voorgeschoten. */
  betaaldPerMaand: { a: number[]; b: number[] };
  saldoVerloop: number[];
  namen: { a: string; b: string };
};

/**
 * ECharts geeft waarden los getypeerd door; alles wat binnenkomt is een bedrag in centen.
 * `minInterval: 100` op de assen houdt de stapgrootte op hele euros, anders staat een lege
 * grafiek vol met streepjes van een cent.
 */
const alsEuro = (waarde: unknown) => formatEuro(Number(waarde) || 0);

/**
 * De twee vragen die een lijst met bonnen niet beantwoordt: liep het door het jaar
 * heen gelijk op, en hoe bewoog het onderlinge saldo. De verdeling over de posten
 * staat al bovenaan het scherm als balk en hoeft hier niet nog eens.
 */
export default function Kostengrafieken({ data }: { data: GrafiekData }) {
  const staven = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", valueFormatter: alsEuro },
      legend: { show: false },
      grid: { left: 58, right: 8, top: 12, bottom: 24 },
      xAxis: {
        type: "category",
        data: MAANDEN,
        axisLabel: { fontSize: 10, color: "#16283F99" },
      },
      yAxis: {
        type: "value",
        minInterval: 100,
        axisLabel: { formatter: alsEuro, fontSize: 10, color: "#16283F99" },
        splitLine: { lineStyle: { color: "#16283F14" } },
      },
      series: [
        {
          name: data.namen.a,
          type: "bar",
          stack: "totaal",
          data: data.betaaldPerMaand.a,
          itemStyle: { color: HUISHOUDKLEUREN[0] },
        },
        {
          name: data.namen.b,
          type: "bar",
          stack: "totaal",
          data: data.betaaldPerMaand.b,
          itemStyle: { color: HUISHOUDKLEUREN[1] },
        },
      ],
    }),
    [data.betaaldPerMaand, data.namen],
  );

  const verloop = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", valueFormatter: alsEuro },
      grid: { left: 62, right: 8, top: 12, bottom: 24 },
      xAxis: {
        type: "category",
        data: MAANDEN,
        axisLabel: { fontSize: 10, color: "#16283F99" },
      },
      yAxis: {
        type: "value",
        minInterval: 100,
        axisLabel: { formatter: alsEuro, fontSize: 10, color: "#16283F99" },
        splitLine: { lineStyle: { color: "#16283F14" } },
      },
      series: [
        {
          name: "Saldo",
          type: "line",
          smooth: true,
          areaStyle: { opacity: 0.14 },
          data: data.saldoVerloop,
          itemStyle: { color: "#16283F" },
        },
      ],
    }),
    [data.saldoVerloop],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Paneel titel="Per maand, wie betaalde">
        <Chart option={staven} />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {[
            { naam: data.namen.a, kleur: HUISHOUDKLEUREN[0] },
            { naam: data.namen.b, kleur: HUISHOUDKLEUREN[1] },
          ].map((huishouden) => (
            <li key={huishouden.naam} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: huishouden.kleur }}
              />
              {huishouden.naam}
            </li>
          ))}
        </ul>
      </Paneel>
      <Paneel
        titel="Verloop van het onderlinge saldo"
        toelichting={`Positief: ${data.namen.b} moet nog aan ${data.namen.a} betalen.`}
      >
        <Chart option={verloop} />
      </Paneel>
    </div>
  );
}

function Paneel({
  titel,
  toelichting,
  children,
}: {
  titel: string;
  toelichting?: string;
  children: React.ReactNode;
}) {
  return (
    // min-w-0: een canvas houdt zijn eigen breedte vast, en zonder deze regel rekt
    // hij het raster op tot buiten het scherm in plaats van mee te krimpen.
    <section className="min-w-0 rounded-2xl border border-rand bg-paneel p-4">
      <Bovenschrift>{titel}</Bovenschrift>
      {toelichting && (
        <p className="mt-1 mb-2 text-[11.5px] text-gedempt">{toelichting}</p>
      )}
      <div className="mt-2 min-w-0">{children}</div>
    </section>
  );
}
