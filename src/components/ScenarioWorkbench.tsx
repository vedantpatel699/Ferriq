import { useMemo, useState } from "react";
import type {
  FurnaceEntry,
  PassForecastResult,
} from "../engineering/furnace/calculations";
import { flowSplitDomain, simulateFlowSplit } from "../poc/scenario";
import { FerriqTrendChart } from "./FerriqTrendChart";
import { formatNumber } from "../lib/format";
export function ScenarioWorkbench({
  furnace,
  result,
  threshold,
  last,
  days,
  measured,
}: {
  furnace: FurnaceEntry;
  result: PassForecastResult;
  threshold: number;
  last: number;
  days: number;
  measured: [number, number | null][];
}) {
  const domain = useMemo(() => flowSplitDomain(furnace), [furnace]);
  const [split, setSplit] = useState(domain?.baseline ?? 25),
    [applied, setApplied] = useState<ReturnType<
      typeof simulateFlowSplit
    > | null>(null);
  if (!domain)
    return (
      <p>
        Pass 3 flow-split scenario is unavailable: complete per-pass flow
        history is required.
      </p>
    );
  const dirty = applied
    ? Math.abs(split - applied.split) > 0.001
    : Math.abs(split - domain.baseline) > 0.001;
  const outside = split < domain.min || split > domain.max;
  const min = Math.max(0.5, Math.floor(domain.min) - 5),
    max = Math.min(99.5, Math.ceil(domain.max) + 5);
  const prediction = result.forecast.filter((f) => f.day <= days),
    scenario = applied?.forecast.filter((f) => f.day <= days);
  const band = scenario ?? prediction;
  const toPoints = (
    field: "value" | "p10" | "p90",
    rows = prediction,
  ): [number, number][] => [
    [last, result.skinNowC],
    ...rows.map((f) => [last + f.day * 86400000, f[field]] as [number, number]),
  ];
  const metrics = Object.values(furnace.tc_models)
    .filter((m) => m.pass === 3)
    .flatMap((m) =>
      typeof m.metrics?.test_mae_p50_c === "number"
        ? [m.metrics.test_mae_p50_c]
        : [],
    );
  const delay =
    applied && applied.hoursToThreshold !== null && result.hoursToAlarm !== null
      ? (applied.hoursToThreshold - result.hoursToAlarm) / 24
      : null;
  return (
    <section
      className="scenario-workspace"
      aria-label="Pass 3 what-if workspace"
    >
      <div className="now-strip">
        <h2>Now · Pass 3</h2>
        <p>
          <strong>{formatNumber(result.skinNowC, 1)} °C</strong> · Margin to{" "}
          {threshold} °C:{" "}
          <strong>{formatNumber(threshold - result.skinNowC, 1)} °C</strong> ·
          Flow split: {formatNumber(domain.baseline, 2)}%
        </p>
      </div>
      <div className="scenario-columns">
        <section className="chart-card">
          <h2>Forecast</h2>
          <p className="quality-marker">
            POC scenario response is simulated. Baseline is the original
            forecast engine.
          </p>
          <FerriqTrendChart
            title="Pass 3 baseline and simulated scenario"
            unit="°C"
            digits={1}
            nowBoundary={last}
            verticalMarkers={[
              {
                name: "24 h validation ends",
                value: last + 86400000,
              },
              ...(
                [
                  { name: "Baseline crossing", hours: result.hoursToAlarm },
                  {
                    name: "Simulated crossing",
                    hours: applied?.hoursToThreshold,
                  },
                ] as const
              ).flatMap((m) =>
                m.hours != null && m.hours > 0 && m.hours <= days * 24
                  ? [{ name: m.name, value: last + m.hours * 3600000 }]
                  : [],
              ),
            ]}
            series={[
              {
                name: "Measured pass maximum",
                kind: "measured",
                data: measured,
              },
              {
                name: "Original baseline forecast",
                kind: "baseline",
                data: toPoints("value"),
              },
              ...(scenario
                ? [
                    {
                      name: "POC simulated scenario",
                      kind: "prediction" as const,
                      data: toPoints("value", scenario),
                    },
                  ]
                : []),
            ]}
            uncertainty={{
              lower: toPoints("p10", band),
              upper: toPoints("p90", band),
            }}
            constraints={[
              { name: "Measured advisory", value: 460 },
              { name: "Forecast reference", value: threshold },
            ]}
          />
          <p>
            Shaded interval uses the original P10–P90 spread plus an explicit
            illustrative horizon allowance after Run scenario. It is not a
            calibrated scenario confidence interval.
          </p>
        </section>
        <aside className="scenario-actions" aria-label="Scenario action">
          <h2>Action</h2>
          <label htmlFor="flow-split">
            Pass 3 flow split{" "}
            <output htmlFor="flow-split">{formatNumber(split, 2)}%</output>
          </label>
          <div
            className="domain-track"
            style={{
              background: `linear-gradient(to right,#dedbe7 ${((domain.min - min) / (max - min)) * 100}%,#e4e8e9 ${((domain.min - min) / (max - min)) * 100}%,#e4e8e9 ${((domain.max - min) / (max - min)) * 100}%,#dedbe7 ${((domain.max - min) / (max - min)) * 100}%)`,
            }}
          >
            <input
              id="flow-split"
              type="range"
              min={min}
              max={max}
              step="0.1"
              value={split}
              onChange={(e) => setSplit(e.target.valueAsNumber)}
            />
          </div>
          <p>
            Observed history: {formatNumber(domain.min, 2)}–
            {formatNumber(domain.max, 2)}%. Shaded track extensions are outside
            that range.
          </p>
          {outside && (
            <p role="status" className="quality-marker">
              Outside observed history range. Scenario response is unsupported.
            </p>
          )}
          <p>
            POC lever: Pass 3 flow split. A real change affects tube-side heat
            transfer, but this demonstration uses an assumed response curve, not
            a validated causal model. Other levers are outside this POC.
          </p>
          <div className="action-bar">
            <button
              onClick={() =>
                setApplied(
                  simulateFlowSplit(result, domain.baseline, split, threshold),
                )
              }
            >
              Run scenario
            </button>
            <button
              onClick={() => {
                setSplit(domain.baseline);
                setApplied(null);
              }}
            >
              Reset scenario
            </button>
          </div>
          <p role="status">
            {dirty
              ? "Slider changed; run the scenario to apply it."
              : applied
                ? "POC simulation applied."
                : "Baseline view; no scenario applied."}
          </p>
          <section className="recommendation-card">
            <h3>Validated effect</h3>
            <p>
              No intervention effect has been validated. Historical 24 h
              forecast MAE:{" "}
              {metrics.length
                ? `${formatNumber(Math.min(...metrics), 2)}–${formatNumber(Math.max(...metrics), 2)} °C`
                : "not supplied"}
              . Forecast accuracy does not establish causal flow-split
              sensitivity.
            </p>
            <h3>Projected effect · POC simulation</h3>
            {applied ? (
              <>
                <p>
                  Illustrative 24 h TI change:{" "}
                  {formatNumber(applied.effect24[0], 1)} to{" "}
                  {formatNumber(applied.effect24[1], 1)} °C.
                </p>
                <p>
                  Simulated reference-crossing delay: {formatNumber(delay, 1)}{" "}
                  days
                  {delay === null
                    ? " (crossing unavailable in one trajectory)"
                    : ""}
                  .
                </p>
                <p>
                  Applied split: {formatNumber(applied.split, 2)}%.{" "}
                  {applied.split < domain.min || applied.split > domain.max
                    ? "Outside observed range."
                    : "Within observed range; response still unvalidated."}
                </p>
              </>
            ) : (
              <p>Run a scenario to compare with the original baseline.</p>
            )}
            <h3>Model support</h3>
            <p>
              Demonstration only. Beyond 24 h is extrapolated. Use this to
              review the workflow, not to change plant flows or commit
              turnaround timing.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
