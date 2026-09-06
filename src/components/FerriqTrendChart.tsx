import { useEffect, useRef } from "react";
// Tree-shaken ECharts import (core + only the renderer/chart/components
// actually used) instead of the full library, to keep the bundle small.
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

export type ChartSeriesKind = "measured" | "baseline" | "prediction";

export interface ChartSeries {
  name: string;
  kind: ChartSeriesKind;
  /** [epoch-ms, value | null] pairs. A null value creates a real gap in
   *  the line rather than interpolating across missing data. */
  data: [number, number | null][];
}

export interface ChartConstraintLine {
  name: string;
  value: number;
}

export interface FerriqTrendChartProps {
  series: ChartSeries[];
  unit: string;
  constraints?: ChartConstraintLine[];
  /** Vertical boundary between historical and forecast data, for
   *  predictor charts (epoch-ms). */
  nowBoundary?: number;
  height?: number;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Shared ECharts-based trend chart: real timestamp x-axis, readable
 *  numeric y-axis with units, measured/baseline/prediction visual
 *  grammar, constraint reference lines, crosshair + tooltip, zoom/pan
 *  with a reset-view control, and responsive resize. Never fabricates an
 *  uncertainty/confidence band — a series is only rendered if the caller
 *  supplies real data for it. */
export function FerriqTrendChart({ series, unit, constraints = [], nowBoundary, height = 260 }: FerriqTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.dispose(); };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const colorFor: Record<ChartSeriesKind, string> = {
      measured: cssVar("--chart-measured", "#9c6636"),
      baseline: cssVar("--chart-baseline", "#7a7a7d"),
      prediction: cssVar("--chart-prediction", "#597ea3"),
    };
    const constraintColor = cssVar("--chart-constraint", "#b3401f");
    const nowColor = cssVar("--chart-now", "#241d17");

    const hasData = series.some((s) => s.data.length > 0);

    chart.setOption({
      grid: { left: 56, right: 20, top: 16, bottom: 40 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
      },
      xAxis: { type: "time" },
      yAxis: {
        type: "value",
        name: unit,
        nameLocation: "end",
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      dataZoom: [
        { type: "inside" },
        { type: "slider", height: 18, bottom: 4 },
      ],
      series: [
        ...series.map((s) => ({
          name: s.name,
          type: "line" as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: {
            color: colorFor[s.kind],
            width: s.kind === "measured" ? 2.5 : 1.5,
            type: s.kind === "measured" ? "solid" : "dashed",
          },
          itemStyle: { color: colorFor[s.kind] },
          data: s.data,
          markLine: nowBoundary !== undefined && s.kind === "measured" ? {
            symbol: "none",
            silent: true,
            lineStyle: { color: nowColor, type: "solid", width: 1.5 },
            label: { formatter: "Now", color: nowColor },
            data: [{ xAxis: nowBoundary }],
          } : undefined,
        })),
        ...(constraints.length > 0 ? [{
          name: "Constraints",
          type: "line" as const,
          data: [],
          markLine: {
            symbol: "none",
            lineStyle: { color: constraintColor, type: "solid", width: 1 },
            label: { formatter: (p: { name: string }) => p.name, color: constraintColor, position: "insideEndTop" as const },
            data: constraints.map((c) => ({ name: c.name, yAxis: c.value })),
          },
        }] : []),
      ],
    }, true);

    if (!hasData) chart.clear();
  }, [series, unit, constraints, nowBoundary]);

  const hasData = series.some((s) => s.data.length > 0);

  return (
    <div style={{ position: "relative" }}>
      {!hasData && <div className="chart-empty">No data in the selected range.</div>}
      <div
        ref={containerRef}
        className="chart-echart"
        style={{ height, visibility: hasData ? "visible" : "hidden" }}
      />
    </div>
  );
}

export function resetChartZoom(container: HTMLDivElement | null) {
  if (!container) return;
  const chart = echarts.getInstanceByDom(container);
  chart?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
}
