"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

/**
 * Alle dashboardgrafieken delen deze component. Bewust geen `echarts-for-react`:
 * die wrapper loopt achter op React 19 en vervangt de twintig regels hieronder.
 */
export default function Chart({
  option,
  hoogte = 260,
}: {
  option: echarts.EChartsOption;
  hoogte?: number;
}) {
  const houder = useRef<HTMLDivElement>(null);
  const grafiek = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!houder.current) return;
    const donker = window.matchMedia("(prefers-color-scheme: dark)").matches;
    grafiek.current = echarts.init(houder.current, donker ? "dark" : undefined, {
      renderer: "canvas",
    });
    const meten = new ResizeObserver(() => grafiek.current?.resize());
    meten.observe(houder.current);
    return () => {
      meten.disconnect();
      grafiek.current?.dispose();
      grafiek.current = null;
    };
  }, []);

  useEffect(() => {
    // `true` vervangt de vorige optie in plaats van hem samen te voegen, zodat
    // verdwenen series ook echt verdwijnen.
    grafiek.current?.setOption({ backgroundColor: "transparent", ...option }, true);
  }, [option]);

  // w-full plus min-w-0: anders houdt het canvas zijn oude breedte vast als het
  // scherm smaller wordt, en duwt het zijn eigen paneel op.
  return (
    <div ref={houder} style={{ height: hoogte }} className="w-full min-w-0" />
  );
}
