import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { EquipmentHeader } from "../components/EquipmentHeader";
import { EngineeringFinding } from "../components/EngineeringFinding";
import { MetricCard } from "../components/MetricCard";
import { TrendRangeSelector } from "../components/TrendRangeSelector";
import { FerriqTrendChart, type ChartSeries } from "../components/FerriqTrendChart";
import { CalculationBasisDialog } from "../components/CalculationBasisDialog";
import { DataQualityNotice } from "../components/DataQualityNotice";
import { resolveTimeRange, rangeContextLabel, SITE_TIMEZONE } from "../lib/timeRange";
import type { TimeRangeId } from "../engineering/types";
import { BLOWER_DEMO_DATA } from "../engineering/blower/demoData";
import {
  processBlowerRow, DEFAULT_BLOWER_SETTINGS, DEFAULT_BLOWER_LIMITS, toEquipmentState,
  type BlowerRowInput, type BlowerRowSuccess,
} from "../engineering/blower/calculations";

function toRowInput(r: (typeof BLOWER_DEMO_DATA)[number]): BlowerRowInput {
  return {
    timestamp: r.Date,
    motorCurrentA: r["Motor Current A"], motorCurrentB: r["Motor Current B"],
    suctionPressureA: r["Suction Press A"], suctionPressureB: r["Suction Press B"],
    dischargePressureA: r["Discharge Press A"], dischargePressureB: r["Discharge Press B"],
    controllerSpA: r["Controller SP A"], controllerSpB: r["Controller SP B"],
    bypassOpA: r["Bypass OP A"], bypassOpB: r["Bypass OP B"],
    filterDpA: r["Filter DP A"], filterDpB: r["Filter DP B"],
    totalFlowNm3hr: r["Total Flow"], suctionTempC: r["Suction Temp"],
    dischargeTempA: r["Discharge Temp A"], dischargeTempB: r["Discharge Temp B"],
    vibrationA: [r["Vibration A1"] ?? NaN, r["Vibration A2"] ?? NaN, r["Vibration A3"] ?? NaN, r["Vibration A4"] ?? NaN],
    vibrationB: [r["Vibration B1"] ?? NaN, r["Vibration B2"] ?? NaN, r["Vibration B3"] ?? NaN, r["Vibration B4"] ?? NaN],
    bearingTempA: [r["Bearing Temp A1"], r["Bearing Temp A2"]],
    bearingTempB: [r["Bearing Temp B1"], r["Bearing Temp B2"]],
  };
}

function rollingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function AirBlowerPage() {
  const [range, setRange] = useState<TimeRangeId>("24h");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allRows = useMemo(() => {
    const results = BLOWER_DEMO_DATA.map((r) => processBlowerRow(toRowInput(r), DEFAULT_BLOWER_SETTINGS, DEFAULT_BLOWER_LIMITS, null))
      .filter((r): r is BlowerRowSuccess => !r.drop);
    return results;
  }, []);

  const latest = allRows[allRows.length - 1];

  // Cutoff math anchors to the latest timestamp IN THE DATASET, not the
  // wall clock, so historical CSVs/demo data behave the same way live
  // data would (matches the original engine's documented behavior).
  const datasetNow = useMemo(
    () => DateTime.fromFormat(latest?.timestamp ?? "", "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }),
    [latest],
  );
  const timeRange = useMemo(() => resolveTimeRange(range, datasetNow, customRange), [range, datasetNow, customRange]);

  const windowRows = useMemo(() => allRows.filter((r) => {
    const t = DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toJSDate();
    return t >= timeRange.start && t <= timeRange.end;
  }), [allRows, timeRange]);

  const effSeriesAll = allRows.map((r) => r.efficiencyPolytropicPct);
  const baselineAll = rollingAverage(effSeriesAll.map((v) => (isNaN(v) ? 0 : v)), 7);

  const chartSeries: ChartSeries[] = useMemo(() => {
    const points: [number, number | null][] = windowRows.map((r) => [
      DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss").toMillis(),
      isNaN(r.efficiencyPolytropicPct) ? null : r.efficiencyPolytropicPct,
    ]);
    const baselinePoints: [number, number | null][] = windowRows.map((r) => {
      const idx = allRows.indexOf(r);
      return [DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss").toMillis(), baselineAll[idx]];
    });
    return [
      { name: "Polytropic efficiency", kind: "measured", data: points },
      { name: "7-day rolling baseline", kind: "baseline", data: baselinePoints },
    ];
  }, [windowRows, allRows, baselineAll]);

  if (!latest) {
    return (
      <>
        <EquipmentHeader name="Air Blower" meta="C-101A/B" freshness="No data" state="data-issue" />
        <p>No processable rows in the demo dataset.</p>
      </>
    );
  }

  const state = toEquipmentState(latest.severity);
  const usingFallback = latest.efficiencyMethodUsed.includes("fallback");

  return (
    <>
      <EquipmentHeader
        name="Air Blower"
        meta={`C-101A/B · Dual-train centrifugal blower · Active train ${latest.activeBlower}`}
        freshness="Demo dataset (not live)"
        state={state}
        rangeControl={
          <TrendRangeSelector
            value={range}
            onChange={setRange}
            contextLabel={rangeContextLabel(timeRange) || undefined}
            onApplyCustom={(s, e) => setCustomRange({ start: new Date(s), end: new Date(e) })}
          />
        }
      />

      <EngineeringFinding
        headline={state === "normal" ? "Polytropic efficiency within expected range" : "Polytropic efficiency below rolling baseline"}
        sub={`${latest.efficiencyHeadlinePct.toFixed(1)}% current · Method: ${latest.efficiencyMethodUsed}`}
      />

      <div className="section-heading-row">
        <h2 className="section-heading">Key metrics</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label={`Headline efficiency (${latest.efficiencyMethodUsed})`}
          value={isNaN(latest.efficiencyHeadlinePct) ? "—" : latest.efficiencyHeadlinePct.toFixed(1)}
          unit="%"
          emphasis
          state={state}
          facts={[{ rest: "ASME PTC 10 §5.4a" }]}
        />
        <MetricCard
          label="Isentropic efficiency"
          value={isNaN(latest.efficiencyIsentropicPct) ? "—" : latest.efficiencyIsentropicPct.toFixed(1)}
          unit="%"
        />
        <MetricCard
          label="Fluid-power indicator"
          value={isNaN(latest.efficiencyFluidPct) ? "—" : latest.efficiencyFluidPct.toFixed(1)}
          unit="%"
          facts={[{ rest: "Trend indicator" }]}
        />
        <MetricCard label="Shaft power" value={latest.powerKw.toFixed(0)} unit="kW" />
      </div>

      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-title">Polytropic efficiency — {range}</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-swatch measured" />Actual</div>
            <div className="legend-item"><span className="legend-swatch baseline" />7-day rolling baseline</div>
          </div>
        </div>
        <FerriqTrendChart series={chartSeries} unit="%" />
      </div>

      <h2 className="section-heading">Calculation inputs</h2>
      <div className="context-grid">
        <div className="context-item"><div className="context-label">Pressure ratio (P₂/P₁)</div><div className="context-value">{latest.pressureRatio.toFixed(2)}</div></div>
        <div className="context-item"><div className="context-label">Blower ΔP</div><div className="context-value">{latest.dpBar.toFixed(2)}<span className="context-unit">bar</span></div></div>
        <div className="context-item"><div className="context-label">Total flow</div><div className="context-value">{latest.flowNm3hr.toLocaleString()}<span className="context-unit">Nm³/hr</span></div></div>
        <div className="context-item"><div className="context-label">T1 used</div><div className="context-value">{latest.t1CUsed.toFixed(1)}<span className="context-unit">°C ({latest.t1Source})</span></div></div>
      </div>

      <h2 className="section-heading">Mechanical health</h2>
      <div className="health-grid">
        <div className="health-card">
          <div className="health-top">
            <span className="health-name">Max vibration</span>
            <span className="health-value">{latest.maxVibrationMms.toFixed(2)} <span className="metric-unit">mm/s</span></span>
          </div>
          <div className="health-bar-track"><div className="health-bar-fill" style={{ width: `${Math.min(100, (latest.maxVibrationMms / DEFAULT_BLOWER_LIMITS.vibTripMms) * 100)}%` }} /></div>
          <div className="health-zones"><span>0</span><span>Advisory {DEFAULT_BLOWER_LIMITS.vibAdvisoryMms}</span><span>Alarm {DEFAULT_BLOWER_LIMITS.vibAlarmMms}</span><span>Trip {DEFAULT_BLOWER_LIMITS.vibTripMms}</span></div>
        </div>
        <div className="health-card">
          <div className="health-top">
            <span className="health-name">Max bearing temperature</span>
            <span className="health-value">{latest.maxBearingTempC.toFixed(1)} <span className="metric-unit">°C</span></span>
          </div>
          <div className="health-bar-track"><div className="health-bar-fill" style={{ width: `${Math.min(100, (latest.maxBearingTempC / DEFAULT_BLOWER_LIMITS.brgTripC) * 100)}%` }} /></div>
          <div className="health-zones"><span>0</span><span>Advisory {DEFAULT_BLOWER_LIMITS.brgAdvisoryC}</span><span>Alarm {DEFAULT_BLOWER_LIMITS.brgAlarmC}</span><span>Trip {DEFAULT_BLOWER_LIMITS.brgTripC}</span></div>
        </div>
      </div>

      <DataQualityNotice items={[
        ...(latest.t1Source !== "measured" ? [{ kind: "data-quality" as const, message: `T1 uses configured ${DEFAULT_BLOWER_SETTINGS.suctionTempFallbackC}°C fallback, not a live reading. Efficiency results are indicative.` }] : []),
        ...(usingFallback ? [{ kind: "data-quality" as const, message: "Discharge temperature unavailable for the active train — thermodynamic efficiencies (isentropic, polytropic) cannot be computed; headline metric has fallen back to the fluid-power indicator." }] : []),
      ]} />

      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "Polytropic efficiency", paragraphs: [
            "Headline metric. σ = ln(T₂/T₁) / ln(P₂/P₁); η_p = ((k−1)/k) / σ. Independent of compression ratio — used for cross-machine comparison and degradation tracking.",
            "Inputs: suction/discharge temperature and pressure, gas exponent k = 1.40 (air, ASHRAE).",
            "Reference: ASME PTC 10 §5.4a, API 617.",
          ] },
          { heading: "Isentropic efficiency", paragraphs: [
            "Adiabatic comparison. η_s = T₁·[(P₂/P₁)^((k−1)/k) − 1] / (T₂ − T₁). Always ≤ polytropic for a compressor; shown as a cross-check, not the headline.",
            "Reference: ASME PTC 10 §5.4.",
          ] },
          { heading: "Fluid-power indicator", paragraphs: [
            "P_fluid = Q · ΔP / 36 (kW); η_fluid = P_fluid / shaft power. An incompressible-flow hydraulic ratio, used as a trending engineering indicator only — not a thermodynamically correct compressor efficiency.",
            "Limitation: can exceed 100% under some conditions; that is a data-quality signal, not a clamping error.",
          ] },
          { heading: "Shaft power", paragraphs: [
            "P = √3 · V · I · PF / 1000 (kW), standard 3-phase motor input power.",
            `Inputs: V = ${DEFAULT_BLOWER_SETTINGS.motorVoltageV} V (motor datasheet), PF = ${DEFAULT_BLOWER_SETTINGS.powerFactor} (nameplate) — replace with measured PF if available.`,
          ] },
          { heading: "Mechanical health references", paragraphs: [
            `Vibration: ISO 10816-3, Group 1 (rigid foundation, >300 kW) — advisory ${DEFAULT_BLOWER_LIMITS.vibAdvisoryMms}, alarm ${DEFAULT_BLOWER_LIMITS.vibAlarmMms}, trip ${DEFAULT_BLOWER_LIMITS.vibTripMms} mm/s RMS.`,
            `Bearing temperature: manufacturer datasheet, oil-lubricated journal bearings — advisory ${DEFAULT_BLOWER_LIMITS.brgAdvisoryC}°C, alarm ${DEFAULT_BLOWER_LIMITS.brgAlarmC}°C, trip ${DEFAULT_BLOWER_LIMITS.brgTripC}°C.`,
          ] },
          { heading: "Scope", paragraphs: [
            "Reference-grade proof of concept. Not a control system, not an SIS, not a substitute for a formal ASME PTC 10 acceptance test.",
          ] },
        ]}
      />
    </>
  );
}
