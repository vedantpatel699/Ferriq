import { TrendRangeSelector } from "../components/TrendRangeSelector";
import { resolveTimeRange, rangeContextLabel } from "../lib/timeRange";
import type { TimeRangeId } from "../engineering/types";
import { ScenarioWorkbench } from "../components/ScenarioWorkbench";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DateTime } from "luxon";
import { useResource, useWorkspace } from "../lib/WorkspaceContext";
import {
  forecastPass,
  statusForSkin,
  type FurnaceModelBundle,
} from "../engineering/furnace/calculations";
import { timestamp } from "../engineering/catalog";
import { toEquipmentState } from "../engineering/blower/calculations";
import { EquipmentHeader } from "../components/EquipmentHeader";
import { FerriqTrendChart } from "../components/FerriqTrendChart";
import { DataTable } from "../components/DataTable";
import { ReferenceManual } from "../components/ReferenceManual";
import { formatNumber } from "../lib/format";
import { csv, downloadFile } from "../lib/files";
export function FurnaceSkinTempPage() {
  const { snapshot } = useWorkspace();
  if (!snapshot.resources.some((r) => r.key === "furnace-model"))
    return (
      <>
        <h1>Furnace Skin TI Predictor</h1>
        <p>
          Forecasts require a valid predictor model. Model status and retry
          controls are shown above.
        </p>
      </>
    );
  return <FurnaceContent />;
}
function FurnaceContent() {
  const { data: bundle, version } =
      useResource<FurnaceModelBundle>("furnace-model"),
    { save, readOnly } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const key = params.get("furnace") ?? Object.keys(bundle.furnaces)[0];
  const furnace = bundle.furnaces[key] ?? Object.values(bundle.furnaces)[0];
  const pass = Math.max(
    1,
    Math.min(
      furnace.passes,
      Number(params.get("pass")) || (key === "heater_1" ? 3 : 1),
    ),
  );
  const [historyRange, setHistoryRange] = useState<TimeRangeId>("30d");
  const [days, setDays] = useState(30),
    [tab, setTab] = useState("Forecast"),
    [tc, setTc] = useState(""),
    [driver, setDriver] = useState("box_t_c"),
    [notice, setNotice] = useState("");
  const results = useMemo(() => {
    const last = furnace.history.at(-1)!;
    const current = Object.fromEntries(
      Object.entries(last).filter(([, v]) => typeof v === "number"),
    ) as Record<string, number>;
    const history = Object.fromEntries(
      Object.keys(furnace.tc_models).map((a) => [
        a,
        furnace.history
          .map((r) => r[a] as number)
          .filter((v) => typeof v === "number" && Number.isFinite(v)),
      ]),
    );
    return Array.from({ length: furnace.passes }, (_, i) =>
      forecastPass(
        furnace,
        i + 1,
        current,
        history,
        bundle.alarm_threshold_c,
        bundle.horizon_hours,
      ),
    );
  }, [furnace, bundle.alarm_threshold_c, bundle.horizon_hours]);
  const r = results[pass - 1];
  if (!r)
    return (
      <>
        <h1>Furnace Skin TI Predictor</h1>
        <p>No valid thermocouple history for this pass.</p>
      </>
    );
  const aliases = Object.keys(furnace.tc_models).filter(
      (a) => furnace.tc_models[a].pass === pass,
    ),
    alias = aliases.includes(tc) ? tc : aliases[0],
    model = furnace.tc_models[alias];
  const last = r.observationEpoch;
  const historyPeriod = resolveTimeRange(
    historyRange,
    DateTime.fromMillis(last),
  );
  const history = furnace.history.filter(
    (h) =>
      timestamp(h.t) >= +historyPeriod.start &&
      timestamp(h.t) <= +historyPeriod.end,
  );
  const projection = r.forecast.filter((f) => f.day <= days);
  const measured = history.map((h) => {
    const values = aliases
      .map((a) => h[a])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return [timestamp(h.t), values.length ? Math.max(...values) : null] as [
      number,
      number | null,
    ];
  });
  const predicted: [[number, number], ...[number, number][]] = [
    [last, r.skinNowC],
    ...projection.map(
      (f) => [last + f.day * 86400000, f.value] as [number, number],
    ),
  ];
  const eta = (h: number | null) =>
    r.skinNowC >= bundle.alarm_threshold_c
      ? "Already at or above reference"
      : h === null
        ? "Not reached within 7-year model horizon"
        : formatNumber(Math.max(0, h) / 24, 1) + " days";
  const h = model?.holdout;
  const drivers = Object.keys(furnace.history[0]).filter((k) =>
    /flow|box|stack|outlet/.test(k),
  );
  const selectedDriver = drivers.includes(driver) ? driver : drivers[0];
  return (
    <>
      <EquipmentHeader
        name="Furnace Skin TI Predictor"
        meta={`${furnace.label} · Pass ${pass}`}
        freshness={`Observation ${DateTime.fromMillis(last, { zone: "America/Edmonton" }).toFormat("LLL d, yyyy HH:mm")} Edmonton · Model trained ${bundle.trained_at}`}
        state={toEquipmentState(statusForSkin(r.skinNowC, r.hoursToAlarm))}
      />
      {bundle.demo_source && (
        <p>
          {bundle.demo_source}. As of {bundle.demo_as_of}. Simulated drivers are
          not validation of trained forecasts.
        </p>
      )}
      <TrendRangeSelector
        value={historyRange}
        onChange={setHistoryRange}
        includeCustom={false}
        contextLabel={rangeContextLabel(historyPeriod)}
      />
      <div className="action-bar">
        <label>
          Furnace
          <select
            value={furnace.key ?? key}
            onChange={(e) => {
              setParams({ furnace: e.target.value, pass: "1" });
              setTc("");
            }}
          >
            {Object.entries(bundle.furnaces).map(([k, f]) => (
              <option key={k} value={k}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pass
          <select
            value={pass}
            onChange={(e) => setParams({ furnace: key, pass: e.target.value })}
          >
            {results.map((_, i) => (
              <option key={i} value={i + 1}>
                Pass {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Projection horizon
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90, 180, 365, 1095, 2555].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="page-tabs" role="group" aria-label="Predictor views">
        {[
          "Forecast",
          "Drivers & validation",
          "Data & Log",
          "Engineering manual",
        ].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      {tab === "Forecast" && (
        <>
          {r.dataAgeHours > 0 && (
            <p role="status">
              Projection starts at the last available pass observation,{" "}
              {formatNumber(r.dataAgeHours, 1)} hours before the dataset end. No
              new measurement is inferred for that gap.
            </p>
          )}
          {r.missingThermocouples.length > 0 && (
            <p role="alert">
              Incomplete pass coverage: {r.missingThermocouples.join(", ")}. The
              hottest missing thermocouple and its time to limit are unknown.
            </p>
          )}
          <section className="finding">
            <h2>
              {r.skinNowC >= 470
                ? "Measured skin temperature meets the measured-status alarm criterion"
                : r.skinNowC >= 460
                  ? "Measured skin temperature meets the measured-status advisory criterion"
                  : "Review projected approach to the configured reference"}
            </h2>
            <p>
              Current hottest pass thermocouple: {formatNumber(r.skinNowC, 1)}{" "}
              °C. Trend projection to {bundle.alarm_threshold_c} °C:{" "}
              {eta(r.hoursToAlarm)}. No calibrated long-range interval is
              available.
            </p>
          </section>
          <p>
            Two threshold conventions are shown separately. Measured-status
            criteria: advisory 460 °C; alarm 470 °C. Forecast reference:{" "}
            {bundle.alarm_threshold_c} °C.
          </p>
          {key === "heater_1" && pass === 3 ? (
            <ScenarioWorkbench
              key={key + pass + version}
              furnace={furnace}
              result={r}
              threshold={bundle.alarm_threshold_c}
              last={last}
              days={days}
              measured={measured}
            />
          ) : (
            <>
              <button
                onClick={() => setParams({ furnace: "heater_1", pass: "3" })}
              >
                Open Pass 3 what-if
              </button>
              <div className="chart-card">
                <FerriqTrendChart
                  key={key + pass + days}
                  title="Hottest thermocouple in pass: history and forecast"
                  unit="°C"
                  digits={1}
                  nowBoundary={last}
                  series={[
                    {
                      name: bundle.demo_source
                        ? "Simulated pass maximum"
                        : "Measured pass maximum",
                      kind: "measured",
                      data: measured,
                    },
                    {
                      name: "Trend projection of pass maximum",
                      kind: "prediction",
                      data: predicted,
                    },
                  ]}
                  constraints={[
                    { name: "Measured advisory", value: 460 },
                    { name: "Measured alarm criterion", value: 470 },
                    {
                      name: "Forecast reference",
                      value: bundle.alarm_threshold_c,
                    },
                  ]}
                />
              </div>
            </>
          )}

          <p className="source-note">
            The trend is a linear projection without a calibrated prediction
            interval. Time-to-limit estimates search up to 2,555 days with
            operating drivers held constant. Accuracy over that period has not
            been established.
          </p>
          <DataTable
            caption="Trained-horizon predictions by thermocouple (°C)"
            rows={r.tcResults.map((tc) => ({
              thermocouple: tc.tcAlias,
              horizonHours: tc.modelPrediction.hours,
              p10C: tc.modelPrediction.p10,
              medianC: tc.modelPrediction.p50,
              p90C: tc.modelPrediction.p90,
              missingInputs: tc.missingModelInputs.join(", ") || "None",
            }))}
          />
          <p>
            These are separate model predictions at the training horizon, not
            bounds on the long-range trend. Per-thermocouple intervals do not
            establish a pass-maximum interval. Missing inputs use the trained
            model’s missing-value branches; these predictions have not been
            validated for incomplete operating data.
          </p>
          <DataTable
            rows={results.flatMap((v, i) =>
              v
                ? [
                    {
                      pass: i + 1,
                      currentSkinC: v.skinNowC,
                      meanTcVelocityCPerDay: v.skinVelocityCPerDay,
                      hoursToReference:
                        v.skinNowC >= bundle.alarm_threshold_c
                          ? 0
                          : v.hoursToAlarm,
                      hoursToUpperBandReference:
                        v.skinNowC >= bundle.alarm_threshold_c
                          ? 0
                          : v.hoursToAlarmUpperBand,
                      state: statusForSkin(v.skinNowC, v.hoursToAlarm),
                    },
                  ]
                : [],
            )}
            caption="All passes in selected furnace"
          />
          <h2>Turnaround review</h2>
          <p>
            {r.hoursToAlarm !== null && r.hoursToAlarm < 72
              ? "Projected approach is within 72 hours: prioritize review of measurements, operating context and model validity."
              : "Compare the projected reference crossing with the planned turnaround date and validated operating envelope."}{" "}
            Confirm thermocouple quality, duty and flow trends before deciding
            on inspection or maintenance.
          </p>
          <DataTable
            rows={r.tcResults.map((v) => ({
              thermocouple: v.tcAlias,
              currentC: v.tcNow,
              velocityCPerDay: v.tcVelocityCPerDay,
              slopeCPerDay: v.slopePerDay,
            }))}
            caption="Thermocouple contributions"
          />
        </>
      )}
      {tab === "Drivers & validation" && (
        <>
          <label>
            Operating driver
            <select
              value={selectedDriver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {drivers.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <FerriqTrendChart
            title="Observed operating driver"
            unit={selectedDriver.includes("flow") ? "source flow units" : "°C"}
            series={[
              {
                name: selectedDriver,
                kind: "measured",
                data: history.map((row) => [
                  timestamp(row.t),
                  typeof row[selectedDriver] === "number"
                    ? Number(row[selectedDriver])
                    : null,
                ]),
              },
            ]}
          />
          <label>
            Validation thermocouple
            <select value={alias} onChange={(e) => setTc(e.target.value)}>
              {aliases.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          {model.metrics && (
            <DataTable rows={[model.metrics]} caption="Model holdout metrics" />
          )}
          {h ? (
            <FerriqTrendChart
              key={alias}
              title="Held-out observations and model estimates"
              unit="°C"
              series={[
                {
                  name: "Actual holdout",
                  kind: "measured",
                  data: h.timestamps.map((t, i) => [timestamp(t), h.actual[i]]),
                },
                {
                  name: "P50 holdout",
                  kind: "prediction",
                  data: h.timestamps.map((t, i) => [timestamp(t), h.p50[i]]),
                },
              ]}
              uncertainty={{
                lower: h.timestamps.map((t, i) => [timestamp(t), h.p10[i]]),
                upper: h.timestamps.map((t, i) => [timestamp(t), h.p90[i]]),
              }}
            />
          ) : (
            <p>No holdout series is included for this thermocouple.</p>
          )}
        </>
      )}
      {tab === "Data & Log" && (
        <>
          <div className="action-bar">
            <button
              onClick={() =>
                downloadFile(
                  "furnace-model.json",
                  JSON.stringify(bundle),
                  "application/json",
                )
              }
            >
              Export model & history
            </button>
            <button
              onClick={() =>
                downloadFile(
                  "furnace-forecast.csv",
                  csv(
                    projection.map((f) => ({
                      ...f,
                      timestamp: new Date(
                        last + f.day * 86400000,
                      ).toISOString(),
                      furnace: key,
                      pass,
                      modelVersion: bundle.version,
                    })),
                  ),
                  "text/csv",
                )
              }
            >
              Export displayed forecast
            </button>
          </div>
          <details className="advanced-panel">
            <summary>Replace model (advanced)</summary>
            <p>
              Keep the published model for routine review. A replacement changes
              local forecasts after validation.
            </p>
            <label>
              Import model JSON
              <input
                type="file"
                disabled={readOnly}
                accept=".json"
                onChange={async (e) => {
                  try {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 32 * 1024 * 1024)
                      throw Error("Maximum model size is 32 MB.");
                    await save(
                      "furnace-model",
                      JSON.parse(await f.text()),
                      "model import",
                      version,
                    );
                    setNotice("Validated model saved locally.");
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              />
            </label>
          </details>
          <DataTable rows={history} caption="Observed furnace history" />
          {furnace.reference_history && (
            <>
              <h2>Original recorded history</h2>
              <p>
                Source timestamps are retained. These records precede the 2026
                simulation; missing measurements remain blank.
              </p>
              <FerriqTrendChart
                title="Original recorded pass maximum"
                unit="°C"
                series={[
                  {
                    name: "Recorded pass maximum",
                    kind: "measured",
                    data: furnace.reference_history.map((row) => [
                      timestamp(row.t),
                      typeof row[`skin_max_p${pass}`] === "number"
                        ? Number(row[`skin_max_p${pass}`])
                        : null,
                    ]),
                  },
                ]}
              />
              <DataTable
                rows={furnace.reference_history}
                caption="Original dated furnace records"
              />
            </>
          )}
        </>
      )}
      {tab === "Engineering manual" && (
        <>
          <p>
            Current model {bundle.version}; trained {bundle.trained_at}. History
            and forecast both show the maximum reading over that pass's
            thermocouples. The measured-status alarm criterion (470 °C) differs
            from the forecast reference ({bundle.alarm_threshold_c} °C); both
            are used and are labelled separately throughout.
          </p>
          <ReferenceManual id="furnace-skin-temp" />
        </>
      )}
    </>
  );
}
