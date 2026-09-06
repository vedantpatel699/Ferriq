// Air Blower engineering module — ported verbatim from the live
// air-blower.html engine (which matches backend-air-blower.md §3-4 exactly;
// verified against the doc's worked example in calculations.test.ts).
// Reference: ASME PTC 10 §5.4/§5.4a, API 617, ISO 10816-3 Group 1.
//
// Do NOT change these formulas to "improve" or "simplify" them during the
// React migration — they are validated engineering logic, not UI code.

import type { EngineeringAlert, RawSeverity } from "../types";

export interface BlowerSettings {
  motorVoltageV: number;
  powerFactor: number;
  gammaK: number;
  atmPressureBar: number;
  activeCurrentMinA: number;
  suctionTempFallbackC: number;
  suctionTempFfMaxHours: number;
  blowerMode: "auto" | "A" | "B";
  efficiencyMethod: "polytropic" | "isentropic" | "fluid";
}

export const DEFAULT_BLOWER_SETTINGS: BlowerSettings = {
  motorVoltageV: 4000,
  powerFactor: 0.85,
  gammaK: 1.4,
  atmPressureBar: 0.93,
  activeCurrentMinA: 10,
  suctionTempFallbackC: 4.0,
  suctionTempFfMaxHours: 4,
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
  filterDpMaxBar: 0.10,
  blowerDpMaxBar: 1.00,
  bypassOpenMaxPct: 60,
};

/** IEEE/NEMA 3-phase motor input power. P = sqrt(3) * V * I * PF / 1000 [kW] */
export function shaftPowerKw(voltageV: number, currentA: number, powerFactor: number): number {
  return Math.sqrt(3) * voltageV * currentA * powerFactor / 1000;
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
  return flowNm3hr * dpBar / 36;
}

/** Isentropic (adiabatic) efficiency, ASME PTC 10 §5.4. Returns a decimal
 *  fraction (0.75 = 75%), or NaN if inputs are thermodynamically infeasible. */
export function isentropicEfficiency(t1K: number, t2K: number, p1Bar: number, p2Bar: number, k: number): number {
  if (!(p2Bar > p1Bar && t2K > t1K)) return NaN;
  const exponent = (k - 1) / k;
  return (t1K * (Math.pow(p2Bar / p1Bar, exponent) - 1)) / (t2K - t1K);
}

/** Polytropic efficiency (headline KPI), ASME PTC 10 §5.4a / API 617.
 *  Independent of compression ratio — used for cross-machine comparison
 *  and degradation tracking. Returns a decimal fraction, or NaN if
 *  thermodynamically infeasible. */
export function polytropicEfficiency(t1K: number, t2K: number, p1Bar: number, p2Bar: number, k: number): number {
  if (!(p2Bar > p1Bar && t2K > t1K)) return NaN;
  const sigma = Math.log(t2K / t1K) / Math.log(p2Bar / p1Bar);
  if (sigma <= 0) return NaN;
  return (k - 1) / k / sigma;
}

export function detectActiveBlower(
  currentA: number, currentB: number, mode: BlowerSettings["blowerMode"], minA: number,
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
}

const ISO = "ISO 10816-3, Group 1";

