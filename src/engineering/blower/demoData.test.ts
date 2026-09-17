import { describe, expect, it } from "vitest";
import { BLOWER_DEMO_DATA } from "./demoData";
import {
  DEFAULT_BLOWER_LIMITS,
  DEFAULT_BLOWER_SETTINGS,
  processBlowerRow,
} from "./calculations";
import { calculate, seedEquipment } from "../catalog";

describe("Air Blower reference dataset", () => {
  it("keeps the corrected source mapping and expected date range", () => {
    expect(BLOWER_DEMO_DATA).toHaveLength(200);
    expect(BLOWER_DEMO_DATA[0].Date).toBe("2025-05-01 03:59:59");
    expect(BLOWER_DEMO_DATA.at(-1)?.Date).toBe("2025-06-15 03:59:59");
  });

  it("contains physically coherent active-train measurements", () => {
    for (const r of BLOWER_DEMO_DATA) {
      expect(r["Motor Current A"]).toBeGreaterThan(10);
      expect(r["Motor Current B"]).toBe(0);
      expect(r["Suction Press A"]).toBeGreaterThan(80);
      expect(r["Suction Press A"]).toBeLessThan(110);
      expect(r["Discharge Press A"]).toBeGreaterThan(50);
      expect(r["Discharge Press A"]).toBeLessThan(150);
      expect(r["Filter DP A"]).toBeGreaterThanOrEqual(0);
      expect(r["Filter DP A"]).toBeLessThan(0.1);
      expect(r["Total Flow"]).toBeGreaterThan(5000);
      expect(r["Total Flow"]).toBeLessThan(100000);
      expect(r["Suction Temp"]).toBeGreaterThan(-10);
      expect(r["Suction Temp"]).toBeLessThan(20);
      expect(r["Discharge Temp A"]).toBeGreaterThan(r["Suction Temp"]);
      expect(r["Discharge Temp B"]).toBeGreaterThan(r["Suction Temp"]);
      expect(r["Vibration B1"]).toBeGreaterThan(0);
      expect(r["Bearing Temp B1"]).toBeGreaterThan(40);

      const p1 = r["Suction Press A"] / 100;
      const p2 =
        r["Discharge Press A"] / 100 +
        DEFAULT_BLOWER_SETTINGS.atmPressureBar;
      expect(p2).toBeGreaterThan(p1);
    }
  });

  it("exercises thermodynamic efficiency and the thrust screening proxy", () => {
    const rows = calculate("air-blower", seedEquipment("air-blower"));
    expect(rows).toHaveLength(200);
    expect(
      Number.isFinite(Number(rows.at(-1)?.values.efficiencyPolytropicPct)),
    ).toBe(true);
    expect(Number.isFinite(Number(rows.at(-1)?.values.thrustProxyPct))).toBe(
      true,
    );
  });

  it("uses the configured time-based baseline and suppresses off-envelope degradation", () => {
    const rows = calculate("air-blower", seedEquipment("air-blower"));
    const trained = rows.filter(
      (r) => Number(r.values.performanceModelTrainingRows) > 0,
    );
    expect(trained.length).toBeGreaterThan(0);
    expect(Number(trained[0].values.performanceModelTrainingRows)).toBeGreaterThan(14);

    const offEnvelope = rows.find(
      (r) =>
        Number(r.values.bypassOpPct) >=
        DEFAULT_BLOWER_SETTINGS.performanceBypassMaxPct,
    );
    expect(offEnvelope).toBeDefined();
    expect(offEnvelope?.values.performanceModelApplicable).toBe(false);
    expect(offEnvelope?.values.performanceDegradationPct).toBeNull();
  });

  it("produces plausible power, pressure rise and fluid-power indicators", () => {
    for (const r of BLOWER_DEMO_DATA) {
      const result = processBlowerRow(
        {
          timestamp: r.Date,
          motorCurrentA: r["Motor Current A"],
          motorCurrentB: r["Motor Current B"],
          suctionPressureA: r["Suction Press A"],
          suctionPressureB: r["Suction Press B"],
          dischargePressureA: r["Discharge Press A"],
          dischargePressureB: r["Discharge Press B"],
          controllerSpA: r["Controller SP A"],
          controllerSpB: r["Controller SP B"],
          bypassOpA: r["Bypass OP A"],
          bypassOpB: r["Bypass OP B"],
          filterDpA: r["Filter DP A"],
          filterDpB: r["Filter DP B"],
          totalFlowNm3hr: r["Total Flow"],
          suctionTempC: r["Suction Temp"],
          dischargeTempA: r["Discharge Temp A"],
          dischargeTempB: r["Discharge Temp B"],
          vibrationA: [
            r["Vibration A1"],
            r["Vibration A2"],
            r["Vibration A3"],
            r["Vibration A4"],
          ],
          vibrationB: [NaN, NaN, NaN, NaN],
          bearingTempA: [r["Bearing Temp A1"], r["Bearing Temp A2"]],
          bearingTempB: [NaN, NaN],
        },
        DEFAULT_BLOWER_SETTINGS,
        DEFAULT_BLOWER_LIMITS,
        null,
      );
      expect(result.drop).toBe(false);
      if (result.drop) continue;
      expect(result.activeBlower).toBe("A");
      expect(result.powerKw).toBeGreaterThan(550);
      expect(result.powerKw).toBeLessThan(750);
      expect(result.dpBar).toBeGreaterThan(0.8);
      expect(result.dpBar).toBeLessThan(1.0);
      expect(result.pressureRatio).toBeGreaterThan(1.9);
      expect(result.pressureRatio).toBeLessThan(2.1);
      expect(result.efficiencyFluidPct).toBeGreaterThan(40);
      expect(result.efficiencyFluidPct).toBeLessThan(85);
      expect(result.t1Source).toBe("measured");
      expect(Number.isFinite(result.efficiencyPolytropicPct)).toBe(true);
    }
  });
});
