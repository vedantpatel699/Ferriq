import { AssetScorecard } from "./AssetScorecard";
import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useResource, useWorkspace } from "../lib/WorkspaceContext";
import {
  calculate,
  metricsFor,
  identities,
  normalizeRows,
  type EquipmentData,
  type EquipmentId,
  type Row,
} from "../engineering/catalog";
import { EquipmentHeader } from "./EquipmentHeader";
import { MetricCard } from "./MetricCard";
import { FerriqTrendChart, type ChartSeries } from "./FerriqTrendChart";
import { TrendRangeSelector } from "./TrendRangeSelector";
import { CalculationBasisDialog } from "./CalculationBasisDialog";
import { ReferenceManual } from "./ReferenceManual";
import { DataTable } from "./DataTable";
import { ConfigEditor, type ConfigValue } from "./ConfigEditor";
import { resolveTimeRange, rangeContextLabel } from "../lib/timeRange";
import type { TimeRangeId } from "../engineering/types";
import { formatNumber } from "../lib/format";
import { csv, parseCsv, downloadFile } from "../lib/files";
import {
  FUEL_GAS_CASES,
  FUEL_COMPONENT_PROPS,
} from "../engineering/heater/fuelData";
import { calcCompositionProps } from "../engineering/heater/calculations";
import type { FerriqSettings } from "../lib/settingsStore";
export function EquipmentWorkspace({ id }: { id: EquipmentId }) {
  const resource = useResource<EquipmentData>(id),
    { save, reset, published, snapshot } = useWorkspace(),
    { data: settings } = useResource<FerriqSettings>("settings");
  const data = resource.data,
    rows = useMemo(() => calculate(id, data), [id, data]),
    latest = rows.at(-1)!;
  const metrics = metricsFor(id, data.config, latest);
  const [tab, setTab] = useState("Overview"),
    [range, setRange] = useState<TimeRangeId>("24h"),
    [custom, setCustom] = useState<{ start: Date; end: Date }>(),
    [metricKey, setMetricKey] = useState(""),
    [drawer, setDrawer] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<ConfigValue>(
      structuredClone(data.config) as ConfigValue,
    ),
    [draftVersion, setDraftVersion] = useState(resource.version),
    [pending, setPending] = useState<Row[] | null>(null),
    [filename, setFilename] = useState(""),
    [bounds, setBounds] = useState<{ min?: number; max?: number }>({});
  const finding = latest.alerts[0]?.message ?? "";
  const conditionKey = /Vibration/i.test(finding)
    ? "maxVibrationMms"
    : /Bearing/i.test(finding)
      ? "maxBearingTempC"
      : /Filter/i.test(finding)
        ? "filterDpBar"
        : /Bypass/i.test(finding)
          ? "bypassOpPct"
          : /Blower dP/i.test(finding)
            ? "dpBar"
            : /purity/i.test(finding)
              ? "permeateH2OnlinePct"
              : /ratio/i.test(finding) && id === "membrane-analyzer"
                ? "ratio"
                : /stack/i.test(finding)
                  ? "stackTempC"
                  : "";
  const metric =
    metrics.find((m) => m.key === (metricKey || conditionKey)) ?? metrics[0];
  const period = resolveTimeRange(
    range,
    DateTime.fromMillis(latest.epoch, { zone: "America/Edmonton" }),
    custom,
    settings,
  );
  const selected = rows.filter(
    (r) => r.epoch >= +period.start && r.epoch <= +period.end,
  );
  const series: ChartSeries[] = [
    {
      name: metric.label,
      kind: "measured",
      data: selected.map((r) => [
        r.epoch,
        typeof r.values[metric.key] === "number" &&
        Number.isFinite(r.values[metric.key])
          ? Number(r.values[metric.key])
          : null,
      ]),
    },
  ];
  if (id === "air-blower" && metric.key === "efficiencyPolytropicPct")
    series.push({
      name: "7-day rolling baseline (valid observations)",
      kind: "baseline",
      data: selected.map((r) => {
        const slice = rows.filter(
          (v) =>
            v.epoch >= r.epoch - 7 * 86400000 &&
            v.epoch <= r.epoch &&
            typeof v.values[metric.key] === "number" &&
            Number.isFinite(v.values[metric.key]),
        );
        return [
          r.epoch,
          slice.length >= 2
            ? slice.reduce((a, v) => a + Number(v.values[metric.key]), 0) /
              slice.length
            : null,
        ];
      }),
    });
  if (
    id === "air-blower" &&
    ["maxVibrationMms", "maxBearingTempC"].includes(metric.key)
  ) {
    const field =
      metric.key === "maxVibrationMms" ? "vibration" : "bearingTemp";
    for (const train of ["A", "B"])
      for (let i = 0; i < (field === "vibration" ? 4 : 2); i++)
        series.push({
          name: `Train ${train} probe ${i + 1}`,
          kind: "measured",
          data: selected.map((r) => [
            r.epoch,
            (r.values[field + train] as (number | null)[] | undefined)?.[i] ??
              null,
          ]),
        });
  }
  const limits = [
    ...(metric.limits ?? []),
    ...(metric.reference !== undefined
      ? [
          {
            name: metric.referenceLabel ?? "Reference",
            value: metric.reference,
          },
        ]
      : []),
  ];
  const manual = (
    <>
      <h2>Current status & reference configuration</h2>
      <p>
        Current state: {latest.state.toUpperCase()}. Advisory maps to WATCH;
        alarm/trip maps to INVESTIGATE. The tables below describe the active
        workspace; original manual defaults follow as source reference.
      </p>
      <DataTable
        rows={metrics.flatMap((m) => [
          ...(m.limits ?? []).map((l) => ({
            metric: m.label,
            reference: l.name,
            value: l.value,
            unit: m.unit,
          })),
          ...(m.reference === undefined
            ? []
            : [
                {
                  metric: m.label,
                  reference: m.referenceLabel,
                  value: m.reference,
                  unit: m.unit,
                },
              ]),
        ])}
        caption="Active metric references"
      />
      <ReferenceManual id={id} />
    </>
  );
  const local =
    resource.version !== (published.find((p) => p.key === id)?.version ?? 1);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      setNotice(
        "Saved in this browser. Export changes to publish through GitHub.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <EquipmentHeader
        name={identities[id].name}
        meta={identities[id].tag}
        freshness={`${data.source} · Last observation ${DateTime.fromMillis(latest.epoch, { zone: "America/Edmonton" }).toFormat("LLL d, yyyy HH:mm")} Edmonton · ${local ? "Local changes" : "Published data"}`}
        state={latest.state}
        rangeControl={
          <TrendRangeSelector
            value={range}
            onChange={setRange}
            contextLabel={rangeContextLabel(period)}
            onApplyCustom={(s, e) =>
              setCustom({
                start: DateTime.fromISO(s, {
                  zone: "America/Edmonton",
                }).toJSDate(),
                end: DateTime.fromISO(e, {
                  zone: "America/Edmonton",
                }).toJSDate(),
              })
            }
          />
        }
      />
      <div className="page-tabs" role="group" aria-label="Equipment views">
        {["Overview", "Data & Log", "Configuration", "Engineering manual"].map(
          (t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t);
                if (t === "Configuration") {
                  setDraft(structuredClone(data.config) as ConfigValue);
                  setDraftVersion(resource.version);
                }
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {notice && (
        <p role="status" className="callout">
          {notice}
        </p>
      )}
      {tab === "Overview" && (
        <>
          <section className="finding">
            <h2>
              {latest.alerts[0]?.message ??
                "Within configured reference limits"}
            </h2>
            {latest.quality.map((q) => (
              <p className="quality-note" key={q}>
                {q}
              </p>
            ))}
            {latest.alerts.length > 1 && (
              <details>
                <summary>
                  All engineering conditions ({latest.alerts.length})
                </summary>
                <ul>
                  {latest.alerts.map((a, i) => (
                    <li key={i}>
                      {a.message} <small>Reference: {a.source}</small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <div className="section-heading-row">
            <h2>Current measurements</h2>
            <button onClick={() => setDrawer(true)}>
              Calculation basis & references
            </button>
          </div>
          <p className="source-note">
            Latest observation; the trend window below does not change these
            current values.
          </p>
          {id === "air-blower" ? (
            <AssetScorecard
              metrics={metrics}
              latest={latest}
              windowRows={selected}
              selected={metric.key}
              onSelect={(key) => {
                setMetricKey(key);
                document
                  .getElementById("equipment-trend")
                  ?.scrollIntoView({ block: "start" });
              }}
            />
          ) : (
            <>
              <div className="metrics-grid">
                {metrics.slice(0, id === "fired-heater" ? 8 : 4).map((m) => (
                  <MetricCard
                    key={m.key}
                    label={m.label}
                    value={formatNumber(latest.values[m.key], m.digits ?? 2)}
                    unit={m.unit}
                    facts={
                      m.reference === undefined
                        ? []
                        : [
                            {
                              bold: `${formatNumber(m.reference, 2)} ${m.unit}`,
                              rest: ` ${m.referenceLabel}; deviation ${formatNumber(typeof latest.values[m.key] === "number" ? Number(latest.values[m.key]) - m.reference : null, 2)} ${m.unit === "%" ? "pp" : m.unit}`,
                            },
                          ]
                    }
                  />
                ))}
              </div>
            </>
          )}
          <div className="chart-card" id="equipment-trend">
            <h2>{metric.label}</h2>
            <label className="editor-field">
              Trend metric
              <select
                value={metric.key}
                onChange={(e) => {
                  setMetricKey(e.target.value);
                  setBounds({});
                }}
              >
                {metrics.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.unit || "ratio"})
                  </option>
                ))}
              </select>
            </label>
            <p className="source-note">
              Requested: {period.start.toLocaleDateString("en-CA")}–
              {period.end.toLocaleDateString("en-CA")}. Available in window:{" "}
              {selected.length} observations
              {selected.length
                ? `, ${DateTime.fromMillis(selected[0].epoch).setZone("America/Edmonton").toFormat("LLL d HH:mm")}–${DateTime.fromMillis(selected.at(-1)!.epoch).setZone("America/Edmonton").toFormat("LLL d HH:mm")}`
                : ""}
              . Gaps are not filled.
            </p>
            <FerriqTrendChart
              key={range + metric.key + String(+period.start)}
              title={metric.label}
              series={series}
              unit={metric.unit}
              constraints={limits}
              bounds={
                bounds.min !== undefined &&
                bounds.max !== undefined &&
                bounds.min >= bounds.max
                  ? undefined
                  : bounds
              }
            />
            <p className="source-note">
              Window change:{" "}
              {formatNumber(
                selected.length > 1 &&
                  typeof selected[0].values[metric.key] === "number" &&
                  typeof selected.at(-1)!.values[metric.key] === "number"
                  ? Number(selected.at(-1)!.values[metric.key]) -
                      Number(selected[0].values[metric.key])
                  : null,
                2,
              )}{" "}
              {metric.unit === "%" ? "pp" : metric.unit} (first to last
              observation).
            </p>
            <details>
              <summary>Axis bounds</summary>
              {bounds.min !== undefined &&
                bounds.max !== undefined &&
                bounds.min >= bounds.max && (
                  <p role="alert">
                    Minimum must be below maximum; automatic bounds are shown.
                  </p>
                )}
              <label>
                Minimum
                <input
                  type="number"
                  step="any"
                  value={bounds.min ?? ""}
                  onChange={(e) =>
                    setBounds((b) => ({
                      ...b,
                      min:
                        e.target.value === ""
                          ? undefined
                          : e.target.valueAsNumber,
                    }))
                  }
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  step="any"
                  value={bounds.max ?? ""}
                  onChange={(e) =>
                    setBounds((b) => ({
                      ...b,
                      max:
                        e.target.value === ""
                          ? undefined
                          : e.target.valueAsNumber,
                    }))
                  }
                />
              </label>
              <button onClick={() => setBounds({})}>Automatic bounds</button>
            </details>
          </div>
          <details>
            <summary>All current inputs and calculated results</summary>
            <DataTable
              rows={[latest.values]}
              caption="Current engineering values"
            />
          </details>
        </>
      )}
      {tab === "Data & Log" && (
        <>
          <h2>Observations & calculated data</h2>
          <p>
            CSV imports and configuration edits stay in this browser. The
            published reference is unchanged until a repository update.
          </p>
          <div className="action-bar">
            <button
              onClick={() =>
                downloadFile(
                  id + "-input-template.csv",
                  csv(data.rows.slice(0, 3)),
                  "text/csv",
                )
              }
            >
              Download input template
            </button>
            <button
              onClick={() =>
                downloadFile(id + "-inputs.csv", csv(data.rows), "text/csv")
              }
            >
              Export inputs
            </button>
            <button
              onClick={() =>
                downloadFile(
                  id + "-calculated.csv",
                  csv(
                    selected.map((r) => ({
                      ...r.values,
                      source: data.source,
                      configurationVersion: resource.version,
                      siteTimezone: "America/Edmonton",
                    })),
                  ),
                  "text/csv",
                )
              }
            >
              Export selected results
            </button>
            <button
              onClick={() =>
                downloadFile(
                  id + "-workspace.json",
                  JSON.stringify(
                    { key: id, data, version: resource.version },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              Export dataset & configuration
            </button>
          </div>
          <label>
            Import input CSV
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 16 * 1024 * 1024)
                    throw Error("File exceeds 16 MB.");
                  setPending(normalizeRows(id, parseCsv(await f.text())));
                  setFilename(f.name);
                  setNotice("Review the imported rows before applying.");
                } catch (e) {
                  setPending(null);
                  setNotice((e as Error).message);
                }
              }}
            />
          </label>
          {pending && (
            <>
              <DataTable
                rows={pending.slice(0, 5)}
                caption={`${filename}: preview (${pending.length} rows)`}
              />
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await save(
                      id,
                      {
                        ...data,
                        rows: pending,
                        source: "Imported CSV: " + filename,
                        importedAt: new Date().toISOString(),
                      },
                      "import",
                      resource.version,
                    );
                    setPending(null);
                  })
                }
              >
                Apply imported dataset
              </button>
              <button onClick={() => setPending(null)}>Cancel import</button>
            </>
          )}
          <DataTable
            rows={selected.map((r) => r.values)}
            caption="Selected observation window"
          />
          <h3>Local changes</h3>
          <DataTable
            rows={
              snapshot.events.filter(
                (e) => e.resourceKey === id,
              ) as unknown as Row[]
            }
            caption="Change history"
          />
        </>
      )}
      {tab === "Configuration" && (
        <>
          <h2>Engineering configuration</h2>
          <p>
            These are model assumptions and reference limits, not personal
            display preferences. Saved changes apply consistently across this
            browser's overview and detail pages.
          </p>
          {id === "air-blower" && (
            <p>
              Blower mode: auto, A or B. Efficiency method: polytropic,
              isentropic or fluid. Gamma must exceed1; power factor must be
              between0 and1.
            </p>
          )}
          {id === "fired-heater" && (
            <>
              <label>
                Fuel blend
                <select
                  value={String((draft as Row).fuelCase)}
                  onChange={(e) =>
                    setDraft(
                      (d) =>
                        ({
                          ...(d as object),
                          fuelCase: e.target.value,
                          ...(e.target.value === "Custom"
                            ? {
                                customCase: structuredClone(
                                  FUEL_GAS_CASES[
                                    "Sheet Reference Case (83.64%)"
                                  ],
                                ),
                              }
                            : {}),
                        }) as unknown as ConfigValue,
                    )
                  }
                >
                  {Object.keys(FUEL_GAS_CASES).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                  <option>Custom</option>
                </select>
              </label>
              <details>
                <summary>
                  Fuel component properties and preset compositions
                </summary>
                <DataTable
                  rows={Object.entries(FUEL_COMPONENT_PROPS).map(
                    ([component, v]) => ({ component, ...v }),
                  )}
                  caption="Fuel components"
                />
                <DataTable
                  rows={Object.entries(FUEL_GAS_CASES).map(([blend, v]) => ({
                    blend,
                    ...v,
                  }))}
                  caption="Fuel blend cases"
                />
              </details>
              {String((draft as Row).fuelCase) === "Custom" && (
                <button
                  onClick={() => {
                    const d = draft as Row,
                      c = d.customCase as { fractions: Record<string, number> };
                    const p = calcCompositionProps(c.fractions);
                    setDraft({
                      ...d,
                      customCase: {
                        ...c,
                        averageMw: p.averageMw,
                        lhvMjKg: p.lhvMjKg,
                      },
                    } as ConfigValue);
                  }}
                >
                  Recalculate custom molecular weight & LHV
                </button>
              )}
            </>
          )}
          <ConfigEditor value={draft} onChange={setDraft} />
          <div className="action-bar">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await save(
                    id,
                    { ...data, config: draft },
                    "configuration",
                    draftVersion,
                  );
                  setDraftVersion(draftVersion + 1);
                })
              }
            >
              Save configuration
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await reset(id);
                  setDraftVersion(1);
                  setDraft(
                    structuredClone(
                      published.find((r) => r.key === id)!
                        .data as EquipmentData,
                    ).config as ConfigValue,
                  );
                })
              }
            >
              Restore published dataset & configuration
            </button>
          </div>
        </>
      )}
      {tab === "Engineering manual" && manual}
      <CalculationBasisDialog open={drawer} onClose={() => setDrawer(false)}>
        {manual}
      </CalculationBasisDialog>
    </>
  );
}
