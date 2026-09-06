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
import { EXCHANGER_DEMO_DATA } from "../engineering/exchanger/demoData";
import { calcExchangerRow, buildExchangerAlerts, rollUpExchangerSeverity, DEFAULT_EXCHANGER_CONFIG } from "../engineering/exchanger/calculations";
import { toEquipmentState } from "../engineering/blower/calculations";

export function ShellTubeExchangerPage() {
  const [range, setRange] = useState<TimeRangeId>("24h");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allRows = useMemo(() => EXCHANGER_DEMO_DATA.map((r) => calcExchangerRow(r, DEFAULT_EXCHANGER_CONFIG)), []);
  const latest = allRows[allRows.length - 1];
  const alerts = useMemo(() => buildExchangerAlerts(latest, DEFAULT_EXCHANGER_CONFIG), [latest]);
  const severity = rollUpExchangerSeverity(alerts);
  const state = toEquipmentState(severity);

  const datasetNow = useMemo(() => DateTime.fromFormat(latest.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }), [latest]);
  const timeRange = useMemo(() => resolveTimeRange(range, datasetNow, customRange), [range, datasetNow, customRange]);

  const windowRows = allRows.filter((r) => {
    const t = DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toJSDate();
    return t >= timeRange.start && t <= timeRange.end;
  });

  const chartSeries: ChartSeries[] = [{
    name: "Fouling resistance (Rf)", kind: "measured",
    data: windowRows.map((r) => [DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toMillis(), r.rfE4]),
  }];

  return (
    <>
      <EquipmentHeader
        name="Shell & Tube Exchanger"
        meta="E-201 · Crude preheater · TEMA RCB, 2 shell passes"
        freshness="Illustrative sample series (not live)"
        state={state}
        rangeControl={<TrendRangeSelector value={range} onChange={setRange} contextLabel={rangeContextLabel(timeRange) || undefined} onApplyCustom={(s, e) => setCustomRange({ start: new Date(s), end: new Date(e) })} />}
      />
      <EngineeringFinding
        headline={severity === "ok" ? "Fouling within expected range" : (alerts[0]?.message ?? "Engineering review flagged")}
        sub={`Rf ${latest.rfE4?.toFixed(2) ?? "—"}×10⁻⁴ m²·K/W · U ${latest.uDirtyWm2k?.toFixed(0) ?? "—"} W/m²K · Effectiveness ${latest.effectivenessPct?.toFixed(1) ?? "—"}%`}
      />
      <div className="section-heading-row">
        <h2 className="section-heading">Key metrics</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Fouling resistance (Rf)" value={latest.rfE4?.toFixed(2) ?? "—"} unit="×10⁻⁴ m²·K/W" emphasis state={state} facts={[{ rest: "TEMA §RGP-T-2.4" }]} />
        <MetricCard label="Overall U (dirty)" value={latest.uDirtyWm2k?.toFixed(0) ?? "—"} unit="W/m²·K" facts={[{ bold: DEFAULT_EXCHANGER_CONFIG.uCleanWm2k.toString(), rest: " W/m²K clean baseline" }]} />
        <MetricCard label="Effectiveness (ε)" value={latest.effectivenessPct?.toFixed(1) ?? "—"} unit="%" />
        <MetricCard label="Energy imbalance" value={latest.imbalancePct?.toFixed(1) ?? "—"} unit="%" />
      </div>
      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-title">Fouling resistance — {range}</div>
          <div className="chart-legend"><div className="legend-item"><span className="legend-swatch measured" />Rf</div></div>
        </div>
        <FerriqTrendChart series={chartSeries} unit="×10⁻⁴ m²·K/W" constraints={[
          { name: `Advisory ${DEFAULT_EXCHANGER_CONFIG.rfAdvisoryE4}`, value: DEFAULT_EXCHANGER_CONFIG.rfAdvisoryE4 },
          { name: `Alarm ${DEFAULT_EXCHANGER_CONFIG.rfAlarmE4}`, value: DEFAULT_EXCHANGER_CONFIG.rfAlarmE4 },
        ]} />
      </div>
      <h2 className="section-heading">Calculation inputs</h2>
      <div className="context-grid">
        <div className="context-item"><div className="context-label">LMTD</div><div className="context-value">{latest.lmtdC?.toFixed(1) ?? "—"}<span className="context-unit">°C</span></div></div>
        <div className="context-item"><div className="context-label">F correction factor</div><div className="context-value">{latest.fFactor?.toFixed(3) ?? "—"}</div></div>
        <div className="context-item"><div className="context-label">Approach (hot end)</div><div className="context-value">{latest.approachHotC?.toFixed(1) ?? "—"}<span className="context-unit">°C</span></div></div>
        <div className="context-item"><div className="context-label">Approach (cold end)</div><div className="context-value">{latest.approachColdC?.toFixed(1) ?? "—"}<span className="context-unit">°C</span></div></div>
      </div>
      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "LMTD & correction factor", paragraphs: ["LMTD = (ΔT₁ − ΔT₂) / ln(ΔT₁/ΔT₂). F is the TEMA general N-shell-pass correction factor (Bowman/Mueller method), not a fixed 0.90 — it is solved from P, R, and the configured shell-pass count.", "Reference: Kern (1950); Bowman, Mueller & Nagle (1940); TEMA §T-3.1."] },
          { heading: "Overall U & fouling resistance", paragraphs: [`U = Q_avg×1000 / (A × F × LMTD), with A = ${DEFAULT_EXCHANGER_CONFIG.areaM2} m² and clean baseline U = ${DEFAULT_EXCHANGER_CONFIG.uCleanWm2k} W/m²·K.`, "Rf = 1/U_dirty − 1/U_clean."] },
          { heading: "Effectiveness", paragraphs: ["ε = Q_avg / (C_min × (T_hot,in − T_cold,in)) × 100%, an NTU-style effectiveness proxy independent of the LMTD correction."] },
        ]}
      />
    </>
  );
}
