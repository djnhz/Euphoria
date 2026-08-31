"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import Chart from "./Chart";
import { MAANDEN } from "@/lib/datum";
import { formatEuro } from "@/lib/geld";

export type GrafiekData = {
  posten: { naam: string; kleur: string; cent: number }[];
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

export default function DashboardGrafieken({ data }: { data: GrafiekData }) {
  const donut = useMemo<EChartsOption>(
    () => ({
      tooltip: { valueFormatter: alsEuro },
      // Geen legenda van ECharts: die knipt lange namen af op een smal scherm. De
      // lijst eronder is leesbaarder en zet de bedragen erbij.
      legend: { show: false },
      series: [
        {
          name: "Uitgaven",
          type: "pie",
          radius: ["45%", "70%"],
          center: ["50%", "50%"],
          label: { show: false },
          data: data.posten.map((post) => ({
            name: post.naam,
            value: post.cent,
            itemStyle: { color: post.kleur },
          })),
        },
      ],
    }),
    [data.posten],
  );

  const staven = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", valueFormatter: alsEuro },
      legend: { show: false },
      grid: { left: 64, right: 12, top: 16, bottom: 24 },
      xAxis: { type: "category", data: MAANDEN },
      yAxis: { type: "value", minInterval: 100, axisLabel: { formatter: alsEuro } },
      series: [
        {
          name: data.namen.a,
          type: "bar",
          stack: "totaal",
          data: data.betaaldPerMaand.a,
          itemStyle: { color: "#0ea5e9" },
        },
        {
          name: data.namen.b,
          type: "bar",
          stack: "totaal",
          data: data.betaaldPerMaand.b,
          itemStyle: { color: "#f97316" },
        },
      ],
    }),
    [data.betaaldPerMaand, data.namen],
  );

  const verloop = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", valueFormatter: alsEuro },
      grid: { left: 72, right: 12, top: 16, bottom: 28 },
      xAxis: { type: "category", data: MAANDEN },
      yAxis: { type: "value", minInterval: 100, axisLabel: { formatter: alsEuro } },
      series: [
        {
          name: "Saldo",
          type: "line",
          smooth: true,
          areaStyle: { opacity: 0.15 },
          data: data.saldoVerloop,
          itemStyle: { color: "#8b5cf6" },
        },
      ],
    }),
    [data.saldoVerloop],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Paneel titel="Uitgaven per hoofdpost">
        <Chart option={donut} hoogte={200} />
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {data.posten.map((post) => (
            <li key={post.naam} className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 translate-y-0.5 rounded"
                style={{ background: post.kleur }}
              />
              <span className="min-w-0 flex-1 truncate">{post.naam}</span>
              <span className="cijfers shrink-0 text-gedempt">
                {formatEuro(post.cent)}
              </span>
            </li>
          ))}
        </ul>
      </Paneel>
      <Paneel titel="Per maand, wie betaalde">
        <Chart option={staven} />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[
            { naam: data.namen.a, kleur: "#0ea5e9" },
            { naam: data.namen.b, kleur: "#f97316" },
          ].map((huishouden) => (
            <li key={huishouden.naam} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded"
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
    <section className="min-w-0 rounded-xl border border-rand bg-paneel p-4">
      <h2 className="text-sm font-medium">{titel}</h2>
      {toelichting && <p className="mb-2 text-xs text-gedempt">{toelichting}</p>}
      {children}
    </section>
  );
}
