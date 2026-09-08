// Shell & Tube Exchanger (E-101 crude preheater) engineering module.
// Ported verbatim from the live shell-tube-exchanger.html engine (a code
// comment there reads "ports Rev9.py / Rev9.html verbatim"). This is
// materially different from — and supersedes — backend-shell-tube-
// exchanger.md, which describes an older fixed-F=0.90/area=250/U_clean=400
// model. The live engine uses a real TEMA N-shell-pass LMTD correction
// factor (Bowman/Mueller general method) and configurable geometry.
//
// Reference: Kern (1950); Bowman, Mueller & Nagle (1940); TEMA §T-3.1.

import type { EngineeringAlert, RawSeverity } from "../types";

export interface ExchangerConfig {
  nShell: number;
  areaM2: number;
  uCleanWm2k: number;
  designQMw: number;
  rfAdvisoryE4: number;
  rfAlarmE4: number;
  effAdvisoryPct: number;
  imbalanceAdvisoryPct: number;
  approachMinC: number;
  dutyAdvisoryPct: number;
  dutyAlarmPct: number;
}

export const DEFAULT_EXCHANGER_CONFIG: ExchangerConfig = {
  nShell: 2,
  areaM2: 124.8,
  uCleanWm2k: 500,
  designQMw: 3.5,
  rfAdvisoryE4: 5,
  rfAlarmE4: 10,
  effAdvisoryPct: 50,
  imbalanceAdvisoryPct: 8,
  approachMinC: 10,
  dutyAdvisoryPct: 5,
  dutyAlarmPct: 10,
};

const EPSILON = 1e-9;

/** TEMA general N-shell-pass LMTD correction factor F (Bowman/Mueller
 *  method). Returns null on temperature crossover or numerical breakdown
 *  (mirrors the live engine's null-propagation contract exactly — do not
 *  substitute a default F when this returns null). */
export function lmtdCorrectionF(
  P: number,
  R: number,
  N: number,
): number | null {
  if (P >= 1.0 || P * R >= 1.0) return null;
  N = Math.round(N);
  if (N <= 0) return null;

  if (Math.abs(R - 1.0) < EPSILON) {
    const P1den = N - P * (N - 1);
    if (Math.abs(P1den) < EPSILON) return null;
    const P1 = P / P1den;
    const S = (P1 * Math.sqrt(2)) / (2 - P1);
    if (Math.abs(S) >= 1) return null;
    const atanhS = 0.5 * Math.log((1 + S) / (1 - S));
    if (Math.abs(atanhS) < EPSILON) return 1.0;
    return (P1 * Math.sqrt(2)) / ((2 - P1) * atanhS);
  }

  const xBase = (1 - P * R) / (1 - P);
  if (xBase < 0) return null;
  const X = Math.pow(xBase, 1.0 / N);
  const p1den2 = R - X;
  if (Math.abs(p1den2) < EPSILON) return null;
  const P1 = (1 - X) / p1den2;
  const A = Math.sqrt(R * R + 1);
  const bLnArg = (1 - P1) / (1 - P1 * R);
  if (bLnArg <= 0) return null;
  const bLn = Math.log(bLnArg);
  const cNum = 2 - P1 * (R + 1 - A);
  const cDen = 2 - P1 * (R + 1 + A);
  if (cNum <= 0 || cDen <= 0) return null;
  const cLn = Math.log(cNum / cDen);
  if (Math.abs(cLn) < EPSILON) return 1.0;
  return (A * bLn) / ((R - 1) * cLn);
}

export interface ExchangerRowInput {
  timestamp: string;
  hotInC: number;
  hotOutC: number;
  hotFlowKgHr: number;
  hotCpKjKgK: number;
  coldInC: number;
  coldOutC: number;
  coldFlowKgHr: number;
  coldCpKjKgK: number;
  shellDpBar: number;
  tubeDpBar: number;
}

