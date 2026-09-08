// Fired Heater engineering module — ported verbatim from the live
// fired-heater.html engine. Supersedes backend-fired-heater.md, which
// documents a simpler fixed natural-gas-only model the live app does not
// run (the live app supports named plant fuel-gas blends and a custom
// blend builder — see fuelData.ts).
//
// Reference: API 560 §5.4; ASME PTC 4 (excess air, stack losses).

import type { EngineeringAlert, RawSeverity } from "../types";
import {
  FUEL_COMPONENT_PROPS,
  FUEL_GAS_CASES,
  type FuelGasCase,
  CP_FUEL_GAS_KJKGK,
  CP_COMBUSTION_AIR_KJKGK,
  CP_FLUE_GAS_KJKGK,
  CP_FLUE_GAS_PTC4_KJKGK,
  CP_VAPOR_KJKGK,
  O2_VOL_FRAC_AIR,
  N2_VOL_FRAC_AIR,
  O2_MW,
  N2_MW,
} from "./fuelData";

export function resolveFuelComposition(
  nameOrCustom: string,
  customCase?: FuelGasCase,
): FuelGasCase {
  if (nameOrCustom === "Custom" && customCase) return customCase;
  return (
    FUEL_GAS_CASES[nameOrCustom] ??
    FUEL_GAS_CASES["Sheet Reference Case (83.64%)"]
  );
}

/** Recompute averageMw/lhvMjKg from a fractions map (used when the user
 *  edits the custom blend builder). */
export function calcCompositionProps(fractions: Record<string, number>): {
  averageMw: number;
  lhvMjKg: number;
  sum: number;
} {
  let total = 0;
  for (const k in fractions) total += fractions[k] || 0;
  const norm = total > 0 ? total : 1;
  let avgMw = 0;
  for (const k in fractions) {
    const p = FUEL_COMPONENT_PROPS[k];
    if (p) avgMw += ((fractions[k] || 0) / norm) * p.mw;
  }
  if (avgMw <= 0) return { averageMw: 0, lhvMjKg: 0, sum: total };
  let lhv = 0;
  for (const k in fractions) {
    const p = FUEL_COMPONENT_PROPS[k];
    if (p) {
      const massFrac = (((fractions[k] || 0) / norm) * p.mw) / avgMw;
      lhv += massFrac * p.lhvMjKg;
    }
  }
  return { averageMw: avgMw, lhvMjKg: lhv, sum: total };
}

export function stoichO2KgPerKgFuel(comp: FuelGasCase): number {
  let o2MolPerMolFuel = 0;
  for (const k in comp.fractions) {
    const props = FUEL_COMPONENT_PROPS[k];
    if (props) o2MolPerMolFuel += comp.fractions[k] * props.o2;
  }
  return (o2MolPerMolFuel * O2_MW) / comp.averageMw;
}

export function stoichAirKgPerKgFuel(comp: FuelGasCase): number {
  return stoichO2KgPerKgFuel(comp) / 0.232; // air is 23.2% O2 by mass
}

export function h2oKgPerKgFuel(comp: FuelGasCase): number {
  let h2oMol = 0;
  for (const k in comp.fractions) {
    const props = FUEL_COMPONENT_PROPS[k];
    if (props) h2oMol += comp.fractions[k] * props.h2o;
  }
  return (h2oMol * 18.02) / comp.averageMw;
}

export interface CombustionMassFlows {
  mCaKgS: number | null;
  mSKgS: number | null;
  afRatio: number | null;
}

/** Solve combustion-air and flue-gas mass flows from fuel flow and target
 *  dry stack O2%, given the resolved fuel composition. */
export function combustionMassFlows(
  mFuelKgS: number,
  targetO2PctDry: number,
  comp: FuelGasCase,
): CombustionMassFlows {
  if (!mFuelKgS || mFuelKgS <= 0 || !comp.averageMw)
    return { mCaKgS: null, mSKgS: null, afRatio: null };
  const fuelKmolS = mFuelKgS / comp.averageMw;
  let nO2St = 0,
    nH2O = 0,
    nCO2 = 0,
    nN2Fuel = 0;
  for (const k in comp.fractions) {
    const z = comp.fractions[k];
    const props = FUEL_COMPONENT_PROPS[k];
    if (!props) continue;
    const flow = fuelKmolS * z;
    nO2St += flow * props.o2;
    nH2O += flow * props.h2o;
    nCO2 += flow * props.co2;
    if (k === "Nitrogen") nN2Fuel += flow;
  }
  const nN2StAir = nO2St * (N2_VOL_FRAC_AIR / O2_VOL_FRAC_AIR);
  const nFgSt = nCO2 + nH2O + nN2Fuel + nN2StAir;
  const yO2 = targetO2PctDry / 100.0;
  const denom = 1 - yO2 * (1 + N2_VOL_FRAC_AIR / O2_VOL_FRAC_AIR);
  if (Math.abs(denom) < 1e-9)
    return { mCaKgS: null, mSKgS: null, afRatio: null };
  const nO2Excess = (yO2 * nFgSt) / denom;
  const nO2Total = nO2St + nO2Excess;
  const nN2TotalAir = nO2Total * (N2_VOL_FRAC_AIR / O2_VOL_FRAC_AIR);
  const mCa = nO2Total * O2_MW + nN2TotalAir * N2_MW;
  const mS = mFuelKgS + mCa;
  return { mCaKgS: mCa, mSKgS: mS, afRatio: mCa / mFuelKgS };
}

