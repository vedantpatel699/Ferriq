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
import { MEMBRANE_DEMO_DATA } from "../engineering/membrane/demoData";
import { calcMembraneRow, buildMembraneAlerts, rollUpMembraneSeverity, synthesizeOnlineFeedH2, DEFAULT_MEMBRANE_CONFIG } from "../engineering/membrane/calculations";
import { toEquipmentState } from "../engineering/blower/calculations";

export function MembraneAnalyzerPage() {
  const [range, setRange] = useState<TimeRangeId>("24h");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasOnlineFeedTag = MEMBRANE_DEMO_DATA.some((r) => r.feedH2OnlinePct !== null);

  const allRows = useMemo(() => {
    let rows = MEMBRANE_DEMO_DATA;
    if (!hasOnlineFeedTag) {
      const synthesized = synthesizeOnlineFeedH2(MEMBRANE_DEMO_DATA.map((r) => r.feedH2LabPct));
      rows = MEMBRANE_DEMO_DATA.map((r, i) => ({ ...r, feedH2OnlinePct: synthesized[i] }));
    }
    return rows.map(calcMembraneRow);
  }, [hasOnlineFeedTag]);

  const latest = allRows[allRows.length - 1];
  const alerts = useMemo(() => buildMembraneAlerts(latest, DEFAULT_MEMBRANE_CONFIG), [latest]);
  const severity = rollUpMembraneSeverity(alerts);
  const state = toEquipmentState(severity);

  const datasetNow = useMemo(() => DateTime.fromFormat(latest.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }), [latest]);
  const timeRange = useMemo(() => resolveTimeRange(range, datasetNow, customRange), [range, datasetNow, customRange]);

  const windowRows = allRows.filter((r) => {
    const t = DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toJSDate();
    return t >= timeRange.start && t <= timeRange.end;
  });

  const chartSeries: ChartSeries[] = [{
    name: "Online recovery", kind: "measured",
    data: windowRows.map((r) => [DateTime.fromFormat(r.timestamp, "yyyy-MM-dd HH:mm:ss", { zone: SITE_TIMEZONE }).toMillis(), r.recoveryOnlinePct]),
  }];

  return (
    <>
      <EquipmentHeader
        name="Membrane Analyzer"
        meta="M-301 · Single-stage H₂-recovery membrane module"
        freshness="Illustrative sample series (not live)"
        state={state}
        rangeControl={<TrendRangeSelector value={range} onChange={setRange} contextLabel={rangeContextLabel(timeRange) || undefined} onApplyCustom={(s, e) => setCustomRange({ start: new Date(s), end: new Date(e) })} />}
      />
      <EngineeringFinding
        headline={severity === "ok" ? "Recovery and purity within expected range" : (alerts[0]?.message ?? "Engineering review flagged")}
        sub={`Recovery ${latest.recoveryOnlinePct?.toFixed(1) ?? "—"}% · Permeate H₂ ${latest.permeateH2OnlinePct?.toFixed(1) ?? "—"}%`}
      />
      <div className="section-heading-row">
        <h2 className="section-heading">Key metrics</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Online H₂ recovery" value={latest.recoveryOnlinePct?.toFixed(1) ?? "—"} unit="%" emphasis state={state} facts={[{ bold: `${DEFAULT_MEMBRANE_CONFIG.designRecoveryPct}%`, rest: " design" }]} />
        <MetricCard label="Permeate H₂ purity (online)" value={latest.permeateH2OnlinePct?.toFixed(1) ?? "—"} unit="%" facts={[{ bold: `${DEFAULT_MEMBRANE_CONFIG.designPermeateH2Pct}%`, rest: " design" }]} />
        <MetricCard label="Lab-verified recovery" value={latest.recoveryLabPct?.toFixed(1) ?? "—"} unit="%" facts={[{ rest: "periodic lab sample" }]} />
        <MetricCard label="Total / non-permeate ratio" value={latest.ratio?.toFixed(2) ?? "—"} facts={[{ bold: DEFAULT_MEMBRANE_CONFIG.ratioAlarm.toFixed(1), rest: " alarm" }]} />
      </div>
      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-title">Online recovery — {range}</div>
          <div className="chart-legend"><div className="legend-item"><span className="legend-swatch measured" />Recovery</div></div>
        </div>
        <FerriqTrendChart series={chartSeries} unit="%" constraints={[{ name: `Floor ${DEFAULT_MEMBRANE_CONFIG.recoveryFloorPct}%`, value: DEFAULT_MEMBRANE_CONFIG.recoveryFloorPct }]} />
      </div>
      <DataQualityNotice items={!hasOnlineFeedTag ? [{ kind: "data-quality", message: "No online feed-H₂ historian tag is wired for this unit — the feed-H₂ value used for online recovery is synthesized by interpolating periodic lab samples, not a live continuous measurement." }] : []} />
      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "Online recovery", paragraphs: ["Recovery = (permeate flow × permeate H₂%) / (feed flow × feed H₂%) × 100%, using the continuous online analyzer readings (feed H₂% synthesized from lab samples when no online tag exists)."] },
          { heading: "Lab-verified recovery", paragraphs: ["Same formula, but only computed when both a lab permeate-H₂ sample and a lab feed-H₂ sample are available for that timestamp — a periodic cross-check against the online reading."] },
          { heading: "Total / non-permeate ratio", paragraphs: [`Total feed flow divided by non-permeate (retentate) flow. At or above ${DEFAULT_MEMBRANE_CONFIG.ratioAlarm} the unit is over-recovering — lower the controller setpoint.`] },
        ]}
      />
    </>
  );
}