export interface ExchangerRowResult {
  timestamp: string;
  qHotKw: number | null;
  qColdKw: number | null;
  qAvgKw: number | null;
  qAvgMw: number | null;
  imbalancePct: number | null;
  lmtdC: number | null;
  lmtdEffC: number | null;
  pRatio: number | null;
  rRatio: number | null;
  fFactor: number | null;
  uDirtyWm2k: number | null;
  rfE4: number | null;
  effectivenessPct: number | null;
  approachHotC: number | null;
  approachColdC: number | null;
  dutyDeviationPct: number | null;
  crossover: boolean;
  shellDpBar: number;
  tubeDpBar: number;
}

/** Mirrors the live engine's calcRow. Does not abort on missing/invalid
 *  inputs or a temperature crossover — returns nulls for what can't be
 *  computed and sets `crossover`, matching the live per-row contract so a
 *  bad row doesn't halt the batch. */
export function calcExchangerRow(
  r: ExchangerRowInput,
  cfg: ExchangerConfig,
): ExchangerRowResult {
  const out: ExchangerRowResult = {
    timestamp: r.timestamp,
    qHotKw: null,
    qColdKw: null,
    qAvgKw: null,
    qAvgMw: null,
    imbalancePct: null,
    lmtdC: null,
    lmtdEffC: null,
    pRatio: null,
    rRatio: null,
    fFactor: null,
    uDirtyWm2k: null,
    rfE4: null,
    effectivenessPct: null,
    approachHotC: null,
    approachColdC: null,
    dutyDeviationPct: null,
    crossover: false,
    shellDpBar: r.shellDpBar,
    tubeDpBar: r.tubeDpBar,
  };

  const {
    hotInC: thIn,
    hotOutC: thOut,
    coldInC: tcIn,
    coldOutC: tcOut,
    hotFlowKgHr: mh,
    hotCpKjKgK: cph,
    coldFlowKgHr: mc,
    coldCpKjKgK: cpc,
  } = r;
  if (
    [thIn, thOut, tcIn, tcOut, mh, cph, mc, cpc].some(
      (x) => x === null || Number.isNaN(x),
    )
  )
    return out;

  out.qHotKw = (mh * cph * (thIn - thOut)) / 3600;
  out.qColdKw = (mc * cpc * (tcOut - tcIn)) / 3600;
  out.qAvgKw = (out.qHotKw + out.qColdKw) / 2;
  out.qAvgMw = out.qAvgKw / 1000;

  if (Math.abs(out.qAvgKw) > EPSILON) {
    out.imbalancePct =
      (Math.abs(out.qHotKw - out.qColdKw) / Math.abs(out.qAvgKw)) * 100;
  }

  const cHot = (mh * cph) / 3600;
  const cCold = (mc * cpc) / 3600;
  const cMin = Math.min(cHot, cCold);
  const dTMax = thIn - tcIn;
  if (dTMax > 0 && cMin > 0) {
    const qMax = cMin * dTMax;
    out.effectivenessPct = (out.qAvgKw / qMax) * 100;
  }

  out.approachHotC = thIn - tcOut;
  out.approachColdC = thOut - tcIn;

  const dT1 = thIn - tcOut;
  const dT2 = thOut - tcIn;
  if (dT1 <= 0 || dT2 <= 0) {
    out.crossover = true;
    return out;
  }
  out.lmtdC =
    Math.abs(dT1 - dT2) > EPSILON ? (dT1 - dT2) / Math.log(dT1 / dT2) : dT1;

  const rDen = tcOut - tcIn;
  const pDen = thIn - tcIn;
  out.rRatio = Math.abs(rDen) > EPSILON ? (thIn - thOut) / rDen : null;
  out.pRatio = Math.abs(pDen) > EPSILON ? (tcOut - tcIn) / pDen : null;
  if (out.pRatio !== null && out.rRatio !== null)
    out.fFactor = lmtdCorrectionF(out.pRatio, out.rRatio, cfg.nShell);
  if (out.fFactor === null) {
    out.crossover = true;
    return out;
  }
  out.lmtdEffC = out.lmtdC * out.fFactor;

  const denom = cfg.areaM2 * out.fFactor * out.lmtdC;
  if (Math.abs(denom) > EPSILON) out.uDirtyWm2k = (out.qAvgKw * 1000) / denom;

  if (out.uDirtyWm2k !== null && out.uDirtyWm2k > 0 && cfg.uCleanWm2k > 0) {
    out.rfE4 = (1 / out.uDirtyWm2k - 1 / cfg.uCleanWm2k) * 1e4;
  }

  if (cfg.designQMw !== 0)
    out.dutyDeviationPct = ((out.qAvgMw - cfg.designQMw) / cfg.designQMw) * 100;

  return out;
}

