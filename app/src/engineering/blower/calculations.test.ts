import { describe, it, expect } from "vitest";
import {
  shaftPowerKw, normalizePressures, fluidPowerKw, isentropicEfficiency,
  polytropicEfficiency, processBlowerRow, DEFAULT_BLOWER_SETTINGS, DEFAULT_BLOWER_LIMITS,
} from "./calculations";

// Golden values from backend-air-blower.md §8 "Worked Validation Example"
// (row 1 of demo.csv, verified against engine.process_single_row() output
// 2026-04-04). These must keep passing through any future refactor.
describe("Air Blower — backend-air-blower.md §8 worked example", () => {
  const V = 4000, I = 114.42, PF = 0.85;
  const suctionKpaa = 120.18, dischargeKpag = 92.01, patm = 0.93;
  const flow = 20049.42, t1c = 4.0, t2c = 74.0, k = 1.4;

  it("shaft power ≈ 673.82 kW", () => {
    expect(shaftPowerKw(V, I, PF)).toBeCloseTo(673.82, 1);
  });

  it("pressure normalization: P1≈1.2018, P2≈1.8501, dP≈0.6483, r≈1.5394", () => {
    const [p1, p2] = normalizePressures(suctionKpaa, dischargeKpag, patm);
    expect(p1).toBeCloseTo(1.2018, 4);
    expect(p2).toBeCloseTo(1.8501, 4);
    expect(p2 - p1).toBeCloseTo(0.6483, 4);
    expect(p2 / p1).toBeCloseTo(1.5394, 4);
  });

  it("fluid power ≈ 361.06 kW, η_fluid ≈ 53.58%", () => {
    const [p1, p2] = normalizePressures(suctionKpaa, dischargeKpag, patm);
    const pfluid = fluidPowerKw(flow, p2 - p1);
    expect(pfluid).toBeCloseTo(361.06, 1);
    const pelec = shaftPowerKw(V, I, PF);
    expect((pfluid / pelec) * 100).toBeCloseTo(53.58, 1);
  });

  it("isentropic efficiency ≈ 51.94%", () => {
    const [p1, p2] = normalizePressures(suctionKpaa, dischargeKpag, patm);
    const t1K = t1c + 273.15, t2K = t2c + 273.15;
    expect(isentropicEfficiency(t1K, t2K, p1, p2, k) * 100).toBeCloseTo(51.94, 1);
  });

  it("polytropic efficiency ≈ 54.74% and exceeds isentropic", () => {
    const [p1, p2] = normalizePressures(suctionKpaa, dischargeKpag, patm);
    const t1K = t1c + 273.15, t2K = t2c + 273.15;
    const poly = polytropicEfficiency(t1K, t2K, p1, p2, k) * 100;
    const isen = isentropicEfficiency(t1K, t2K, p1, p2, k) * 100;
    expect(poly).toBeCloseTo(54.74, 1);
    expect(poly).toBeGreaterThan(isen);
  });

  it("full row: ADVISORY on blower dP > 0.45 bar design (doc's own limits), OK vibration/bearing", () => {
    // The worked example in the doc uses the historic 0.45 bar blower-dP
    // design limit to demonstrate the advisory; DEFAULT_BLOWER_LIMITS here
    // intentionally carries the live dashboard's 1.00 bar override (see
    // calculations.ts comment), so we pass the doc's own limit explicitly
    // to reproduce its documented ADVISORY result.
    const result = processBlowerRow(
      {
        timestamp: "2021-12-22T04:00:00",
        motorCurrentA: 0, motorCurrentB: I,
        suctionPressureA: NaN, suctionPressureB: suctionKpaa,
        dischargePressureA: NaN, dischargePressureB: dischargeKpag,
        controllerSpA: NaN, controllerSpB: NaN,
        bypassOpA: NaN, bypassOpB: NaN,
        filterDpA: NaN, filterDpB: NaN,
        totalFlowNm3hr: flow,
        suctionTempC: null,
        dischargeTempA: null, dischargeTempB: t2c,
        vibrationA: [NaN, NaN, NaN, NaN], vibrationB: [0.06, 0.04, 0.77, 0.77],
        bearingTempA: [NaN, NaN], bearingTempB: [54.39, 68.29],
      },
      DEFAULT_BLOWER_SETTINGS,
      { ...DEFAULT_BLOWER_LIMITS, blowerDpMaxBar: 0.45 },
      null,
    );
    expect(result.drop).toBe(false);
    if (result.drop) throw new Error("unreachable");
    expect(result.activeBlower).toBe("B");
    expect(result.t1Source).toBe("default");
    expect(result.t1CUsed).toBeCloseTo(4.0, 4);
    expect(result.maxVibrationMms).toBeCloseTo(0.77, 2);
    expect(result.maxBearingTempC).toBeCloseTo(68.29, 2);
    expect(result.severity).toBe("advisory");
    expect(result.alerts.some((a) => a.message.includes("Blower dP"))).toBe(true);
  });
});
