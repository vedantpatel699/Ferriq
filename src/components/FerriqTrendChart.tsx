import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  AriaComponent,
  BrushComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { DateTime } from "luxon";
import { DataTable } from "./DataTable";
import { formatNumber } from "../lib/format";
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  AriaComponent,
  BrushComponent,
  CanvasRenderer,
]);
export type ChartSeriesKind = "measured" | "baseline" | "prediction";
export interface ChartSeries {
  name: string;
  kind: ChartSeriesKind;
  data: [number, number | null][];
  color?: string;
  dash?: "solid" | "dashed" | "dotted";
  symbol?: "rect" | "emptyCircle";
}
export interface ChartConstraintLine {
  name: string;
  value: number;
}
export interface FerriqTrendChartProps {
  elapsed?: boolean;
  sourceTimes?: Record<string, Record<number, number>>;
  xBounds?: [number, number];
  verticalMarkers?: { name: string; value: number }[];
  series: ChartSeries[];
  unit: string;
  constraints?: ChartConstraintLine[];
  nowBoundary?: number;
  height?: number;
  title?: string;
  digits?: number;
  bounds?: { min?: number; max?: number };
  uncertainty?: {
    lower: [number, number | null][];
    upper: [number, number | null][];
  };
}
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const time = (t: number) =>
  DateTime.fromMillis(t, { zone: "America/Edmonton" }).toFormat(
    "LLL d, yyyy HH:mm",
  );
