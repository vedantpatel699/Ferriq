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
  const { data: bundle, version } =
      useResource<FurnaceModelBundle>("furnace-model"),
    { save } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const key = params.get("furnace") ?? Object.keys(bundle.furnaces)[0];
  const furnace = bundle.furnaces[key] ?? Object.values(bundle.furnaces)[0];
  const pass = Math.max(
    1,
    Math.min(furnace.passes, Number(params.get("pass")) || 1),
  );
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
      forecastPass(furnace, i + 1, current, history, bundle.alarm_threshold_c),
    );
  }, [furnace, bundle.alarm_threshold_c]);
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
  const last = timestamp(furnace.history.at(-1)!.t),
    cut = last - days * 86400000;
  const history = furnace.history.filter((h) => timestamp(h.t) >= cut);
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
  const selectedDriver=drivers.includes(driver)?driver:drivers[0];
  return (
    <>
      <EquipmentHeader
        name="Furnace Skin TI Predictor"
        meta={`${furnace.label} · Pass ${pass}`}
        freshness={`Observation ${DateTime.fromMillis(last, { zone: "America/Edmonton" }).toFormat("LLL d, yyyy HH:mm")} Edmonton · Model trained ${bundle.trained_at}`}
        state={toEquipmentState(statusForSkin(r.skinNowC, r.hoursToAlarm))}
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
          Display horizon
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
          <section className="finding">
            <h2>
              {r.skinNowC >= 470
                ? "Measured skin temperature meets the original alarm review criterion"
                : r.skinNowC >= 460
                  ? "Measured skin temperature meets the original advisory review criterion"
                  : "Review projected approach to the configured reference"}
            </h2>
            <p>
              Current hottest pass thermocouple: {formatNumber(r.skinNowC, 1)}{" "}
              °C. Median projection to {bundle.alarm_threshold_c} °C:{" "}
              {eta(r.hoursToAlarm)}. Upper-band projection:{" "}
              {eta(r.hoursToAlarmUpperBand)}.
            </p>
          </section>
          <p>
            Original measured status criteria: advisory 460 °C; alarm 470 °C.
            Forecast reference: {bundle.alarm_threshold_c} °C. These distinct
            inherited criteria are preserved and explicitly labelled.
          </p>
          <div className="chart-card">
            <FerriqTrendChart
              key={key + pass + days}
              title="Hottest thermocouple in pass: history and forecast"
              unit="°C"
              digits={1}
              nowBoundary={last}
              series={[
                {
                  name: "Measured pass maximum",
                  kind: "measured",
                  data: measured,
                },
                {
                  name: "Forecast P50 pass maximum",
                  kind: "prediction",
                  data: predicted,
                },
              ]}
              uncertainty={{
                lower: [
                  [last, r.skinNowC],
                  ...projection.map(
                    (f) => [last + f.day * 86400000, f.p10] as [number, number],
                  ),
                ],
                upper: [
                  [last, r.skinNowC],
                  ...projection.map(
                    (f) => [last + f.day * 86400000, f.p90] as [number, number],
                  ),
                ],
              }}
              constraints={[
                { name: "Measured advisory", value: 460 },
                { name: "Measured alarm criterion", value: 470 },
                { name: "Forecast reference", value: bundle.alarm_threshold_c },
              ]}
            />
          </div>
          <p className="source-note">
            P10–P90 is the model interval, not a guaranteed safety envelope. All
            horizon estimates use the full 2,555-day internal projection.
            Operating drivers are held at their snapshot assumptions; extended
            forecasts require engineering review.
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
                  typeof row[selectedDriver] === "number" ? Number(row[selectedDriver]) : null,
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
            <DataTable
              rows={[model.metrics]}
              caption="Original model holdout metrics"
            />
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
          <label>
            Import model JSON
            <input
              type="file"
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
          <DataTable rows={history} caption="Observed furnace history" />
        </>
      )}
      {tab === "Engineering manual" && (
        <>
          <p>
            Current model {bundle.version}; trained {bundle.trained_at}.
            Numerical feature indices, quantile trees and long-horizon
            calculation follow the original HTML engine. Current history and
            forecast both show the maximum over pass thermocouples. The original
            470 °C status criterion differs from the {bundle.alarm_threshold_c}{" "}
            °C forecast reference.
          </p>
          <ReferenceManual id="furnace-skin-temp" />
        </>
      )}
    </>
  );
}
