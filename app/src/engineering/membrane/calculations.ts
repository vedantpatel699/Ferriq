// Membrane Analyzer (M-301 H2-recovery module) engineering module — ported
// verbatim from the live membrane-analyzer.html engine. Supersedes
// backend-membrane-analyzer.md, which documents a stage-cut/selectivity/
// permeance/log-mean-driving-pressure model the live app does not run at
// all. The live app instead compares online (continuous-analyzer) and lab
// (periodic-sample) H2 readings against configured design values, and
// notably synthesizes a mock "online feed H2" signal by interpolating lab
// samples — a code comment explains the client never provided an online
// feed-H2 historian tag for this unit.

import type { EngineeringAlert, RawSeverity } from "../types";

export interface MembraneConfig {
  designFeedH2Pct: number; designPermeateH2Pct: number; designRecoveryPct: number;
  designFlowNm3Hr: number; designRatio: number; designFeedPressureKpag: number;
  patmKpa: number;
  recoveryFloorPct: number; purityAdvisoryPct: number; purityAlarmPct: number;
  ratioAlarm: number; feedPressureDeviationPct: number;
}

export const DEFAULT_MEMBRANE_CONFIG: MembraneConfig = {
  designFeedH2Pct: 87.32, designPermeateH2Pct: 95.53, designRecoveryPct: 90.00,
  designFlowNm3Hr: 96277, designRatio: 5.6, designFeedPressureKpag: 15890,
  patmKpa: 93,
  recoveryFloorPct: 75, purityAdvisoryPct: 93, purityAlarmPct: 90,
  ratioAlarm: 6.4, feedPressureDeviationPct: 5,
};

export interface MembraneRowInput {
  timestamp: string;
  feedFlowNm3Hr: number | null;       // q_feed
  nonPermeateFlowNm3Hr: number | null; // q_non_perm (backfilled from feed-permeate if missing)
  permeateFlowNm3Hr: number | null;   // q_perm
  permeateH2OnlinePct: number | null; // y_perm_h2_online
  permeateH2LabPct: number | null;    // y_perm_h2_lab
  feedH2LabPct: number | null;        // y_feed_h2_lab
  feedH2OnlinePct: number | null;     // y_feed_h2_online (synthesized if the historian has no tag)
  feedPressureKpag: number | null;    // p_feed_kpag
}

export interface MembraneRowResult {
  timestamp: string;
  nonPermeateFlowNm3Hr: number | null;
  ratio: number | null;               // total-feed / non-permeate, over-recovery indicator
  recoveryOnlinePct: number | null;
  recoveryLabPct: number | null;
  feedPressureKpag: number | null;
  feedPressureDeviationPct: number | null;
  permeateH2OnlinePct: number | null; permeateH2LabPct: number | null;
  feedH2OnlinePct: number | null; feedH2LabPct: number | null;
  feedFlowNm3Hr: number | null;
}

/** Mirrors the live engine's per-row block inside processBatch (backfill +
 *  ratio + online/lab recovery). Does not synthesize the mock online-feed
 *  signal itself — synthesizeOnlineFeedH2 is a batch-level (whole-series)
 *  concern, applied by the caller before this runs, exactly as in the live
 *  app (only when the dataset has no online feed-H2 tag at all). */
export function calcMembraneRow(r: MembraneRowInput): MembraneRowResult {
  const nonPermeate = r.nonPermeateFlowNm3Hr !== null
    ? r.nonPermeateFlowNm3Hr
    : (r.feedFlowNm3Hr !== null && r.permeateFlowNm3Hr !== null ? r.feedFlowNm3Hr - r.permeateFlowNm3Hr : null);

  const ratio = nonPermeate !== null && nonPermeate > 0 && r.feedFlowNm3Hr !== null ? r.feedFlowNm3Hr / nonPermeate : null;

  const yFeedForOnline = r.feedH2OnlinePct !== null ? r.feedH2OnlinePct : r.feedH2LabPct;
  const recoveryOnlinePct = r.feedFlowNm3Hr && r.permeateFlowNm3Hr && r.permeateH2OnlinePct !== null && yFeedForOnline !== null && yFeedForOnline > 0
    ? ((r.permeateFlowNm3Hr * r.permeateH2OnlinePct) / (r.feedFlowNm3Hr * yFeedForOnline)) * 100
    : null;

  const recoveryLabPct = r.feedFlowNm3Hr && r.permeateFlowNm3Hr && r.permeateH2LabPct !== null && r.feedH2LabPct !== null && r.feedH2LabPct > 0
    ? ((r.permeateFlowNm3Hr * r.permeateH2LabPct) / (r.feedFlowNm3Hr * r.feedH2LabPct)) * 100
    : null;

  return {
    timestamp: r.timestamp,
    nonPermeateFlowNm3Hr: nonPermeate,
    ratio, recoveryOnlinePct, recoveryLabPct,
    feedPressureKpag: r.feedPressureKpag,
    feedPressureDeviationPct: null,
    permeateH2OnlinePct: r.permeateH2OnlinePct, permeateH2LabPct: r.permeateH2LabPct,
    feedH2OnlinePct: r.feedH2OnlinePct, feedH2LabPct: r.feedH2LabPct,
    feedFlowNm3Hr: r.feedFlowNm3Hr,
  };
}

