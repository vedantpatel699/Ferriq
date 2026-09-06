import { describe, it, expect } from "vitest";
import { calcExchangerRow, buildExchangerAlerts, rollUpExchangerSeverity, DEFAULT_EXCHANGER_CONFIG, lmtdCorrectionF } from "./calculations";

// Golden values below are hand-derived directly from the live engine's own
// formulas (calcRow / calcF), NOT from backend-shell-tube-exchanger.md —
// that doc's worked example uses a fixed F=0.90/area=250/U_clean=400 model
// the live app does not implement, and its own arithmetic doesn't even
// self-check (its stated LMTD of 73.57°C doesn't follow from its own
// shown ΔT1/ΔT2). These tests instead pin down the actual running formula.
describe("Shell & Tube Exchanger — live-engine formula verification", () => {
  const row = {
    timestamp: "2026-02-01T00:00:00Z",
    hotInC: 180.5, hotOutC: 100.2, hotFlowKgHr: 50000, hotCpKjKgK: 2.15,
    coldInC: 40.1, coldOutC: 150.8, coldFlowKgHr: 50100, coldCpKjKgK: 2.05,
    shellDpBar: 0.18, tubeDpBar: 0.22,
  };

  it("LMTD correction factor F ≈ 0.750 for N=2 shell passes", () => {
    // P = (Tc_out-Tc_in)/(Th_in-Tc_in), R = (Th_in-Th_out)/(Tc_out-Tc_in)
    const P = (150.8 - 40.1) / (180.5 - 40.1);
    const R = (180.5 - 100.2) / (150.8 - 40.1);
    const F = lmtdCorrectionF(P, R, 2);
    expect(F).not.toBeNull();
    expect(F as number).toBeCloseTo(0.750, 2);
  });

  it("heat duties, LMTD, U, Rf, effectiveness match hand-derived values", () => {
    const result = calcExchangerRow(row, DEFAULT_EXCHANGER_CONFIG);
    expect(result.crossover).toBe(false);
    expect(result.qHotKw).toBeCloseTo(2397.85, 1);
    expect(result.qColdKw).toBeCloseTo(3158.19, 1);
    expect(result.qAvgKw).toBeCloseTo(2778.02, 1);
    expect(result.imbalancePct).toBeCloseTo(27.37, 1);
    expect(result.lmtdC).toBeCloseTo(43.13, 1);
    expect(result.fFactor as number).toBeCloseTo(0.750, 2);
    expect(result.uDirtyWm2k as number).toBeCloseTo(688.0, -1);
    expect(result.effectivenessPct as number).toBeCloseTo(69.35, 1);
    expect(result.approachHotC).toBeCloseTo(29.7, 1);
    expect(result.approachColdC).toBeCloseTo(60.1, 1);
    expect(result.dutyDeviationPct as number).toBeCloseTo(-20.63, 1);
  });

  it("rolls up to ALARM on duty deviation and flags imbalance advisory", () => {
    const result = calcExchangerRow(row, DEFAULT_EXCHANGER_CONFIG);
    const alerts = buildExchangerAlerts(result, DEFAULT_EXCHANGER_CONFIG);
    expect(alerts.some((a) => a.source === "duty vs design" && a.severity === "alarm")).toBe(true);
    expect(alerts.some((a) => a.source === "energy balance" && a.severity === "advisory")).toBe(true);
    expect(rollUpExchangerSeverity(alerts)).toBe("alarm");
  });

  it("temperature crossover (dT1<=0) sets crossover and returns null F", () => {
    const bad = { ...row, coldOutC: 200 }; // Tc_out > Th_in -> dT1 <= 0
    const result = calcExchangerRow(bad, DEFAULT_EXCHANGER_CONFIG);
    expect(result.crossover).toBe(true);
    expect(result.fFactor).toBeNull();
    const alerts = buildExchangerAlerts(result, DEFAULT_EXCHANGER_CONFIG);
    expect(alerts.some((a) => a.source === "LMTD / F-factor")).toBe(true);
  });
});
