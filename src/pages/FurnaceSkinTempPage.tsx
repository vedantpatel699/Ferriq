import { useEffect, useMemo, useState } from "react";
import { EquipmentHeader } from "../components/EquipmentHeader";
import { EngineeringFinding } from "../components/EngineeringFinding";
import { MetricCard } from "../components/MetricCard";
import { FerriqTrendChart, type ChartSeries } from "../components/FerriqTrendChart";
import { CalculationBasisDialog } from "../components/CalculationBasisDialog";
import { LoadingState, ErrorState } from "../components/EmptyState";
import {
  forecastPass, statusForSkin, type FurnaceModelBundle, INTERNAL_HORIZON_DAYS,
} from "../engineering/furnace/calculations";
import { toEquipmentState } from "../engineering/blower/calculations";

function fmtHours(h: number | null): string {
  if (h === null || !isFinite(h)) return "Not expected within 7 years";
  if (h < 0) return "0h";
  if (h < 48) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} d`;
  return `${(h / 24).toFixed(0)} d`;
}

export function FurnaceSkinTempPage() {
  const [bundle, setBundle] = useState<FurnaceModelBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/data/furnace-skin-temp-model.json")
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(setBundle)
      .catch((e) => setError(String(e)));
  }, []);

  const furnace = bundle?.furnaces["heater_1"];

  const passResult = useMemo(() => {
    if (!bundle || !furnace) return null;
    const tcAliases = Object.keys(furnace.tc_models).filter((a) => furnace.tc_models[a].pass === 1);
    const historyByAlias: Record<string, number[]> = {};
    for (const alias of tcAliases) {
      historyByAlias[alias] = furnace.history.map((row) => row[alias] as number).filter((v) => v !== null && v !== undefined);
    }
    const latestRow = furnace.history[furnace.history.length - 1];
    const currentState: Record<string, number> = {};
    for (const k in latestRow) { const v = latestRow[k]; if (typeof v === "number") currentState[k] = v; }
    return forecastPass(furnace, 1, currentState, historyByAlias, bundle.alarm_threshold_c);
  }, [bundle, furnace]);

  if (error) return <ErrorState title="Could not load the trained forecast model" detail={error} />;
  if (!bundle || !furnace || !passResult) return <LoadingState label="Loading trained forecast model…" />;

  const severity = statusForSkin(passResult.skinNowC, passResult.hoursToAlarm);
  const state = toEquipmentState(severity);

  // Anchor "now" to the model's own last historical timestamp, not the
  // wall clock — the trained bundle is a point-in-time snapshot, and
  // fabricating dates relative to real "now" would misrepresent when the
  // data actually ends (same principle as the equipment dashboards'
  // dataset-anchored time ranges).
  const skinAlias = Object.keys(furnace.tc_models).find((a) => furnace.tc_models[a].pass === 1);
  const lastHistoryTs = new Date(String(furnace.history[furnace.history.length - 1].t).replace(" ", "T") + "Z").getTime();

  const displayDays = 30; // chart display window; forecast tile values always use the full 7-year internal horizon
  const history = furnace.history.slice(-displayDays).map((row) => ({
    t: new Date(String(row.t).replace(" ", "T") + "Z").getTime(),
    v: skinAlias ? (row[skinAlias] as number) : null,
  }));
  const forecastSlice = passResult.forecast.slice(0, displayDays);

  const chartSeries: ChartSeries[] = [
    { name: "Measured skin TI", kind: "measured", data: history.map((h) => [h.t, h.v]) },
    { name: "Forecast (P50)", kind: "prediction", data: forecastSlice.map((f) => [lastHistoryTs + f.day * 24 * 3600 * 1000, f.value]) },
  ];

  return (
    <>
      <EquipmentHeader
        name="Furnace Skin TI Predictor"
        meta={`${furnace.label} · Pass 1`}
        freshness={`Model trained ${bundle.trained_at}`}
        state={state}
        rangeControl={undefined}
      />
      <EngineeringFinding
        headline={severity === "ok" ? "Skin temperature trajectory within margin" : "Skin temperature trending toward alarm threshold"}
        sub={`${passResult.skinNowC.toFixed(0)}°C current · ${fmtHours(passResult.hoursToAlarm)} to ${bundle.alarm_threshold_c}°C alarm`}
      />
      <div className="section-heading-row">
        <h2 className="section-heading">Key metrics</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Current skin TI" value={passResult.skinNowC.toFixed(0)} unit="°C" emphasis state={state} facts={[{ bold: `${bundle.alarm_threshold_c - passResult.skinNowC >= 0 ? (bundle.alarm_threshold_c - passResult.skinNowC).toFixed(0) : "0"}°C`, rest: " margin to alarm" }]} />
        <MetricCard label="Time to alarm threshold" value={fmtHours(passResult.hoursToAlarm).replace(" h", "").replace(" d", "")} unit={passResult.hoursToAlarm !== null && passResult.hoursToAlarm < 48 ? "h" : (passResult.hoursToAlarm !== null ? "d" : "")} />
        <MetricCard label="7-day mean" value={passResult.skin7dMeanC.toFixed(0)} unit="°C" />
        <MetricCard label="Velocity" value={passResult.skinVelocityCPerDay >= 0 ? `+${passResult.skinVelocityCPerDay.toFixed(2)}` : passResult.skinVelocityCPerDay.toFixed(2)} unit="°C/day" />
      </div>
      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-title">Skin temperature — last {displayDays}d + {displayDays}d forecast</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-swatch measured" />Measured</div>
            <div className="legend-item"><span className="legend-swatch prediction" />Forecast (P50)</div>
          </div>
        </div>
        <FerriqTrendChart series={chartSeries} unit="°C" nowBoundary={lastHistoryTs} constraints={[
          { name: `Advisory ${bundle.advisory_threshold_c}`, value: bundle.advisory_threshold_c },
          { name: `Alarm ${bundle.alarm_threshold_c}`, value: bundle.alarm_threshold_c },
        ]} />
      </div>
      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "Forecast model", paragraphs: [
            "Trained XGBoost quantile-regression trees (P10/P50/P90), one triplet per thermocouple, walked forward step-by-step.",
            `Long-horizon central trajectory is a linear trend from the last 30 days of history (tree models cannot extrapolate beyond their training range); the P10/P90 spread from the trees decorates that trend as a data-driven uncertainty band — never a fabricated one.`,
            `Internal forecast horizon: ${INTERNAL_HORIZON_DAYS} days (~7 years), independent of the chart's display window, so "time to alarm" is stable regardless of what the user is looking at.`,
          ] },
          { heading: "Classification", paragraphs: [
            `Alarm at ${bundle.alarm_threshold_c}°C or when the trajectory is projected to cross it within 24h. Advisory at ${bundle.advisory_threshold_c}°C or within 72h of crossing.`,
          ] },
        ]}
      />
    </>
  );
}
