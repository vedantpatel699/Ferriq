import { describe, it, expect } from "vitest";
import { FUEL_GAS_CASES } from "./fuelData";
import {
  stoichO2KgPerKgFuel, stoichAirKgPerKgFuel, h2oKgPerKgFuel, calcCompositionProps,
  calcHeaterRow, buildHeaterAlerts, rollUpHeaterSeverity, DEFAULT_HEATER_CONFIG,
} from "./calculations";

// Golden values hand-derived from the live fired-heater.html engine's own
// stoichiometry formulas (not from backend-fired-heater.md, whose fixed
// natural-gas-only constants the live app does not use).
describe("Fired Heater — fuel composition stoichiometry", () => {
  const natGas = FUEL_GAS_CASES["Type Natural Gas (Startup, pilot)"];

  it("stoichiometric O2/air/H2O per kg fuel for a ~94% methane blend", () => {
    expect(stoichO2KgPerKgFuel(natGas)).toBeCloseTo(3.806, 2);
    expect(stoichAirKgPerKgFuel(natGas)).toBeCloseTo(16.40, 1);
    expect(h2oKgPerKgFuel(natGas)).toBeCloseTo(2.118, 2);
  });

  it("calcCompositionProps round-trips a preset's own averageMw/lhvMjKg", () => {
    const props = calcCompositionProps(natGas.fractions);
    expect(props.averageMw).toBeCloseTo(natGas.averageMw, 1);
    expect(props.lhvMjKg).toBeCloseTo(natGas.lhvMjKg, 1);
    expect(props.sum).toBeCloseTo(1.0, 2);
  });
});

describe("Fired Heater — calcHeaterRow internal energy-balance consistency", () => {
  const row = {
    timestamp: "2026-02-01T00:00:00Z",
    fuelFlowKgS: 0.849, combustionAirTempC: 15, stackTempC: 294, fuelTempC: 25,
    processFlowKgS: 25, processInC: 80, processOutC: 140, processCpKjKgK: 2.8,
    stackO2Pct: 4.27, bridgewallAC: 780, bridgewallBC: 776,
  };

  it("qIn = qLhv + qFuelSensible + qCombustionAir, qAbs = qIn - qStack - qRad", () => {
    const result = calcHeaterRow(row, DEFAULT_HEATER_CONFIG);
    expect(result.qLhvKw).not.toBeNull();
    expect(result.qInKw as number).toBeCloseTo((result.qLhvKw! + result.qFuelSensibleKw! + result.qCombustionAirKw!), 4);
    expect(result.qAbsorbedKw as number).toBeCloseTo((result.qInKw! - result.qStackKw! - result.qRadiationLossKw!), 4);
    expect(result.etaHeatBalancePct as number).toBeGreaterThan(0);
    expect(result.etaHeatBalancePct as number).toBeLessThan(100);
    expect(result.bridgewallAvgC).toBeCloseTo(778, 4);
  });

  it("PTC4 indirect efficiency: 100 - dry - moist - rad - unacc", () => {
    const result = calcHeaterRow(row, DEFAULT_HEATER_CONFIG);
    expect(result.etaPtc4Pct as number).toBeCloseTo(
      100 - result.dryLossPct! - result.moistureLossPct! - result.radiationLossPct! - result.unaccountedLossPct!, 4,
    );
  });

  it("bridgewall above alarm (870C) triggers alarm and rolls up severity", () => {
    const hot = { ...row, bridgewallAC: 900, bridgewallBC: 895 };
    const result = calcHeaterRow(hot, DEFAULT_HEATER_CONFIG);
    const alerts = buildHeaterAlerts(result, DEFAULT_HEATER_CONFIG);
    expect(alerts.some((a) => a.source === "tube metallurgy" && a.severity === "alarm")).toBe(true);
    expect(rollUpHeaterSeverity(alerts)).toBe("alarm");
  });

  it("stack O2 below 2% (CO risk) is an alarm regardless of efficiency", () => {
    const lowO2 = { ...row, stackO2Pct: 1.5 };
    const result = calcHeaterRow(lowO2, DEFAULT_HEATER_CONFIG);
    const alerts = buildHeaterAlerts(result, DEFAULT_HEATER_CONFIG);
    expect(alerts.some((a) => a.source === "combustion safety" && a.severity === "alarm")).toBe(true);
  });
});