export function buildExchangerAlerts(
  row: ExchangerRowResult,
  cfg: ExchangerConfig,
): EngineeringAlert[] {
  const alerts: EngineeringAlert[] = [];
  if (row.crossover) {
    alerts.push({
      severity: "alarm",
      message:
        "Temperature crossover detected (F-factor undefined). Check sensor labels and inlet/outlet swap.",
      source: "LMTD / F-factor",
    });
  }
  if (row.rfE4 !== null && row.rfE4 >= cfg.rfAlarmE4) {
    alerts.push({
      severity: "alarm",
      message: `Fouling R_f ${row.rfE4.toFixed(2)}×10⁻⁴ at or above alarm ${cfg.rfAlarmE4.toFixed(1)} - schedule clean.`,
      source: "fouling",
    });
  } else if (row.rfE4 !== null && row.rfE4 >= cfg.rfAdvisoryE4) {
    alerts.push({
      severity: "advisory",
      message: `Fouling R_f ${row.rfE4.toFixed(2)}×10⁻⁴ above advisory ${cfg.rfAdvisoryE4.toFixed(1)}.`,
      source: "fouling",
    });
  }
  if (row.dutyDeviationPct !== null) {
    const abs = Math.abs(row.dutyDeviationPct);
    if (abs >= cfg.dutyAlarmPct)
      alerts.push({
        severity: "alarm",
        message: `Duty deviation ${row.dutyDeviationPct.toFixed(2)} % at or above alarm ±${cfg.dutyAlarmPct.toFixed(0)} %.`,
        source: "duty vs design",
      });
    else if (abs >= cfg.dutyAdvisoryPct)
      alerts.push({
        severity: "advisory",
        message: `Duty deviation ${row.dutyDeviationPct.toFixed(2)} % above advisory ±${cfg.dutyAdvisoryPct.toFixed(0)} %.`,
        source: "duty vs design",
      });
  }
  if (
    row.effectivenessPct !== null &&
    row.effectivenessPct < cfg.effAdvisoryPct
  ) {
    alerts.push({
      severity: "advisory",
      message: `Effectiveness ε ${row.effectivenessPct.toFixed(1)} % below advisory ${cfg.effAdvisoryPct.toFixed(0)} %.`,
      source: "effectiveness",
    });
  }
  if (
    row.imbalancePct !== null &&
    row.imbalancePct > cfg.imbalanceAdvisoryPct
  ) {
    alerts.push({
      severity: "advisory",
      message: `Q imbalance ${row.imbalancePct.toFixed(2)} % above advisory ${cfg.imbalanceAdvisoryPct.toFixed(0)} %.`,
      source: "energy balance",
    });
  }
  if (row.approachHotC !== null && row.approachHotC < cfg.approachMinC) {
    alerts.push({
      severity: "advisory",
      message: `Hot end approach ${row.approachHotC.toFixed(1)} °C below minimum ${cfg.approachMinC.toFixed(0)} °C.`,
      source: "approach",
    });
  }
  if (row.approachColdC !== null && row.approachColdC < cfg.approachMinC) {
    alerts.push({
      severity: "advisory",
      message: `Cold end approach ${row.approachColdC.toFixed(1)} °C below minimum ${cfg.approachMinC.toFixed(0)} °C.`,
      source: "approach",
    });
  }
  return alerts;
}

export function rollUpExchangerSeverity(
  alerts: EngineeringAlert[],
): RawSeverity {
  if (alerts.some((a) => a.severity === "alarm")) return "alarm";
  if (alerts.some((a) => a.severity === "advisory")) return "advisory";
  return "ok";
}
