import { describe, it, expect } from "vitest";
import { calcMembraneRow, buildMembraneAlerts, rollUpMembraneSeverity, synthesizeOnlineFeedH2, DEFAULT_MEMBRANE_CONFIG } from "./calculations";

// Golden values are hand-derived from the live membrane-analyzer.html
// engine's actual recovery/ratio model — NOT from backend-membrane-
// analyzer.md, which documents a stage-cut/selectivity/permeance model the
// live app does not implement at all.
describe("Membrane Analyzer — live-engine recovery/ratio model", () => {
  const baseRow = {
    timestamp: "2026-02-01T08:30:00",
    feedFlowNm3Hr: 5000, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 3000,
    permeateH2OnlinePct: 95.0, permeateH2LabPct: 94.5,
    feedH2LabPct: 87.0, feedH2OnlinePct: null,
    feedPressureKpag: 15890,
  };

  it("backfills non-permeate flow and computes ratio = feed/non-permeate", () => {
    const result = calcMembraneRow(baseRow);
    expect(result.nonPermeateFlowNm3Hr).toBeCloseTo(2000, 4);
    expect(result.ratio as number).toBeCloseTo(2.5, 4);
  });

  it("online recovery uses feed-H2-online (falling back to lab) and permeate-H2-online", () => {
    const result = calcMembraneRow(baseRow);
    expect(result.recoveryOnlinePct as number).toBeCloseTo(65.517, 2);
    expect(result.recoveryLabPct as number).toBeCloseTo(65.172, 2);
  });

  it("recovery below the 75% floor is an advisory; at-design feed pressure raises nothing", () => {
    const result = calcMembraneRow(baseRow);
    const alerts = buildMembraneAlerts(result, DEFAULT_MEMBRANE_CONFIG);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].source).toBe("recovery target");
    expect(alerts[0].severity).toBe("advisory");
    expect(rollUpMembraneSeverity(alerts)).toBe("advisory");
  });

  it("ratio at/above 6.4 alarms as over-recovery", () => {
    const overRecovery = { ...baseRow, permeateFlowNm3Hr: 4300, nonPermeateFlowNm3Hr: 700 };
    const result = calcMembraneRow(overRecovery);
    expect(result.ratio as number).toBeCloseTo(5000 / 700, 3);
    const alerts = buildMembraneAlerts(result, DEFAULT_MEMBRANE_CONFIG);
    expect(alerts.some((a) => a.source === "recovery ratio controller" && a.severity === "alarm")).toBe(true);
    expect(rollUpMembraneSeverity(alerts)).toBe("alarm");
  });

  it("permeate H2 below the 90% alarm floor alarms regardless of recovery", () => {
    const lowPurity = { ...baseRow, permeateH2OnlinePct: 88.0 };
    const result = calcMembraneRow(lowPurity);
    const alerts = buildMembraneAlerts(result, DEFAULT_MEMBRANE_CONFIG);
    expect(alerts.some((a) => a.source === "permeate analyzer" && a.severity === "alarm")).toBe(true);
  });

  it("synthesizeOnlineFeedH2 interpolates between lab samples deterministically", () => {
    const lab = [87.0, null, null, null, 89.0];
    const synth = synthesizeOnlineFeedH2(lab);
    expect(synth[0]).toBeCloseTo(87.0, 0);
    expect(synth[4]).toBeCloseTo(89.0, 0);
    // midpoint should land between the two lab bounds within the +/-0.18 drift band
    expect(synth[2] as number).toBeGreaterThan(87.0);
    expect(synth[2] as number).toBeLessThan(89.5);
    // deterministic: same input always yields the same output series
    expect(synthesizeOnlineFeedH2(lab)).toEqual(synth);
  });
});