export interface HeaterConfig {
  fuelCase: string;
  customCase?: FuelGasCase;
  radiationLossPct: number;
  unaccountedLossPct: number;
  refTempC: number;
  designDutyKw: number;
  designEffPct: number;
  designStackC: number;
  designO2Pct: number;
  designFuelKgS: number;
  designBwC: number;
  effAdvisoryPct: number;
  effAlarmPct: number;
  stackAdvisoryC: number;
  stackAlarmC: number;
  bwAdvisoryC: number;
  bwAlarmC: number;
  eaAdvisoryPct: number;
  eaAlarmPct: number;
  o2LowPct: number;
  o2HighPct: number;
}

export const DEFAULT_HEATER_CONFIG: HeaterConfig = {
  fuelCase: "Sheet Reference Case (83.64%)",
  radiationLossPct: 1.5,
  unaccountedLossPct: 0.5,
  refTempC: 15,
  designDutyKw: 42140,
  designEffPct: 83.3,
  designStackC: 294,
  designO2Pct: 4.27,
  designFuelKgS: 0.849,
  designBwC: 778,
  effAdvisoryPct: 82,
  effAlarmPct: 78,
  stackAdvisoryC: 320,
  stackAlarmC: 360,
  bwAdvisoryC: 830,
  bwAlarmC: 870,
  eaAdvisoryPct: 30,
  eaAlarmPct: 45,
  o2LowPct: 2,
  o2HighPct: 6,
};

export interface HeaterRowInput {
  timestamp: string;
  fuelFlowKgS: number | null; // mf
  combustionAirTempC: number | null; // Tca
  stackTempC: number | null; // Ts
  fuelTempC: number | null; // Tf
  processFlowKgS: number | null; // mp
  processInC: number | null;
  processOutC: number | null;
  processCpKjKgK: number | null;
  stackO2Pct: number | null; // o2
  bridgewallAC: number | null;
  bridgewallBC: number | null;
  fuelCaseOverride?: string;
}

export interface HeaterRowResult {
  timestamp: string;
  // Raw passthrough fields (the live engine's `out` object copies these
  // from the input row so buildAlerts can read them off the same object
  // it evaluates the computed fields from).
  stackTempC: number | null;
  stackO2Pct: number | null;
  bridgewallAvgC: number | null;
  excessAirPct: number | null;
  etaHeatBalancePct: number | null;
  etaPtc4Pct: number | null;
  etaProcessPct: number | null;
  etaDeltaPp: number | null;
  qLhvKw: number | null;
  qAbsorbedKw: number | null;
  qProcessKw: number | null;
  qFuelSensibleKw: number | null;
  qCombustionAirKw: number | null;
  qStackKw: number | null;
  qRadiationLossKw: number | null;
  qInKw: number | null;
  combustionAirKgS: number | null;
  stackMassKgS: number | null;
  airFuelRatio: number | null;
  dryLossPct: number | null;
  moistureLossPct: number | null;
  radiationLossPct: number | null;
  unaccountedLossPct: number | null;
  closurePct: number | null;
}

