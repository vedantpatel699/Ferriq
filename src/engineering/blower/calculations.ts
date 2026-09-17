// Air Blower proof-of-concept engineering model.
//
// Core compression relationships use ideal-gas thermodynamics. ASME PTC 10
// is the compressor-performance test framework; this module is intentionally
// simpler than a formal acceptance test. Linear regression is used only as an
// interpretable expected-behaviour screen. The thrust operating-deviation
// proxy is explicitly a POC heuristic, not a direct axial-thrust calculation.

import type { EngineeringAlert, RawSeverity } from "../types";

export interface BlowerSettings {
  motorVoltageV: number;
  powerFactor: number;
  powerFactorMode: "datasheet" | "fixed";
  gammaK: number;
  atmPressureBar: number;
  activeCurrentMinA: number;
  suctionTempFallbackC: number;
  suctionTempFfMaxHours: number;
  baselineTrainingDays: number;
  performanceBypassMaxPct: number;
  blowerMode: "auto" | "A" | "B";
  efficiencyMethod: "polytropic" | "isentropic" | "fluid";
}

export const DEFAULT_BLOWER_SETTINGS: BlowerSettings = {
  motorVoltageV: 4000,
  powerFactor: 0.85,
  powerFactorMode: "datasheet",
  gammaK: 1.4,
  atmPressureBar: 0.93,
  activeCurrentMinA: 10,
  // Retained for saved-config compatibility. A fixed temperature is no longer
  // inserted into thermodynamic calculations when the suction-temperature tag
  // is unavailable.
  suctionTempFallbackC: 4.0,
  suctionTempFfMaxHours: 4,
  baselineTrainingDays: 14,
  performanceBypassMaxPct: 5,
  blowerMode: "auto",
  efficiencyMethod: "polytropic",
};

export interface BlowerLimits {
  vibAdvisoryMms: number;
  vibAlarmMms: number;
  vibTripMms: number;
  brgAdvisoryC: number;
  brgAlarmC: number;
  brgTripC: number;
  filterDpMaxBar: number;
  blowerDpMaxBar: number;
  bypassOpenMaxPct: number;
  performanceWatchPct: number;
  performanceAlarmPct: number;
  thrustProxyWatchPct: number;
  thrustProxyAlarmPct: number;
}

// blowerDpMaxBar default is 1.00, not the 0.45 documented in
// backend-air-blower.md §5.2 — the live dashboard HTML overrides the
// engine.py default (see backend doc's own note in §6.4: "originally
// 0.45 bar in engine.py, tune to nameplate"). The live HTML is the actual
// running production value, so it is what this port preserves.
export const DEFAULT_BLOWER_LIMITS: BlowerLimits = {
  vibAdvisoryMms: 4.5,
  vibAlarmMms: 7.1,
  vibTripMms: 11.0,
  brgAdvisoryC: 70,
  brgAlarmC: 85,
  brgTripC: 95,
  filterDpMaxBar: 0.1,
  blowerDpMaxBar: 1.0,
  bypassOpenMaxPct: 60,
  performanceWatchPct: 5,
  performanceAlarmPct: 10,
  thrustProxyWatchPct: 15,
  thrustProxyAlarmPct: 25,
};

export const BLOWER_DESIGN_REFERENCE = {
  inletPressureKpaa: 93,
  dischargePressureKpaa: 178,
  annualAverageInletTempC: 4,
  designFlowNm3hr: 20609.2866,
  designTrainPowerKw: 711,
  designPolytropicEfficiencyPct: 76,
  designSpeedRpm: 3580,
} as const;

export const MOTOR_POWER_FACTOR_POINTS = [
  { currentA: 33.1, powerFactor: 0.055, label: "no load" },
  { currentA: 51.1, powerFactor: 0.701, label: "25% load" },
  { currentA: 82.5, powerFactor: 0.853, label: "50% load" },
  { currentA: 118.7, powerFactor: 0.889, label: "75% load" },
  { currentA: 157.5, powerFactor: 0.896, label: "full load" },
] as const;

export function motorPowerFactorFromCurrent(currentA: number): number {
  const pts = MOTOR_POWER_FACTOR_POINTS;
  if (!Number.isFinite(currentA)) return NaN;
  if (currentA <= pts[0].currentA) return pts[0].powerFactor;
  if (currentA >= pts[pts.length - 1].currentA) return pts[pts.length - 1].powerFactor;
  for (let i = 1; i < pts.length; i++) {
    if (currentA <= pts[i].currentA) {
      const lo = pts[i - 1], hi = pts[i];
      const frac = (currentA - lo.currentA) / (hi.currentA - lo.currentA);
      return lo.powerFactor + frac * (hi.powerFactor - lo.powerFactor);
    }
  }
  return pts[pts.length - 1].powerFactor;
}

