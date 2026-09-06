import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { EquipmentHeader } from "../components/EquipmentHeader";
import { EngineeringFinding } from "../components/EngineeringFinding";
import { MetricCard } from "../components/MetricCard";
import { TrendRangeSelector } from "../components/TrendRangeSelector";
import { FerriqTrendChart, type ChartSeries } from "../components/FerriqTrendChart";
import { CalculationBasisDialog } from "../components/CalculationBasisDialog";
import { resolveTimeRange, rangeContextLabel, SITE_TIMEZONE } from "../lib/timeRange";
import type { TimeRangeId } from "../engineering/types";
import { HEATER_DEMO_DATA } from "../engineering/heater/demoData";
import { calcHeaterRow, buildHeaterAlerts, rollUpHeaterSeverity, DEFAULT_HEATER_CONFIG } from "../engineering/heater/calculations";
import { toEquipmentState } from "../engineering/blower/calculations";

export function FiredHeaterPage() {
  const [range, setRange] = useState<TimeRangeId>("24h");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allRows = useMemo(() => HEATER_DEMO_DATA.map((r) => calcHeaterRow(r, DEFAULT_HEATER_CONFIG)), []);
  const latest = allRows[allRows.length - 1];
  const alerts = useMemo(() => buildHeaterAlerts(latest, DEFAULT_HEATER_CONFIG), [latest]);
  const severity = rollUpHeaterSeverity(alerts);
  const state = toEquipmentState(severity);

  const datasetNow = useMemo(() => DateTime.fromFormat(latest.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }), [latest]);
  const timeRange = useMemo(() => resolveTimeRange(range, datasetNow, customRange), [range, datasetNow, customRange]);

  const windowRows = allRows.filter((r) => {
    const t = DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toJSDate();
    return t >= timeRange.start && t <= timeRange.end;
  });

  const chartSeries: ChartSeries[] = [{
    name: "Heat-balance efficiency", kind: "measured",
    data: windowRows.map((r) => [DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toMillis(), r.etaHeatBalancePct]),
  }, {
    name: "PTC4 indirect efficiency", kind: "prediction",
    data: windowRows.map((r) => [DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toMillis(), r.etaPtc4Pct]),
  }];

  return (
    <>
      <EquipmentHeader
        name="Fired Heater"
        meta="H-401 · Gas-fired process heater"
        freshness="Illustrative sample series (not live)"
        state={state}
        rangeControl={<TrendRangeSelector value={range} onChange={setRange} contextLabel={rangeContextLabel(timeRange) || undefined} onApplyCustom={(s, e) => setCustomRange({ start: new Date(s), end: new Date(e) })} />}
      />
      <EngineeringFinding
        headline={severity === "ok" ? "Efficiency within expected range" : `${alerts[0]?.message ?? "Engineering review flagged"}`}
        sub={`Heat-balance ${latest.etaHeatBalancePct?.toFixed(1) ?? "—"}% · PTC4 indirect ${latest.etaPtc4Pct?.toFixed(1) ?? "—"}% · Δ ${latest.etaDeltaPp?.toFixed(1) ?? "—"} pp`}
      />
      <div className="section-heading-row">
        <h2 className="section-heading">Key metrics</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Heat-balance efficiency" value={latest.etaHeatBalancePct?.toFixed(1) ?? "—"} unit="%" emphasis state={state} facts={[{ rest: "API 560 §5.4" }]} />
        <MetricCard label="PTC4 indirect efficiency" value={latest.etaPtc4Pct?.toFixed(1) ?? "—"} unit="%" facts={[{ rest: "ASME PTC 4" }]} />
        <MetricCard label="Excess air" value={latest.excessAirPct?.toFixed(1) ?? "—"} unit="%" facts={[{ rest: "ASME PTC 4 App. A" }]} />
        <MetricCard label="Bridgewall temperature" value={latest.bridgewallAvgC?.toFixed(0) ?? "—"} unit="°C" />
      </div>
      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-title">Efficiency — {range}</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-swatch measured" />Heat-balance</div>
            <div className="legend-item"><span className="legend-swatch prediction" />PTC4 indirect</div>
          </div>
        </div>
        <FerriqTrendChart series={chartSeries} unit="%" />
      </div>
      <h2 className="section-heading">Calculation inputs</h2>
      <div className="context-grid">
        <div className="context-item"><div className="context-label">Stack O2</div><div className="context-value">{HEATER_DEMO_DATA[HEATER_DEMO_DATA.length - 1].stackO2Pct?.toFixed(2)}<span className="context-unit">%</span></div></div>
        <div className="context-item"><div className="context-label">Stack temperature</div><div className="context-value">{HEATER_DEMO_DATA[HEATER_DEMO_DATA.length - 1].stackTempC?.toFixed(0)}<span className="context-unit">°C</span></div></div>
        <div className="context-item"><div className="context-label">Dry-gas loss</div><div className="context-value">{latest.dryLossPct?.toFixed(1) ?? "—"}<span className="context-unit">pp</span></div></div>
        <div className="context-item"><div className="context-label">Moisture loss</div><div className="context-value">{latest.moistureLossPct?.toFixed(2) ?? "—"}<span className="context-unit">pp</span></div></div>
      </div>
      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "Heat-balance efficiency", paragraphs: ["η = Q_absorbed / Q_LHV × 100%. Full combustion heat balance across fuel, combustion air, stack, and radiation loss.", "Reference: API 560 §5.4."] },
          { heading: "PTC4 indirect (loss-method) efficiency", paragraphs: ["η = 100 − dry-gas loss − moisture loss − radiation loss − unaccounted loss.", "Reference: ASME PTC 4 §5.2–5.5."] },
          { heading: "Excess air", paragraphs: ["EA = 100 × O₂_dry / (20.95 − O₂_dry), from measured stack O₂.", "Reference: ASME PTC 4 Appendix A."] },
          { heading: "Fuel composition", paragraphs: [`Active blend: ${DEFAULT_HEATER_CONFIG.fuelCase}.`, "A 17-component combustion model (not a fixed natural-gas assumption) drives stoichiometric air/O2/H2O — see the plant's named fuel-gas cases and custom blend builder."] },
        ]}
      />
    </>
  );
}
