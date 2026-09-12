import { describe, it, expect } from "vitest";
import { runModel } from "./calculations";
import {
  DEFAULT_CRUDE_FLOWS_M3HR as flows,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG as cfg,
  type ResidueUnit,
  type GasOilUnit,
} from "./data";
const run = (r: ResidueUnit, g: GasOilUnit) =>
  runModel(flows, cfg, null, null, r, g);
describe("Once-through conversion routing", () => {
  for (const r of ["none", "lc_finer", "delayed_coker"] as const)
    for (const g of ["none", "hydrocracker", "fcc"] as const) {
      it(`${r} + ${g}: feed and annual accounting`, () => {
        const x = run(r, g),
          pool = x.routing.slice(1, 4).reduce((a, b) => a + b.flow_m3hr, 0);
        expect(x.routing[1].flow_m3hr).toBeCloseTo(
          x.primary.totals_m3hr.vgo,
          10,
        );
        expect(
          g === "none"
            ? x.hc_reactor_products_m3hr.uco
            : x.gas_oil_byproducts.feed_m3hr,
        ).toBeCloseTo(pool, 10);
        expect(x.product_slate_m3hr.uco).toBe(x.hc_reactor_products_m3hr.uco);
        expect(x.economics.margin_low_mcad_yr).toBeCloseTo(
          ((x.economics.revenue_low_cad_hr -
            x.economics.crude_cost_low_cad_hr) *
            7920) /
            1e6,
          8,
        );
        const z = runModel(
          { OSH: 0, SHD: 0, AWB: 0, SCO: 0, FRB: 0 },
          cfg,
          null,
          null,
          r,
          g,
        );
        expect(Object.values(z.product_slate_m3hr).every((v) => v === 0)).toBe(
          true,
        );
        expect(z.economics.margin_low_mcad_yr).toBe(0);
      });
    }
  it("bypasses VR without feeding it to FCC or selling it", () => {
    const x = run("none", "fcc");
    expect(x.unpriced_residue_m3hr).toBe(x.primary.totals_m3hr.vr);
    expect(x.gas_oil_byproducts.feed_m3hr).toBeCloseTo(
      x.primary.totals_m3hr.vgo,
      10,
    );
    expect(x.byproducts.feed_m3hr).toBe(0);
  });
  it("keeps coker gas oil unsplit and closes the residue mass balance", () => {
    const x = run("delayed_coker", "fcc"),
      r = x.rhc_products_m3hr,
      b = x.byproducts;
    expect(b.yield_wtpct.gas_oil_pool).toBeCloseTo(49.605, 10);
    for (const k of ["diesel", "rhc_lvgo", "rhc_mvgo", "rhc_hvgo"])
      expect(r[k]).toBe(0);
    expect(
      (Number(r.rhc_naphtha) + Number(r.gas_oil_pool)) * 862 +
        b.coke_kghr +
        b.lpg_fuel_gas_kghr,
    ).toBeCloseTo(b.feed_kghr, 7);
  });
  it("includes LC Finer HVGO and retains bottoms", () => {
    const x = run("lc_finer", "none"),
      r = x.rhc_products_m3hr;
    expect(x.routing[2].flow_m3hr).toBeCloseTo(
      Number(r.rhc_lvgo) + Number(r.rhc_mvgo) + Number(r.rhc_hvgo),
      10,
    );
    expect(x.unpriced_residue_m3hr).toBe(Number(r.unconverted_residue));
    expect(
      [
        "rhc_naphtha",
        "diesel",
        "rhc_lvgo",
        "rhc_mvgo",
        "rhc_hvgo",
        "unconverted_residue",
      ].reduce((a, k) => a + Number(r[k]) * 862, 0) +
        x.byproducts.lpg_fuel_gas_kghr,
    ).toBeCloseTo(x.byproducts.feed_kghr, 7);
  });
  it("Grace FCC products retain categories and expose the unpriced closure gap", () => {
    const x = run("delayed_coker", "fcc"),
      h = x.hc_reactor_products_m3hr,
      m = x.gas_oil_byproducts.feed_kghr!;
    expect(h.naphtha * 730).toBeCloseTo(m * 0.519, 7);
    expect(h.lpg * 560).toBeCloseTo(m * 0.133, 7);
    expect(h.uco * 1050).toBeCloseTo(m * 0.086, 8);
    expect(h.diesel * 950).toBeCloseTo(m * 0.167, 8);
    expect(x.gas_oil_byproducts.unallocated_kghr).toBeCloseTo(m * 0.002, 8);
    expect(h.kerosene + h.swing_diesel + h.swing_naphtha).toBe(0);
    expect(
      h.naphtha * 730 +
        h.lpg * 560 +
        h.diesel * 950 +
        h.uco * 1050 +
        x.gas_oil_byproducts.unallocated_kghr! +
        x.gas_oil_byproducts.coke_kghr +
        x.gas_oil_byproducts.dry_gas_kghr,
    ).toBeCloseTo(m, 7);
  });
  it("rejects impossible coker yields", () => {
    expect(() =>
      runModel(
        flows,
        { ...cfg, coker_feed_ccr_wtpct: 100 },
        null,
        null,
        "delayed_coker",
        "fcc",
      ),
    ).toThrow("invalid yields");
  });
});