export function thrustOperatingDeviationPct(
  flowNm3hr: number,
  pressureRatio: number,
  bypassPct: number,
): number {
  const designPr = BLOWER_DESIGN_REFERENCE.dischargePressureKpaa / BLOWER_DESIGN_REFERENCE.inletPressureKpaa;
  const dq = (flowNm3hr - BLOWER_DESIGN_REFERENCE.designFlowNm3hr) / BLOWER_DESIGN_REFERENCE.designFlowNm3hr;
  const dpr = (pressureRatio - designPr) / designPr;
  const recycle = Math.max(0, bypassPct) / 100;
  return Math.sqrt((dq * dq + dpr * dpr + recycle * recycle) / 3) * 100;
}

/** Three-phase electrical input power. P = sqrt(3) * V * I * PF / 1000 [kW]. */
export function shaftPowerKw(
  voltageV: number,
  currentA: number,
  powerFactor: number,
): number {
  return (Math.sqrt(3) * voltageV * currentA * powerFactor) / 1000;
}

/** Convert mixed-unit plant measurements to absolute bar.
 *  P1 = P_suction_kPaa / 100; P2 = P_discharge_kPag / 100 + P_atm */
export function normalizePressures(
  suctionKpaa: number,
  dischargeKpag: number,
  atmPressureBar: number,
): [p1BarAbs: number, p2BarAbs: number] {
  return [suctionKpaa / 100, dischargeKpag / 100 + atmPressureBar];
}

/** Incompressible-flow hydraulic-power trending indicator (NOT a
 *  thermodynamically correct compressor efficiency). P_fluid = Q*dP/36 [kW] */
export function fluidPowerKw(flowNm3hr: number, dpBar: number): number {
  return (flowNm3hr * dpBar) / 36;
}

/** Ideal-gas isentropic efficiency estimate for this POC. ASME PTC 10 is the compressor-performance test framework. Returns a decimal
 *  fraction (0.75 = 75%), or NaN if inputs are thermodynamically infeasible. */
export function isentropicEfficiency(
  t1K: number,
  t2K: number,
  p1Bar: number,
  p2Bar: number,
  k: number,
): number {
  if (!(p2Bar > p1Bar && t2K > t1K)) return NaN;
  const exponent = (k - 1) / k;
  return (t1K * (Math.pow(p2Bar / p1Bar, exponent) - 1)) / (t2K - t1K);
}

/** Ideal-gas polytropic efficiency estimate for this POC. ASME PTC 10 is used as the compressor-performance test framework; this is not a full real-gas PTC 10 implementation.
 *  Independent of compression ratio — used for cross-machine comparison
 *  and degradation tracking. Returns a decimal fraction, or NaN if
 *  thermodynamically infeasible. */
export function polytropicEfficiency(
  t1K: number,
  t2K: number,
  p1Bar: number,
  p2Bar: number,
  k: number,
): number {
  if (!(p2Bar > p1Bar && t2K > t1K)) return NaN;
  const sigma = Math.log(t2K / t1K) / Math.log(p2Bar / p1Bar);
  if (sigma <= 0) return NaN;
  return (k - 1) / k / sigma;
}

export function detectActiveBlower(
  currentA: number,
  currentB: number,
  mode: BlowerSettings["blowerMode"],
  minA: number,
): "A" | "B" | null {
  if (mode === "A") return !isNaN(currentA) && currentA > minA ? "A" : null;
  if (mode === "B") return !isNaN(currentB) && currentB > minA ? "B" : null;
  const aOn = !isNaN(currentA) && currentA > minA;
  const bOn = !isNaN(currentB) && currentB > minA;
  if (aOn && bOn) return currentA >= currentB ? "A" : "B";
  if (aOn) return "A";
  if (bOn) return "B";
  return null;
}

export interface AlertInputs {
  maxVibrationMms: number;
  maxBearingTempC: number;
  filterDpBar: number;
  blowerDpBar: number;
  bypassOpPct: number;
  dischargePressureKpag: number;
  controllerSpKpag: number;
  thrustProxyPct: number;
}

const ISO = "ISO 10816-3, Group 1";