export function FerriqTrendChart({
  series,
  unit,
  constraints = [],
  nowBoundary,
  height = 320,
  title = "Engineering trend",
  digits = 2,
  bounds,
  uncertainty,
  elapsed = false,
  sourceTimes,
  xBounds,
  verticalMarkers = [],
}: FerriqTrendChartProps) {
  const container = useRef<HTMLDivElement>(null),
    chart = useRef<echarts.ECharts | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [zoom, setZoom] = useState<[number, number]>([0, 100]);
  const valid = series.some((s) => s.data.some((p) => finite(p[1])));
  useEffect(() => {
    if (!container.current) return;
    const c = echarts.init(container.current);
    chart.current = c;
    const resize = new ResizeObserver(() => c.resize());
    resize.observe(container.current);
    c.on("datazoom", () => {
      const z = (
        c.getOption().dataZoom as { start?: number; end?: number }[]
      )[0];
      setZoom([z.start ?? 0, z.end ?? 100]);
    });
    return () => {
      resize.disconnect();
      c.dispose();
    };
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const palette = ["#2F6F9F", "#667085", "#2F7F7A", "#7A5AF8"];
    const lines = series
      .filter((s) => !hidden.includes(s.name))
      .map((s, i) => ({
        id: s.name,
        name: s.name,
        type: "line",
        showSymbol: !!s.symbol,
        symbol: s.symbol,
        symbolSize: (_: unknown, p: { dataIndex: number }) =>
          p.dataIndex % Math.max(1, Math.ceil(s.data.length / 25)) === 0
            ? 4
            : 0,
        connectNulls: false,
        lineStyle: {
          width: s.kind === "baseline" ? 1.8 : 2.5,
          type: s.dash ?? (s.kind === "measured" ? "solid" : "dashed"),
          color:
            s.color ??
            (s.kind === "baseline"
              ? "#66666b"
              : s.kind === "prediction"
                ? "#366f9c"
                : palette[i % palette.length]),
        },
        itemStyle: {
          color:
            s.color ??
            (s.kind === "baseline"
              ? "#66666b"
              : s.kind === "prediction"
                ? "#366f9c"
                : palette[i % palette.length]),
        },
        data: s.data.map(([t, v]) => [t, finite(v) ? v : null]),
        markLine:
          nowBoundary !== undefined && s.kind === "measured"
            ? {
                symbol: "none",
                silent: true,
                label: {
                  show: verticalMarkers.length === 0,
                  formatter: "Observation cutoff",
                  position: "insideEndTop",
                },
                data: [{ xAxis: nowBoundary }],
                lineStyle: { color: "#3c3530" },
              }
            : undefined,
      }));
    const band = uncertainty
      ? [
          {
            id: "band-base",
            name: "Band base",
            type: "line",
            data: uncertainty.lower,
            stack: "uncertainty",
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            symbol: "none",
            tooltip: { show: false },
            silent: true,
          },
          {
            id: "band-width",
            name: "P10–P90 interval",
            type: "line",
            stack: "uncertainty",
            data: uncertainty.upper.map(([t, v], i) => [
              t,
              finite(v) && finite(uncertainty.lower[i]?.[1])
                ? v - uncertainty.lower[i][1]!
                : null,
            ]),
            lineStyle: { opacity: 0 },
            areaStyle: { color: "#537fa5", opacity: 0.16 },
            symbol: "none",
            tooltip: { show: false },
            silent: true,
          },
        ]
      : [];
    c.setOption(
      {
        animation: false,
        aria: {
          enabled: true,
          description: `${title}. ${unit}. ${elapsed ? "Elapsed time alignment." : "Dates in America/Edmonton."} An accessible table follows the chart.`,
        },
        grid: { left: 80, right: 35, top: 42, bottom: 80, containLabel: false },
        tooltip: {
          trigger: "axis",
          confine: true,
          axisPointer: { type: "cross" },
          formatter: (
            items: {
              seriesName: string;
              value: [number, number | null];
              marker: string;
            }[],
          ) => {
            const rows = items.filter(
              (p) =>
                !["Band base", "P10–P90 interval", "Constraints"].includes(
                  p.seriesName,
                ),
            );
            if (!rows.length) return "";
            const safe = (s: string) =>
              s.replace(
                /[&<>"']/g,
                (c) =>
                  ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                  })[c]!,
              );
            return (
              `<strong>${elapsed ? "Day " + formatNumber(rows[0].value[0] / 86400000, 2) : time(rows[0].value[0]) + " · Edmonton"}</strong>` +
              rows
                .map(
                  (p) =>
                    `<br>${p.marker}${safe(p.seriesName)}: <strong>${formatNumber(p.value[1], digits)} ${safe(unit)}</strong>${sourceTimes?.[p.seriesName]?.[p.value[0]] !== undefined ? " · " + time(sourceTimes[p.seriesName][p.value[0]]) + " Edmonton" : ""}`,
                )
                .join("") +
              (elapsed &&
              rows.length === 2 &&
              finite(rows[0].value[1]) &&
              finite(rows[1].value[1])
                ? `<br>Δ A − B: ${formatNumber(rows[0].value[1] - rows[1].value[1], digits)} ${safe(unit === "%" ? "pp" : unit)}`
                : "")
            );
          },
        },
        xAxis: {
          type: elapsed ? "value" : "time",
          min: xBounds?.[0],
          max: xBounds?.[1],
          axisLabel: {
            hideOverlap: true,
            formatter: (v: number) =>
              elapsed
                ? `Day ${formatNumber(v / 86400000, 1)}`
                : DateTime.fromMillis(v, { zone: "America/Edmonton" }).toFormat(
                    "LLL d\nHH:mm",
                  ),
          },
        },
        yAxis: {
          type: "value",
          scale: true,
          name: unit,
          nameGap: 22,
          min: bounds?.min,
          max: bounds?.max,
          axisLabel: { formatter: (v: number) => formatNumber(v, digits) },
        },
        dataZoom: [
          { type: "inside", filterMode: "none" },
          { type: "slider", height: 24, bottom: 8, filterMode: "none" },
        ],
        series: [
          ...band,
          ...lines,
          ...(constraints.length || verticalMarkers.length
            ? [
                {
                  id: "constraints",
                  name: "Constraints",
                  type: "line",
                  data: [],
                  markArea: verticalMarkers.length
                    ? {
                        silent: true,
                        itemStyle: { color: "#6670850d" },
                        data: [
                          [
                            { xAxis: verticalMarkers[0].value },
                            {
                              xAxis: Math.max(
                                ...series.flatMap((s) =>
                                  s.data.map((p) => p[0]),
                                ),
                              ),
                            },
                          ],
                        ],
                      }
                    : undefined,
                  markLine: {
                    symbol: "none",
                    silent: true,
                    lineStyle: { color: "#943e2b", type: "dashed" },
                    label: {
                      position: "insideEndTop",
                      formatter: (p: { name: string; value: number }) =>
                        `${p.name} ${formatNumber(p.value, digits)}`,
                    },
                    data: [
                      ...constraints.map((c) => ({
                        name: c.name,
                        yAxis: c.value,
                      })),
                      ...verticalMarkers.map((m) => ({
                        name: m.name,
                        xAxis: m.value,
                        label: {
                          formatter: m.name,
                          position: "insideEndTop",
                          rotate: 0,
                          align: "left",
                          offset: [6, 8],
                          fontSize: 11,
                        },
                      })),
                    ],
                  },
                },
              ]
            : []),
        ],
      },
      { replaceMerge: ["series"] },
    );
  }, [
    series,
    unit,
    constraints,
    nowBoundary,
    hidden,
    title,
    digits,
    bounds,
    uncertainty,
    elapsed,
    sourceTimes,
    xBounds,
    verticalMarkers,
  ]);
  function view(start: number, end: number) {
    const width = Math.min(100, Math.max(2, end - start));
    const s = Math.max(0, Math.min(100 - width, start));
    chart.current?.dispatchAction({
      type: "dataZoom",
      start: s,
      end: s + width,
    });
  }
  const times = [
    ...new Set(series.flatMap((s) => s.data.map((p) => p[0]))),
  ].sort((a, b) => a - b);
  const rows = times.map((t) =>
    Object.fromEntries([
      [
        elapsed ? "Elapsed day" : "Time (America/Edmonton)",
        elapsed ? formatNumber(t / 86400000, 3) : time(t),
      ],
      ...series.map((s) => [
        `${s.name} (${unit})`,
        s.data.find((p) => p[0] === t)?.[1] ?? null,
      ]),
    ]),
  );
  return (
    <section aria-label={title} className="trend-surface">
      <div className="chart-tools" role="group" aria-label="Chart view">
        <button
          disabled={!valid}
          onClick={() => {
            const w = (zoom[1] - zoom[0]) / 4;
            view(zoom[0] + w, zoom[1] - w);
          }}
        >
          Zoom in
        </button>
        <button
          disabled={!valid}
          onClick={() => {
            const w = (zoom[1] - zoom[0]) / 2;
            view(zoom[0] - w, zoom[1] + w);
          }}
        >
          Zoom out
        </button>
        <button
          disabled={!valid || zoom[0] === 0}
          onClick={() => {
            const w = (zoom[1] - zoom[0]) / 3;
            view(zoom[0] - w, zoom[1] - w);
          }}
        >
          Earlier
        </button>
        <button
          disabled={!valid || zoom[1] === 100}
          onClick={() => {
            const w = (zoom[1] - zoom[0]) / 3;
            view(zoom[0] + w, zoom[1] + w);
          }}
        >
          Later
        </button>
        <button onClick={() => view(0, 100)}>Reset view</button>
        <span>Site time: America/Edmonton</span>
      </div>
      <div className="series-controls" role="group" aria-label="Visible series">
        {series.map((s) => (
          <label key={s.name}>
            <input
              type="checkbox"
              checked={!hidden.includes(s.name)}
              onChange={() =>
                setHidden((h) =>
                  h.includes(s.name)
                    ? h.filter((n) => n !== s.name)
                    : [...h, s.name],
                )
              }
            />
            {s.name}
          </label>
        ))}
      </div>
      {!valid && (
        <p role="status">
          No valid measurements in this range. Missing values are not zero.
        </p>
      )}
      <div
        ref={container}
        className="chart-echart"
        style={{ height, display: valid ? "block" : "none" }}
        role="img"
        aria-label={`${title}; ${unit}. Use chart controls or the data table for keyboard access.`}
      />
      <details>
        <summary>Accessible chart data</summary>
        <DataTable rows={rows} caption={title} />
      </details>
    </section>
  );
}