/** Mirrors the live engine's calcRow exactly. */
export function calcHeaterRow(
  r: HeaterRowInput,
  cfg: HeaterConfig,
): HeaterRowResult {
  const out: HeaterRowResult = {
    timestamp: r.timestamp,
    stackTempC: r.stackTempC,
    stackO2Pct: r.stackO2Pct,
    bridgewallAvgC: null,
    excessAirPct: null,
    etaHeatBalancePct: null,
    etaPtc4Pct: null,
    etaProcessPct: null,
    etaDeltaPp: null,
    qLhvKw: null,
    qAbsorbedKw: null,
    qProcessKw: null,
    qFuelSensibleKw: null,
    qCombustionAirKw: null,
    qStackKw: null,
    qRadiationLossKw: null,
    qInKw: null,
    combustionAirKgS: null,
    stackMassKgS: null,
    airFuelRatio: null,
    dryLossPct: null,
    moistureLossPct: null,
    radiationLossPct: null,
    unaccountedLossPct: null,
    closurePct: null,
  };

  if (r.bridgewallAC !== null && r.bridgewallBC !== null)
    out.bridgewallAvgC = (r.bridgewallAC + r.bridgewallBC) / 2;
  else if (r.bridgewallAC !== null) out.bridgewallAvgC = r.bridgewallAC;
  else if (r.bridgewallBC !== null) out.bridgewallAvgC = r.bridgewallBC;

  if (r.stackO2Pct !== null && r.stackO2Pct < 20.9)
    out.excessAirPct = (100.0 * r.stackO2Pct) / (20.95 - r.stackO2Pct);

  const comp = resolveFuelComposition(
    r.fuelCaseOverride || cfg.fuelCase,
    cfg.customCase,
  );
  const lhvKjKg = comp.lhvMjKg * 1000.0;

  if (r.fuelFlowKgS !== null && r.stackO2Pct !== null) {
    const cm = combustionMassFlows(r.fuelFlowKgS, r.stackO2Pct, comp);
    out.combustionAirKgS = cm.mCaKgS;
    out.stackMassKgS = cm.mSKgS;
    out.airFuelRatio = cm.afRatio;
  }

  if (r.fuelFlowKgS !== null) out.qLhvKw = r.fuelFlowKgS * lhvKjKg;
  if (r.fuelFlowKgS !== null && r.fuelTempC !== null)
    out.qFuelSensibleKw =
      r.fuelFlowKgS * CP_FUEL_GAS_KJKGK * (r.fuelTempC - cfg.refTempC);
  if (out.combustionAirKgS !== null && r.combustionAirTempC !== null)
    out.qCombustionAirKw =
      out.combustionAirKgS *
      CP_COMBUSTION_AIR_KJKGK *
      (r.combustionAirTempC - cfg.refTempC);
  if (out.stackMassKgS !== null && r.stackTempC !== null)
    out.qStackKw =
      out.stackMassKgS * CP_FLUE_GAS_KJKGK * (r.stackTempC - cfg.refTempC);
  if (out.qLhvKw !== null)
    out.qRadiationLossKw = out.qLhvKw * (cfg.radiationLossPct / 100.0);

  if (
    out.qLhvKw !== null &&
    out.qFuelSensibleKw !== null &&
    out.qCombustionAirKw !== null
  )
    out.qInKw = out.qLhvKw + out.qFuelSensibleKw + out.qCombustionAirKw;
  if (
    out.qInKw !== null &&
    out.qStackKw !== null &&
    out.qRadiationLossKw !== null
  )
    out.qAbsorbedKw = out.qInKw - out.qStackKw - out.qRadiationLossKw;
  if (out.qAbsorbedKw !== null && out.qLhvKw !== null && out.qLhvKw > 0)
    out.etaHeatBalancePct = (100.0 * out.qAbsorbedKw) / out.qLhvKw;

  if (
    r.processFlowKgS !== null &&
    r.processCpKjKgK !== null &&
    r.processInC !== null &&
    r.processOutC !== null
  ) {
    out.qProcessKw =
      r.processFlowKgS * r.processCpKjKgK * (r.processOutC - r.processInC);
    if (out.qLhvKw !== null && out.qLhvKw > 0)
      out.etaProcessPct = (100.0 * out.qProcessKw) / out.qLhvKw;
  }

  if (r.stackO2Pct !== null && r.stackTempC !== null && lhvKjKg > 0) {
    const eaFrac = (out.excessAirPct !== null ? out.excessAirPct : 0) / 100.0;
    const airKg = (1 + eaFrac) * stoichAirKgPerKgFuel(comp);
    const mH2o = h2oKgPerKgFuel(comp);
    const tAmb =
      r.combustionAirTempC !== null ? r.combustionAirTempC : cfg.refTempC;
    const tFuelForLoss = r.fuelTempC !== null ? r.fuelTempC : 25;
    const mFgDry = 1 + airKg - mH2o;
    const lDryKjKg = mFgDry * CP_FLUE_GAS_PTC4_KJKGK * (r.stackTempC - tAmb);
    const lMoistKjKg = mH2o * CP_VAPOR_KJKGK * (r.stackTempC - tFuelForLoss);
    out.dryLossPct = (100.0 * lDryKjKg) / lhvKjKg;
    out.moistureLossPct = (100.0 * lMoistKjKg) / lhvKjKg;
    out.radiationLossPct = cfg.radiationLossPct;
    out.unaccountedLossPct = cfg.unaccountedLossPct;
    out.etaPtc4Pct =
      100.0 -
      out.dryLossPct -
      out.moistureLossPct -
      out.radiationLossPct -
      out.unaccountedLossPct;
  }

  if (out.etaHeatBalancePct !== null && out.etaProcessPct !== null)
    out.etaDeltaPp = out.etaHeatBalancePct - out.etaProcessPct;
  if (
    out.qAbsorbedKw !== null &&
    out.qProcessKw !== null &&
    out.qLhvKw !== null &&
    out.qLhvKw > 0
  ) {
    out.closurePct =
      (100.0 * Math.abs(out.qAbsorbedKw - out.qProcessKw)) / out.qLhvKw;
  }

  return out;
}