export function buildAlerts(
  inputs: AlertInputs,
  limits: BlowerLimits,
): EngineeringAlert[] {
  const {
    maxVibrationMms: v,
    maxBearingTempC: b,
    filterDpBar: fdp,
    blowerDpBar: dp,
    bypassOpPct: byp,
    dischargePressureKpag: p2,
    controllerSpKpag: sp,
    thrustProxyPct,
  } = inputs;
  const alerts: EngineeringAlert[] = [];

  if (!isNaN(v)) {
    if (v >= limits.vibTripMms)
      alerts.push({
        severity: "trip",
        message: `Vibration ${v.toFixed(2)} mm/s exceeds trip ${limits.vibTripMms} mm/s (Zone D).`,
        source: ISO,
      });
    else if (v >= limits.vibAlarmMms)
      alerts.push({
        severity: "alarm",
        message: `Vibration ${v.toFixed(2)} mm/s exceeds alarm ${limits.vibAlarmMms} mm/s (Zone C/D).`,
        source: ISO,
      });
    else if (v >= limits.vibAdvisoryMms)
      alerts.push({
        severity: "advisory",
        message: `Vibration ${v.toFixed(2)} mm/s above advisory ${limits.vibAdvisoryMms} mm/s (Zone B/C).`,
        source: ISO,
      });
  }
  if (!isNaN(b)) {
    if (b >= limits.brgTripC)
      alerts.push({
        severity: "trip",
        message: `Bearing T ${b.toFixed(1)} C exceeds trip ${limits.brgTripC} C.`,
        source: "bearing datasheet",
      });
    else if (b >= limits.brgAlarmC)
      alerts.push({
        severity: "alarm",
        message: `Bearing T ${b.toFixed(1)} C exceeds alarm ${limits.brgAlarmC} C.`,
        source: "bearing datasheet",
      });
    else if (b >= limits.brgAdvisoryC)
      alerts.push({
        severity: "advisory",
        message: `Bearing T ${b.toFixed(1)} C above advisory ${limits.brgAdvisoryC} C.`,
        source: "bearing datasheet",
      });
  }
  if (!isNaN(fdp) && fdp > limits.filterDpMaxBar)
    alerts.push({
      severity: "advisory",
      message: `Filter dP ${fdp.toFixed(3)} bar above ${limits.filterDpMaxBar} bar - replace filter.`,
      source: "plant setpoint",
    });
  if (!isNaN(dp) && dp > limits.blowerDpMaxBar)
    alerts.push({
      severity: "advisory",
      message: `Blower dP ${dp.toFixed(3)} bar above design ${limits.blowerDpMaxBar} bar.`,
      source: "plant setpoint",
    });
  if (!isNaN(byp) && byp > limits.bypassOpenMaxPct)
    alerts.push({
      severity: "advisory",
      message: `Bypass ${byp.toFixed(1)}% above ${limits.bypassOpenMaxPct}%.`,
      source: "plant setpoint",
    });
  if (!isNaN(byp) && byp < 5 && !isNaN(p2) && !isNaN(sp) && p2 < sp) {
    alerts.push({
      severity: "advisory",
      message:
        "Bypass closed and discharge below setpoint - at capacity limit.",
      source: "control narrative",
    });
  }
  if (!isNaN(thrustProxyPct)) {
    if (thrustProxyPct >= limits.thrustProxyAlarmPct)
      alerts.push({
        severity: "alarm",
        message: `Thrust operating-deviation proxy ${thrustProxyPct.toFixed(1)}% exceeds the POC investigate threshold ${limits.thrustProxyAlarmPct}%.`,
        source: "POC operating-envelope heuristic; not a direct thrust measurement",
      });
    else if (thrustProxyPct >= limits.thrustProxyWatchPct)
      alerts.push({
        severity: "advisory",
        message: `Thrust operating-deviation proxy ${thrustProxyPct.toFixed(1)}% exceeds the POC watch threshold ${limits.thrustProxyWatchPct}%.`,
        source: "POC operating-envelope heuristic; not a direct thrust measurement",
      });
  }
  return alerts;
}

export function rollUpSeverity(alerts: EngineeringAlert[]): RawSeverity {
  if (alerts.some((a) => a.severity === "trip")) return "trip";
  if (alerts.some((a) => a.severity === "alarm")) return "alarm";
  if (alerts.some((a) => a.severity === "advisory")) return "advisory";
  return "ok";
}

/** Ferriq page-level engineering state, distinct from the raw physical
 *  severity above — see EquipmentState doc comment in types.ts. */
export function toEquipmentState(
  severity: RawSeverity,
): "normal" | "watch" | "investigate" {
  if (severity === "ok") return "normal";
  if (severity === "advisory") return "watch";
  return "investigate"; // alarm or trip
}