export function buildAlerts(inputs: AlertInputs, limits: BlowerLimits): EngineeringAlert[] {
  const { maxVibrationMms: v, maxBearingTempC: b, filterDpBar: fdp, blowerDpBar: dp, bypassOpPct: byp, dischargePressureKpag: p2, controllerSpKpag: sp } = inputs;
  const alerts: EngineeringAlert[] = [];

  if (!isNaN(v)) {
    if (v >= limits.vibTripMms) alerts.push({ severity: "trip", message: `Vibration ${v.toFixed(2)} mm/s exceeds trip ${limits.vibTripMms} mm/s (Zone D).`, source: ISO });
    else if (v >= limits.vibAlarmMms) alerts.push({ severity: "alarm", message: `Vibration ${v.toFixed(2)} mm/s exceeds alarm ${limits.vibAlarmMms} mm/s (Zone C/D).`, source: ISO });
    else if (v >= limits.vibAdvisoryMms) alerts.push({ severity: "advisory", message: `Vibration ${v.toFixed(2)} mm/s above advisory ${limits.vibAdvisoryMms} mm/s (Zone B/C).`, source: ISO });
  }
  if (!isNaN(b)) {
    if (b >= limits.brgTripC) alerts.push({ severity: "trip", message: `Bearing T ${b.toFixed(1)} C exceeds trip ${limits.brgTripC} C.`, source: "bearing datasheet" });
    else if (b >= limits.brgAlarmC) alerts.push({ severity: "alarm", message: `Bearing T ${b.toFixed(1)} C exceeds alarm ${limits.brgAlarmC} C.`, source: "bearing datasheet" });
    else if (b >= limits.brgAdvisoryC) alerts.push({ severity: "advisory", message: `Bearing T ${b.toFixed(1)} C above advisory ${limits.brgAdvisoryC} C.`, source: "bearing datasheet" });
  }
  if (!isNaN(fdp) && fdp > limits.filterDpMaxBar) alerts.push({ severity: "advisory", message: `Filter dP ${fdp.toFixed(3)} bar above ${limits.filterDpMaxBar} bar - replace filter.`, source: "plant setpoint" });
  if (!isNaN(dp) && dp > limits.blowerDpMaxBar) alerts.push({ severity: "advisory", message: `Blower dP ${dp.toFixed(3)} bar above design ${limits.blowerDpMaxBar} bar.`, source: "plant setpoint" });
  if (!isNaN(byp) && byp > limits.bypassOpenMaxPct) alerts.push({ severity: "advisory", message: `Bypass ${byp.toFixed(1)}% above ${limits.bypassOpenMaxPct}%.`, source: "plant setpoint" });
  if (!isNaN(byp) && byp < 5 && !isNaN(p2) && !isNaN(sp) && p2 < sp) {
    alerts.push({ severity: "advisory", message: "Bypass closed and discharge below setpoint - at capacity limit.", source: "control narrative" });
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
export function toEquipmentState(severity: RawSeverity): "normal" | "watch" | "investigate" {
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
  drop: true; reason: string;
}

export interface BlowerRowSuccess {
  drop: false;
  timestamp: string;
  activeBlower: "A" | "B";
  powerKw: number;
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
  t1CUsed: number;
  t1Source: "measured" | "forward-filled" | "default";
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
  const active = detectActiveBlower(row.motorCurrentA, row.motorCurrentB, settings.blowerMode, settings.activeCurrentMinA);
  if (!active) return { drop: true, reason: "no active blower (both currents below min)" };

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

  if (isNaN(suctionKpaa) || isNaN(dischargeKpag) || isNaN(row.totalFlowNm3hr) || isNaN(current)) {
    return { drop: true, reason: "missing critical tag (P1, P2, flow, or current)" };
  }

  let t1c: number; let t1Source: BlowerRowSuccess["t1Source"];
  if (row.suctionTempC !== null && !isNaN(row.suctionTempC)) { t1c = row.suctionTempC; t1Source = "measured"; }
  else if (t1ForwardFilled !== null) { t1c = t1ForwardFilled; t1Source = "forward-filled"; }
  else { t1c = settings.suctionTempFallbackC; t1Source = "default"; }

  const vibsClean = vibration.filter((x) => !isNaN(x));
  const brgsClean = bearingTemp.filter((x) => !isNaN(x));
  const maxVibrationMms = vibsClean.length ? Math.max(...vibsClean) : NaN;
  const maxBearingTempC = brgsClean.length ? Math.max(...brgsClean) : NaN;

  const powerKw = shaftPowerKw(settings.motorVoltageV, current, settings.powerFactor);
  const [p1BarAbs, p2BarAbs] = normalizePressures(suctionKpaa, dischargeKpag, settings.atmPressureBar);
  const dpBar = p2BarAbs - p1BarAbs;
  const pressureRatio = p1BarAbs > 0 ? p2BarAbs / p1BarAbs : NaN;
  const fluidPwr = fluidPowerKw(row.totalFlowNm3hr, dpBar);
  const efficiencyFluidPct = powerKw > 0 ? (fluidPwr / powerKw) * 100 : NaN;

  const t1K = t1c + 273.15;
  const t2K = dischargeTempC === null ? NaN : dischargeTempC + 273.15;
  const efficiencyIsentropicPct = dischargeTempC === null ? NaN : isentropicEfficiency(t1K, t2K, p1BarAbs, p2BarAbs, settings.gammaK) * 100;
  const efficiencyPolytropicPct = dischargeTempC === null ? NaN : polytropicEfficiency(t1K, t2K, p1BarAbs, p2BarAbs, settings.gammaK) * 100;

  const byMethod: Record<BlowerSettings["efficiencyMethod"], number> = {
    polytropic: efficiencyPolytropicPct, isentropic: efficiencyIsentropicPct, fluid: efficiencyFluidPct,
  };
  let efficiencyHeadlinePct = byMethod[settings.efficiencyMethod];
  let efficiencyMethodUsed: string = settings.efficiencyMethod;
  if (isNaN(efficiencyHeadlinePct) && settings.efficiencyMethod !== "fluid") {
    efficiencyHeadlinePct = efficiencyFluidPct;
    efficiencyMethodUsed = `${settings.efficiencyMethod} (fallback to fluid)`;
  }

  const alerts = buildAlerts(
    { maxVibrationMms, maxBearingTempC, filterDpBar: filterDp, blowerDpBar: dpBar, bypassOpPct: bypassOp, dischargePressureKpag: dischargeKpag, controllerSpKpag: controllerSp },
    limits,
  );

  return {
    drop: false,
    timestamp: row.timestamp,
    activeBlower: active,
    powerKw, pressureRatio, dpBar, p1BarAbs, p2BarAbs,
    flowNm3hr: row.totalFlowNm3hr,
    fluidPowerKw: fluidPwr,
    efficiencyFluidPct, efficiencyIsentropicPct, efficiencyPolytropicPct,
    efficiencyHeadlinePct, efficiencyMethodUsed,
    maxVibrationMms, maxBearingTempC,
    filterDpBar: filterDp, bypassOpPct: bypassOp,
    t1CUsed: t1c, t1Source,
    alerts, severity: rollUpSeverity(alerts),
  };
}