/** Mirrors the live engine's buildAlerts(latest, cfg) exactly — `row` here
 *  is calcHeaterRow's output, which (like the live `out` object) carries
 *  both the computed fields and the raw stackTempC/stackO2Pct passthrough. */
export function buildHeaterAlerts(
  row: HeaterRowResult,
  cfg: HeaterConfig,
): EngineeringAlert[] {
  const alerts: EngineeringAlert[] = [];
  if (row.etaHeatBalancePct !== null) {
    if (row.etaHeatBalancePct < cfg.effAlarmPct)
      alerts.push({
        severity: "alarm",
        message: `Efficiency ${row.etaHeatBalancePct.toFixed(2)} % below alarm ${cfg.effAlarmPct.toFixed(0)} %.`,
        source: "API 560",
      });
    else if (row.etaHeatBalancePct < cfg.effAdvisoryPct)
      alerts.push({
        severity: "advisory",
        message: `Efficiency ${row.etaHeatBalancePct.toFixed(2)} % below advisory ${cfg.effAdvisoryPct.toFixed(0)} %.`,
        source: "API 560",
      });
  }
  if (row.stackTempC !== null) {
    if (row.stackTempC >= cfg.stackAlarmC)
      alerts.push({
        severity: "alarm",
        message: `Stack temperature ${row.stackTempC.toFixed(0)} C above alarm ${cfg.stackAlarmC} C.`,
        source: "convection fouling",
      });
    else if (row.stackTempC >= cfg.stackAdvisoryC)
      alerts.push({
        severity: "advisory",
        message: `Stack temperature ${row.stackTempC.toFixed(0)} C above advisory ${cfg.stackAdvisoryC} C.`,
        source: "convection fouling",
      });
  }
  if (row.bridgewallAvgC !== null) {
    if (row.bridgewallAvgC >= cfg.bwAlarmC)
      alerts.push({
        severity: "alarm",
        message: `Bridgewall ${row.bridgewallAvgC.toFixed(0)} C above alarm ${cfg.bwAlarmC} C - tube creep risk.`,
        source: "tube metallurgy",
      });
    else if (row.bridgewallAvgC >= cfg.bwAdvisoryC)
      alerts.push({
        severity: "advisory",
        message: `Bridgewall ${row.bridgewallAvgC.toFixed(0)} C above advisory ${cfg.bwAdvisoryC} C.`,
        source: "tube metallurgy",
      });
  }
  if (row.stackO2Pct !== null) {
    if (row.stackO2Pct < cfg.o2LowPct)
      alerts.push({
        severity: "alarm",
        message: `Stack O2 ${row.stackO2Pct.toFixed(2)} % below ${cfg.o2LowPct} % - CO formation risk.`,
        source: "combustion safety",
      });
    else if (row.stackO2Pct > cfg.o2HighPct)
      alerts.push({
        severity: "advisory",
        message: `Stack O2 ${row.stackO2Pct.toFixed(2)} % above ${cfg.o2HighPct} % - over-air efficiency loss.`,
        source: "burner trim",
      });
  }
  if (row.excessAirPct !== null) {
    if (row.excessAirPct >= cfg.eaAlarmPct)
      alerts.push({
        severity: "alarm",
        message: `Excess air ${row.excessAirPct.toFixed(1)} % above alarm ${cfg.eaAlarmPct} %.`,
        source: "ASME PTC 4",
      });
    else if (row.excessAirPct >= cfg.eaAdvisoryPct)
      alerts.push({
        severity: "advisory",
        message: `Excess air ${row.excessAirPct.toFixed(1)} % above advisory ${cfg.eaAdvisoryPct} %.`,
        source: "ASME PTC 4",
      });
  }
  if (row.etaDeltaPp !== null && Math.abs(row.etaDeltaPp) > 3) {
    alerts.push({
      severity: "advisory",
      message: `Heat-balance vs process-side gap ${row.etaDeltaPp.toFixed(2)} pp - check fuel meter or process Cp.`,
      source: "closure check",
    });
  }
  return alerts;
}

export function rollUpHeaterSeverity(alerts: EngineeringAlert[]): RawSeverity {
  if (alerts.some((a) => a.severity === "alarm")) return "alarm";
  if (alerts.some((a) => a.severity === "advisory")) return "advisory";
  return "ok";
}