export interface BlowerRowInput {
  timestamp: string;
  motorCurrentA: number;
  motorCurrentB: number;
  suctionPressureA: number;
  suctionPressureB: number;
  dischargePressureA: number;
  dischargePressureB: number;
  controllerSpA: number;
  controllerSpB: number;
  bypassOpA: number;
  bypassOpB: number;
  filterDpA: number;
  filterDpB: number;
  totalFlowNm3hr: number;
  suctionTempC: number | null;
  dischargeTempA: number | null;
  dischargeTempB: number | null;
  vibrationA: [number, number, number, number];
  vibrationB: [number, number, number, number];
  bearingTempA: [number, number];
  bearingTempB: [number, number];
}

export interface BlowerRowResult {
  drop: true;
  reason: string;
}

export interface BlowerRowSuccess {
  drop: false;
  timestamp: string;
  activeBlower: "A" | "B";
  powerKw: number;
  powerFactorUsed: number;
  powerFactorSource: "motor-datasheet interpolation" | "fixed";
  pressureRatio: number;
  dpBar: number;
  p1BarAbs: number;
  p2BarAbs: number;
  flowNm3hr: number;
  fluidPowerKw: number;
  efficiencyFluidPct: number;
  efficiencyIsentropicPct: number;
  efficiencyPolytropicPct: number;
  efficiencyHeadlinePct: number;
  efficiencyMethodUsed: string;
  maxVibrationMms: number;
  maxBearingTempC: number;
  filterDpBar: number;
  bypassOpPct: number;
  t1CUsed: number | null;
  t1Source: "measured" | "forward-filled" | "unavailable";
  thrustProxyPct: number;
  alerts: EngineeringAlert[];
  severity: RawSeverity;
}

/** Mirrors engine.process_single_row from backend-air-blower.md §4.5.
 *  t1ForwardFilled: a measured suction temp carried forward from an
 *  earlier row within the configured forward-fill window (batch-level
 *  concern — computed by the caller, not this function). */