/** Deterministic pseudo-random interpolation of lab feed-H2 samples,
 *  matching the live engine's synthesizeOnlineFeedH2 seed/LCG exactly, so
 *  re-synthesizing the same series is reproducible across sessions. Only
 *  called when a dataset has no online feed-H2 tag at all. */
export function synthesizeOnlineFeedH2(labSeries: (number | null)[]): (number | null)[] {
  const samples: [number, number][] = [];
  labSeries.forEach((v, i) => { if (v !== null) samples.push([i, v]); });
  if (samples.length === 0) return labSeries.map(() => null);

  let seed = 1234;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  return labSeries.map((_, i) => {
    let val: number;
    if (i <= samples[0][0]) val = samples[0][1];
    else if (i >= samples[samples.length - 1][0]) val = samples[samples.length - 1][1];
    else {
      let lo = samples[0], hi = samples[samples.length - 1];
      for (let s = 0; s < samples.length - 1; s++) {
        if (samples[s][0] <= i && samples[s + 1][0] >= i) { lo = samples[s]; hi = samples[s + 1]; break; }
      }
      const span = hi[0] - lo[0];
      const t = span > 0 ? (i - lo[0]) / span : 0;
      val = lo[1] + (hi[1] - lo[1]) * t;
    }
    val = val + (rand() - 0.5) * 0.36;
    return Math.round(val * 100) / 100;
  });
}

export function buildMembraneAlerts(row: MembraneRowResult, cfg: MembraneConfig): EngineeringAlert[] {
  const alerts: EngineeringAlert[] = [];
  if (row.ratio !== null && row.ratio >= cfg.ratioAlarm) {
    alerts.push({ severity: "alarm", message: `Total / Non-Permeate ratio ${row.ratio.toFixed(2)} at or above alarm ${cfg.ratioAlarm.toFixed(2)} - over-recovery, lower controller setpoint.`, source: "recovery ratio controller" });
  }
  if (row.recoveryOnlinePct !== null && row.recoveryOnlinePct < cfg.recoveryFloorPct) {
    alerts.push({ severity: "advisory", message: `Online recovery ${row.recoveryOnlinePct.toFixed(2)} % below floor ${cfg.recoveryFloorPct.toFixed(0)} %.`, source: "recovery target" });
  }
  if (row.permeateH2OnlinePct !== null) {
    if (row.permeateH2OnlinePct < cfg.purityAlarmPct) alerts.push({ severity: "alarm", message: `Permeate H2 ${row.permeateH2OnlinePct.toFixed(2)} % below alarm ${cfg.purityAlarmPct.toFixed(1)} %.`, source: "permeate analyzer" });
    else if (row.permeateH2OnlinePct < cfg.purityAdvisoryPct) alerts.push({ severity: "advisory", message: `Permeate H2 ${row.permeateH2OnlinePct.toFixed(2)} % below advisory ${cfg.purityAdvisoryPct.toFixed(1)} %.`, source: "permeate analyzer" });
  }
  if (row.feedPressureKpag !== null) {
    const dev = Math.abs(((row.feedPressureKpag - cfg.designFeedPressureKpag) / cfg.designFeedPressureKpag) * 100);
    if (dev > cfg.feedPressureDeviationPct) {
      alerts.push({ severity: "advisory", message: `Feed pressure ${Math.round(row.feedPressureKpag).toLocaleString()} kPag deviates ${dev.toFixed(2)} % from design.`, source: "feed pressure" });
    }
  }
  return alerts;
}

export function rollUpMembraneSeverity(alerts: EngineeringAlert[]): RawSeverity {
  if (alerts.some((a) => a.severity === "alarm")) return "alarm";
  if (alerts.some((a) => a.severity === "advisory")) return "advisory";
  return "ok";
}
