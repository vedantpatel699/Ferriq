import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import { demoTimeline, DEMO_START, DEMO_END } from "./simulation";
import { simulatedFurnace } from "./simulatedFurnace";
import { seedEquipment, calculate, equipmentIds, timestamp } from "./catalog";
import { forecastPass, type FurnaceModelBundle } from "./furnace/calculations";
import { resolveTimeRange } from "../lib/timeRange";
import { simulatedEconomics, economicsWindow } from "./crudeToProfit/history";
import {
  DEFAULT_CRUDE_FLOWS_M3HR as flows,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG as config,
} from "./crudeToProfit/data";
describe("Reproducible YTD engineering data", () => {
  it("covers the site year and exact elapsed hourly cadence across DST", () => {
    const times = demoTimeline();
    expect(times[0]).toBe(DEMO_START);
    expect(times.at(-1)).toBe(DEMO_END);
    expect(times.every((t, i) => !i || t - times[i - 1] === 3600000)).toBe(
      true,
    );
    const ytd = resolveTimeRange("ytd", DateTime.fromMillis(DEMO_END));
    expect(+ytd.start).toBe(DEMO_START);
  });
  for (const id of equipmentIds)
    it(
      id + " has valid coherent calculations, separate from boundary fixtures",
      () => {
        const data = seedEquipment(id);
        expect(data).toEqual(seedEquipment(id));
        const rows = calculate(id, data);
        expect(rows.length).toBe(6233);
        for (const row of rows) {
          const v = row.values;
          expect(row.quality).toEqual([]);
          if (id === "air-blower") {
            expect(v.drop).toBe(false);
            expect(Number(v.efficiencyPolytropicPct)).toBeGreaterThan(70);
            expect(Number(v.efficiencyPolytropicPct)).toBeLessThan(80);
          }
          if (id === "fired-heater") {
            expect(v.qProcessKw).toBeCloseTo(Number(v.qAbsorbedKw), 6);
            expect(Number(v.etaHeatBalancePct)).toBeGreaterThan(0);
            expect(Number(v.etaHeatBalancePct)).toBeLessThan(100);
          }
          if (id === "shell-tube-exchanger") {
            expect(v.crossover).toBe(false);
            expect(Number(v.fFactor)).toBeGreaterThan(0);
            expect(v.imbalancePct).toBeCloseTo(0, 6);
            expect(v.rfE4).not.toBeNull();
          }
          if (id === "membrane-analyzer") {
            expect(
              Number(v.permeateFlowNm3Hr) + Number(v.nonPermeateFlowNm3Hr),
            ).toBeCloseTo(Number(v.feedFlowNm3Hr), 7);
            expect(Number(v.recoveryOnlinePct)).toBeGreaterThan(80);
            expect(Number(v.recoveryOnlinePct)).toBeLessThan(100);
          }
        }
        if (id === "air-blower") {
          expect(rows.at(-1)!.values.performanceModelApplicable).toBe(true);
          expect(
            Number(rows[99 * 24].values.performanceDegradationPct),
          ).toBeGreaterThan(4);
          expect(
            Number(rows[101 * 24].values.performanceDegradationPct),
          ).toBeCloseTo(0, 6);
        }
      },
    );
  it("preserves trained models, labels simulation and starts all pass forecasts at the common cutoff", () => {
    const original = JSON.parse(
      readFileSync("reference/furnace-trained-model.json", "utf8"),
    ) as FurnaceModelBundle;
    const bundle = simulatedFurnace(original);
    expect(bundle.trained_at).toBe(original.trained_at);
    for (const [key, f] of Object.entries(bundle.furnaces)) {
      expect(f.tc_models).toEqual(original.furnaces[key].tc_models);
      expect(timestamp(f.history[0].t)).toBe(DEMO_START);
      expect(timestamp(f.history.at(-1)!.t)).toBe(DEMO_END);
      for (let pass = 1; pass <= f.passes; pass++) {
        const r = forecastPass(
          f,
          pass,
          {},
          {},
          bundle.alarm_threshold_c,
          bundle.horizon_hours,
        )!;
        expect(r.observationEpoch).toBe(DEMO_END);
        expect(r.dataAgeHours).toBe(0);
        expect(r.missingThermocouples).toEqual([]);
        expect(r.skinNowC).toBeGreaterThan(150);
        expect(r.skinNowC).toBeLessThan(475);
      }
    }
  });
  it("integrates partial financial intervals exactly once and reconciles OPEX with revenue", () => {
    const h = simulatedEconomics(
      flows,
      { ...config, opexRevenuePercent: 8 },
      "lc_finer",
      "hydrocracker",
    );
    const total = (a: number, b: number) =>
      economicsWindow(h, a, b).reduce((s, r) => {
        expect(r.opexCad).toBeCloseTo(r.revenueCad * 0.08, 5);
        expect(r.marginCad).toBeCloseTo(
          r.revenueCad - r.feedCostCad - r.opexCad,
          5,
        );
        return s + r.revenueCad;
      }, 0);
    const mid = DEMO_START + 123.25 * 86400000;
    expect(total(DEMO_START, DEMO_END)).toBeCloseTo(
      total(DEMO_START, mid) + total(mid, DEMO_END),
      4,
    );
    const day = resolveTimeRange("24h", DateTime.fromMillis(DEMO_END));
    expect(
      economicsWindow(h, +day.start, +day.end).reduce(
        (s, r) => s + r.operatingHours,
        0,
      ),
    ).toBeCloseTo((24 * 330) / 365, 8);
    expect(economicsWindow(h, DEMO_END, DEMO_END + 86400000)).toEqual([]);
  });
});