export function processBlowerRow(
  row: BlowerRowInput,
  settings: BlowerSettings,
  limits: BlowerLimits,
  t1ForwardFilled: number | null,
): BlowerRowResult | BlowerRowSuccess {
  const active = detectActiveBlower(
    row.motorCurrentA,
    row.motorCurrentB,
    settings.blowerMode,
    settings.activeCurrentMinA,
  );
  if (!active)
    return { drop: true, reason: "no active blower (both currents below min)" };

  const isA = active === "A";
  const current = isA ? row.motorCurrentA : row.motorCurrentB;
  const suctionKpaa = isA ? row.suctionPressureA : row.suctionPressureB;
  const dischargeKpag = isA ? row.dischargePressureA : row.dischargePressureB;
  const controllerSp = isA ? row.controllerSpA : row.controllerSpB;
  const bypassOp = isA ? row.bypassOpA : row.bypassOpB;
  const filterDp = isA ? row.filterDpA : row.filterDpB;
  const dischargeTempC = isA ? row.dischargeTempA : row.dischargeTempB;
  const vibration = isA ? row.vibrationA : row.vibrationB;
  const bearingTemp = isA ? row.bearingTempA : row.bearingTempB;

  if (
    isNaN(suctionKpaa) ||
    isNaN(dischargeKpag) ||
    isNaN(row.totalFlowNm3hr) ||
    isNaN(current)
  ) {
    return {
      drop: true,
      reason: "missing critical tag (P1, P2, flow, or current)",
    };
  }

  let t1c: number | null;
  let t1Source: BlowerRowSuccess["t1Source"];
  if (row.suctionTempC !== null && !isNaN(row.suctionTempC)) {
    t1c = row.suctionTempC;
    t1Source = "measured";
  } else if (t1ForwardFilled !== null) {
    t1c = t1ForwardFilled;
    t1Source = "forward-filled";
  } else {
    t1c = null;
    t1Source = "unavailable";
  }

  const vibsClean = vibration.filter((x) => !isNaN(x));
  const brgsClean = bearingTemp.filter((x) => !isNaN(x));
  const maxVibrationMms = vibsClean.length ? Math.max(...vibsClean) : NaN;
  const maxBearingTempC = brgsClean.length ? Math.max(...brgsClean) : NaN;

  const powerFactorUsed =
    settings.powerFactorMode === "datasheet"
      ? motorPowerFactorFromCurrent(current)
      : settings.powerFactor;
  const powerKw = shaftPowerKw(
    settings.motorVoltageV,
    current,
    powerFactorUsed,
  );
  const [p1BarAbs, p2BarAbs] = normalizePressures(
    suctionKpaa,
    dischargeKpag,
    settings.atmPressureBar,
  );
  const dpBar = p2BarAbs - p1BarAbs;
  const pressureRatio = p1BarAbs > 0 ? p2BarAbs / p1BarAbs : NaN;
  const fluidPwr = fluidPowerKw(row.totalFlowNm3hr, dpBar);
  const thrustProxyPct = thrustOperatingDeviationPct(
    row.totalFlowNm3hr,
    pressureRatio,
    bypassOp,
  );
  const efficiencyFluidPct = powerKw > 0 ? (fluidPwr / powerKw) * 100 : NaN;

  const t1K = t1c === null ? NaN : t1c + 273.15;
  const t2K = dischargeTempC === null ? NaN : dischargeTempC + 273.15;
  const efficiencyIsentropicPct =
    t1c === null || dischargeTempC === null
      ? NaN
      : isentropicEfficiency(t1K, t2K, p1BarAbs, p2BarAbs, settings.gammaK) *
        100;
  const efficiencyPolytropicPct =
    t1c === null || dischargeTempC === null
      ? NaN
      : polytropicEfficiency(t1K, t2K, p1BarAbs, p2BarAbs, settings.gammaK) *
        100;

  const byMethod: Record<BlowerSettings["efficiencyMethod"], number> = {
    polytropic: efficiencyPolytropicPct,
    isentropic: efficiencyIsentropicPct,
    fluid: efficiencyFluidPct,
  };
  let efficiencyHeadlinePct = byMethod[settings.efficiencyMethod];
  let efficiencyMethodUsed: string = settings.efficiencyMethod;
  if (isNaN(efficiencyHeadlinePct) && settings.efficiencyMethod !== "fluid") {
    efficiencyHeadlinePct = efficiencyFluidPct;
    efficiencyMethodUsed = `${settings.efficiencyMethod} (fallback to fluid)`;
  }

  const alerts = buildAlerts(
    {
      maxVibrationMms,
      maxBearingTempC,
      filterDpBar: filterDp,
      blowerDpBar: dpBar,
      bypassOpPct: bypassOp,
      dischargePressureKpag: dischargeKpag,
      controllerSpKpag: controllerSp,
      thrustProxyPct,
    },
    limits,
  );

  return {
    drop: false,
    timestamp: row.timestamp,
    activeBlower: active,
    powerKw,
    powerFactorUsed,
    powerFactorSource:
      settings.powerFactorMode === "datasheet"
        ? "motor-datasheet interpolation"
        : "fixed",
    pressureRatio,
    dpBar,
    p1BarAbs,
    p2BarAbs,
    flowNm3hr: row.totalFlowNm3hr,
    fluidPowerKw: fluidPwr,
    efficiencyFluidPct,
    efficiencyIsentropicPct,
    efficiencyPolytropicPct,
    efficiencyHeadlinePct,
    efficiencyMethodUsed,
    maxVibrationMms,
    maxBearingTempC,
    filterDpBar: filterDp,
    bypassOpPct: bypassOp,
    t1CUsed: t1c,
    t1Source,
    thrustProxyPct,
    alerts,
    severity: rollUpSeverity(alerts),
  };
}


export interface SimpleFlowModel {
  intercept: number;
  slope: number;
  trainingRows: number;
}

/** Small, transparent baseline regression used for performance-degradation
 * screening. It predicts flow from active motor current using the first
 * healthy-reference observations for each train. This is a screening model,
 * not a failure-probability or remaining-life model. */
export function fitSimpleFlowModel(
  points: { currentA: number; flowNm3hr: number }[],
): SimpleFlowModel | null {
  const clean = points.filter(
    (p) => Number.isFinite(p.currentA) && Number.isFinite(p.flowNm3hr),
  );
  if (clean.length < 5) return null;
  const mx = clean.reduce((a, p) => a + p.currentA, 0) / clean.length;
  const my = clean.reduce((a, p) => a + p.flowNm3hr, 0) / clean.length;
  const variance = clean.reduce((a, p) => a + (p.currentA - mx) ** 2, 0);
  const covariance = clean.reduce(
    (a, p) => a + (p.currentA - mx) * (p.flowNm3hr - my),
    0,
  );
  const slope = variance > 1e-12 ? covariance / variance : 0;
  return {
    intercept: my - slope * mx,
    slope,
    trainingRows: clean.length,
  };
}

export function predictFlowNm3hr(
  model: SimpleFlowModel | null,
  currentA: number,
): number | null {
  if (!model || !Number.isFinite(currentA)) return null;
  return model.intercept + model.slope * currentA;
}
