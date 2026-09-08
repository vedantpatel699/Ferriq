import { describe, it, expect } from "vitest";
import {
  DEFAULT_CRUDE_FLOWS_M3HR,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  LC_FINER_YIELD_WTPCT,
  PRODUCTS,
} from "./data";
import {
  blendCrudes,
  primarySplit,
  cokerYieldWtpct,
  rhcSplit,
  runModel,
  economics,
} from "./calculations";

describe("Crude to Profit — blendCrudes", () => {
  it("blend percentages sum to 100 across the five feeds", () => {
    const blend = blendCrudes(DEFAULT_CRUDE_FLOWS_M3HR);
    const sumPct = Object.values(blend.per_crude).reduce(
      (a, c) => a + c.blend_pct,
      0,
    );
    expect(sumPct).toBeCloseTo(100, 6);
    expect(blend.total_flow_m3hr).toBeCloseTo(
      DEFAULT_CRUDE_FLOWS_M3HR.OSH +
        DEFAULT_CRUDE_FLOWS_M3HR.SHD +
        DEFAULT_CRUDE_FLOWS_M3HR.AWB +
        DEFAULT_CRUDE_FLOWS_M3HR.SCO +
        DEFAULT_CRUDE_FLOWS_M3HR.FRB,
      6,
    );
  });
});

describe("Crude to Profit — primarySplit", () => {
  it("rebuilds vgo from its own lvgo+mvgo+hvgo sub-cuts (mirrors workbook row 21)", () => {
    const primary = primarySplit(
      DEFAULT_CRUDE_FLOWS_M3HR,
      DEFAULT_CRUDE_TO_PROFIT_CONFIG,
    );
    for (const c of ["OSH", "SHD", "AWB", "SCO", "FRB"] as const) {
      const cuts = primary.per_crude[c];
      expect(cuts.vgo).toBeCloseTo(cuts.lvgo + cuts.mvgo + cuts.hvgo, 6);
    }
  });
  it("hydrotreater and hydrocracker feeds are the documented cut sums", () => {
    const primary = primarySplit(
      DEFAULT_CRUDE_FLOWS_M3HR,
      DEFAULT_CRUDE_TO_PROFIT_CONFIG,
    );
    expect(primary.hydrotreater_feed_m3hr).toBeCloseTo(
      primary.totals_m3hr.naphtha + primary.totals_m3hr.ago,
      6,
    );
    expect(primary.hydrocracker_feed_m3hr).toBeCloseTo(
      primary.totals_m3hr.lvgo +
        primary.totals_m3hr.mvgo +
        primary.totals_m3hr.hvgo,
      6,
    );
  });
});

describe("Crude to Profit — residue conversion", () => {
  it("delayed-coker correlation closes to 100 wt% at CCR=15", () => {
    // gas = 7.80 + 0.144*15 = 9.96; naphtha = 11.29 + 0.343*15 = 16.435; coke = 1.60*15 = 24
    const y = cokerYieldWtpct(15);
    expect(y.lpg_fuel_gas).toBeCloseTo(9.96, 6);
    expect(y.rhc_naphtha).toBeCloseTo(16.435, 6);
    expect(y.coke).toBeCloseTo(24.0, 6);
    const gasOilSum = y.diesel + y.rhc_lvgo + y.rhc_mvgo + y.rhc_hvgo;
    expect(y.lpg_fuel_gas + y.rhc_naphtha + y.coke + gasOilSum).toBeCloseTo(
      100,
      6,
    );
  });

  it("LC Finer's own published yield table sums to 100 wt%", () => {
    const sum = Object.values(LC_FINER_YIELD_WTPCT).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it("rhcSplit's byproducts.yield_sum_wtpct matches the selected unit's own table total", () => {
    const result = rhcSplit(100, DEFAULT_CRUDE_TO_PROFIT_CONFIG, "lc_finer");
    expect(result.byproducts.yield_sum_wtpct).toBeCloseTo(100, 2);
  });
});

describe("Crude to Profit — economics", () => {
  it("margin = revenue - cost for both the low and high fixed-price cases", () => {
    const flows = DEFAULT_CRUDE_FLOWS_M3HR;
    const primary = primarySplit(flows, DEFAULT_CRUDE_TO_PROFIT_CONFIG);
    const slate = Object.fromEntries(PRODUCTS.map((p) => [p, 100])) as Record<
      (typeof PRODUCTS)[number],
      number
    >;
    const econ = economics(
      flows,
      slate,
      DEFAULT_CRUDE_TO_PROFIT_CONFIG,
      null,
      null,
    );
    expect(econ.margin_low_cad_hr).toBeCloseTo(
      econ.revenue_low_cad_hr - econ.crude_cost_low_cad_hr,
      6,
    );
    expect(econ.margin_high_cad_hr).toBeCloseTo(
      econ.revenue_high_cad_hr - econ.crude_cost_high_cad_hr,
      6,
    );
    expect(econ.has_market_case).toBe(false);
    // touch primary to avoid unused-var lint noise while keeping the fixture realistic
    expect(primary.totals_m3hr.vr).toBeGreaterThan(0);
  });
});

describe("Crude to Profit — runModel end-to-end (LC Finer / hydrocracker path)", () => {
  it("produces a finite, non-negative product slate with a sensible mass/volume story", () => {
    const result = runModel(
      DEFAULT_CRUDE_FLOWS_M3HR,
      DEFAULT_CRUDE_TO_PROFIT_CONFIG,
      null,
      null,
      "lc_finer",
      "hydrocracker",
    );
    for (const p of PRODUCTS) {
      expect(Number.isFinite(result.product_slate_m3hr[p])).toBe(true);
      expect(result.product_slate_m3hr[p]).toBeGreaterThanOrEqual(0);
    }
    expect(result.economics.margin_low_cad_hr).toEqual(
      result.economics.revenue_low_cad_hr -
        result.economics.crude_cost_low_cad_hr,
    );
    expect(result.byproducts.unit).toBe("lc_finer");
    expect(result.gas_oil_unit).toBe("hydrocracker");
  });

  it("produces a finite slate on the delayed-coker / FCC path too", () => {
    const result = runModel(
      DEFAULT_CRUDE_FLOWS_M3HR,
      DEFAULT_CRUDE_TO_PROFIT_CONFIG,
      null,
      null,
      "delayed_coker",
      "fcc",
    );
    for (const p of PRODUCTS)
      expect(Number.isFinite(result.product_slate_m3hr[p])).toBe(true);
    expect(result.byproducts.unit).toBe("delayed_coker");
    expect(result.gas_oil_unit).toBe("fcc");
    // Coker makes real coke (~24 wt% at CCR=15); confirm it isn't dropped
    expect(result.byproducts.coke_kghr).toBeGreaterThan(0);
  });
});
