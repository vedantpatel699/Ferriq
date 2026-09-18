import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { calculate, seedEquipment } from "./catalog";
import {
  forecastThermocouple,
  forecastPass,
  type ThermocoupleModel,
  type FurnaceEntry,
} from "./furnace/calculations";
import {
  combustionMassFlows,
  calcCompositionProps,
  calcHeaterRow,
  DEFAULT_HEATER_CONFIG,
} from "./heater/calculations";
import {
  calcExchangerRow,
  DEFAULT_EXCHANGER_CONFIG,
} from "./exchanger/calculations";
import {
  calcMembraneRow,
  DEFAULT_MEMBRANE_CONFIG,
} from "./membrane/calculations";
import {
  DEFAULT_OPEX,
  operatingCosts,
  revenueOpex,
} from "./crudeToProfit/opex";
import { runModel } from "./crudeToProfit/calculations";
import {
  DEFAULT_CRUDE_TO_PROFIT_CONFIG as cfg,
  DEFAULT_CRUDE_FLOWS_M3HR as flows,
} from "./crudeToProfit/data";
import { validateResource, defaultResources } from "../shared/workspace";

describe("Blower reference and mechanical trends", () => {
  const fixture = () => {
    const data = seedEquipment("air-blower");
    data.config = {
      ...data.config,
      settings: {
        ...(data.config.settings as object),
        baselineTrainingDays: 5,
      },
    };
    data.rows = Array.from({ length: 10 }, (_, i) => ({
      ...data.rows[0],
      timestamp: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      motorCurrentA: 100 + (i % 5),
      motorCurrentB: 0,
      totalFlowNm3hr: (100 + (i % 5)) * 100 * (i > 5 ? 0.9 : 1),
      suctionPressureA: 93,
      dischargePressureA: 85,
      bypassOpA: 0,
      filterDpA: 0.01,
      bearingTempA: [50 + i, 49 + i],
      vibrationA: [1, 1, 1, 1],
    }));
    return data;
  };
  it("uses only a completed reference window and interpolates in its current/pressure envelope", () => {
    const data = fixture(),
      result = calculate("air-blower", data);
    expect(result[4].values.performanceDegradationPct).toBeNull();
    expect(result[8].values.performanceDegradationPct).toBeCloseTo(10);
    for (const patch of [
      { bypassOpA: null },
      { filterDpA: null },
      { motorCurrentA: 140 },
      { dischargePressureA: 100 },
      { motorCurrentB: 110 },
    ]) {
      const altered = fixture();
      Object.assign(altered.rows[8], patch);
      expect(
        calculate("air-blower", altered)[8].values.performanceDegradationPct,
      ).toBeNull();
    }
  });
  it("does not synthesize zero or combine trains in bearing trends", () => {
    const data = fixture();
    data.rows[7] = {
      ...data.rows[7],
      motorCurrentA: 0,
      motorCurrentB: 110,
      bearingTempB: [95, 90],
    };
    data.rows[8] = { ...data.rows[8], bearingTempA: [null, null] };
    const result = calculate("air-blower", data);
    expect(result[8].values.bearingTrendCPerDay).toBeNull();
    expect(result[9].values.bearingTrendCPerDay).toBeCloseTo(1);
    expect(result[9].values.bearingAdvisoryEtaDays).toBeCloseTo(11);
  });
  it("sums electrical power but does not allocate shared flow to one train", () => {
    const data = fixture();
    Object.assign(data.rows[9], { motorCurrentB: 104 });
    const v = calculate("air-blower", data)[9].values;
    expect(v.totalPowerKw).toBeCloseTo(Number(v.powerKw) * 2);
    expect(Number.isFinite(v.efficiencyFluidPct)).toBe(false);
    expect(v.performanceDegradationPct).toBeNull();
  });
  it("matches Python batch eligibility and train-specific trend outputs", () => {
    const data = fixture();
    data.rows[6] = { ...data.rows[6], bypassOpA: null };
    data.rows[7] = { ...data.rows[7], motorCurrentB: 104 };
    data.rows[8] = { ...data.rows[8], bearingTempA: [null, null] };
    const rows = data.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).flatMap(([key, value]) => {
          const name = key
            .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
            .toLowerCase()
            .replace("total_flow_nm3hr", "total_flow")
            .replace("suction_temp_c", "suction_temp");
          return Array.isArray(value)
            ? value.map((v, i) => [`${name}_${i + 1}`, v])
            : [[name, value]];
        }),
      ),
    );
    const py = spawnSync(
      process.env.PYTHON ?? "python",
      [
        "-c",
        `import sys,json
sys.path.insert(0,'python/air_blower')
import engine
print(json.dumps(engine.process_batch(json.load(sys.stdin),settings={'baseline_training_days':5})['results'],allow_nan=False))`,
      ],
      { input: JSON.stringify(rows), encoding: "utf8" },
    );
    expect(py.status, py.stderr).toBe(0);
    const outputs = JSON.parse(py.stdout);
    for (const [i, r] of calculate("air-blower", data).entries())
      for (const [ts, python] of [
        ["expectedFlowNm3hr", "expected_flow_nm3hr"],
        ["performanceDegradationPct", "performance_degradation_pct"],
        ["bearingTrendCPerDay", "bearing_trend_c_per_day"],
        ["totalPowerKw", "total_power_kw"],
      ]) {
        if (r.values[ts] === null) expect(outputs[i][python]).toBeNull();
        else expect(outputs[i][python]).toBeCloseTo(r.values[ts] as number, 8);
      }
  });
});

describe("Furnace timestamps and trained horizon", () => {
  const tree = (value: number) => ({
    feature_names: [],
    base_score: value,
    trees: [],
  });
  const model: ThermocoupleModel = {
    pass: 1,
    feature_names: [],
    p10: tree(430),
    p50: tree(440),
    p90: tree(450),
  };
  it("passes current TC temperature to the trained feature name and reports missing drivers", () => {
    const t = {
      feature_names: ["tc_now", "fuel_gas_kg_hr"],
      base_score: 0,
      trees: [{ f: 0, t: 420, m: 1, l: { v: 410 }, r: { v: 450 } }],
    };
    const m = {
      pass: 1,
      feature_names: t.feature_names,
      p10: t,
      p50: t,
      p90: t,
    };
    const r = forecastThermocouple(m, {}, [425, 430], 24, "TC")!;
    expect(r.modelPrediction.p50).toBe(450);
    expect(r.missingModelInputs).toEqual(["fuel_gas_kg_hr"]);
  });
  it("uses the training seven-day lag velocity rather than the regression slope", () => {
    const t = {
      feature_names: ["tc_velocity_c_per_d"],
      base_score: 0,
      trees: [{ f: 0, t: 1.1, m: 0, l: { v: 410 }, r: { v: 450 } }],
    };
    const m = {
      pass: 1,
      feature_names: t.feature_names,
      p10: t,
      p50: t,
      p90: t,
    };
    const r = forecastThermocouple(
      m,
      {},
      [400, 400, 400, 400, 400, 400, 400, 407],
      24,
      "TC",
    )!;
    expect(r.modelPrediction.p50).toBe(410);
    expect(r.missingModelInputs).toEqual([]);
    const short = forecastThermocouple(m, {}, [400, 407], 24, "TC")!;
    expect(short.missingModelInputs).toEqual(["tc_velocity_c_per_d"]);
  });
  it("keeps gaps and irregular sample intervals; separates quantiles from trend", () => {
    const r = forecastThermocouple(
      model,
      {},
      [400, NaN, 406, 410],
      24,
      "TC",
      [0, 86400000, 3 * 86400000, 5 * 86400000],
      24,
    )!;
    expect(r.slopePerDay).toBeCloseTo(2);
    expect(r.forecast[0].value).toBeCloseTo(412);
    expect(r.modelPrediction).toEqual({
      hours: 24,
      p10: 430,
      p50: 440,
      p90: 450,
    });
    expect(r.forecast[99].p10).toBe(r.forecast[99].p90);
    expect(forecastThermocouple(model, {}, [400, NaN], 24, "TC")).toBeNull();
  });
  it("uses actual pass timestamps and interpolates crossing hours, including already above limit", () => {
    const furnace: FurnaceEntry = {
      key: "f",
      label: "F",
      passes: 1,
      cadence_hours: 24,
      tc_models: { TC: model },
      history: [
        { t: "2026-01-01T00:00:00Z", TC: 469 },
        { t: "2026-01-03T00:00:00Z", TC: 473 },
      ],
    };
    const r = forecastPass(furnace, 1, {}, { TC: [469, 473] }, 475)!;
    expect(r.hoursToAlarm).toBeCloseTo(24);
    expect(r.hoursToAlarmUpperBand).toBeNull();
    expect(forecastPass(furnace, 1, {}, {}, 470)!.hoursToAlarm).toBe(0);
    furnace.history.push({ t: "2026-01-03T04:00:00Z", TC: null });
    const stale = forecastPass(furnace, 1, {}, {}, 475)!;
    expect(stale.dataAgeHours).toBe(4);
    expect(stale.hoursToAlarm).toBe(24);
    expect(stale.observationEpoch).toBe(Date.parse("2026-01-03T00:00:00Z"));
  });
});

describe("Heater, exchanger and membrane dimensional checks", () => {
  it("reconstructs wet oxygen for methane and keeps both air calculations on that basis", () => {
    const fractions = { Methane: 1 },
      props = calcCompositionProps(fractions),
      fuel = { fractions, ...props };
    const actual = combustionMassFlows(1, 5, fuel),
      stoich = combustionMassFlows(1, 0, fuel);
    // CH4 + 2 O2 => CO2 + 2 H2O, plus air N2. Reconstruct mole fraction.
    const nO2 = actual.mCaKgS! / (32 + (79 / 21) * 28.0),
      fuelMol = 1 / props.averageMw;
    expect(
      (nO2 - 2 * fuelMol) / (3 * fuelMol + (nO2 * 79) / 21 + nO2 - 2 * fuelMol),
    ).toBeCloseTo(0.05, 4);
    expect(actual.mSKgS).toBeCloseTo(1 + actual.mCaKgS!);
    const dilutedFractions = { Methane: 0.5, CO2: 0.5 },
      diluted = {
        fractions: dilutedFractions,
        ...calcCompositionProps(dilutedFractions),
      };
    const air = combustionMassFlows(1, 5, diluted).mCaKgS!;
    const o2 = air / (32 + (79 / 21) * 28),
      mol = 1 / diluted.averageMw;
    expect((o2 - mol) / (2 * mol + (o2 * 79) / 21 + o2 - mol)).toBeCloseTo(
      0.05,
      10,
    );
    for (const oxygen of [-1, 21, Infinity, NaN])
      expect(combustionMassFlows(1, oxygen, fuel).mCaKgS).toBeNull();
    const row = {
      timestamp: "2026-01-01",
      fuelFlowKgS: 1,
      combustionAirTempC: 15,
      stackTempC: 294,
      fuelTempC: 25,
      processFlowKgS: 2,
      processInC: 50,
      processOutC: 100,
      processCpKjKgK: 2,
      stackO2Pct: 5,
      bridgewallAC: null,
      bridgewallBC: null,
    };
    const r = calcHeaterRow(row, {
      ...DEFAULT_HEATER_CONFIG,
      fuelCase: "Custom",
      customCase: fuel,
    });
    expect(r.excessAirPct).toBeCloseTo(
      100 * (actual.afRatio! / stoich.afRatio! - 1),
    );
    expect(r.qProcessKw).toBe(200);
    expect(
      calcHeaterRow(row, {
        ...DEFAULT_HEATER_CONFIG,
        fuelCase: "Custom",
        customCase: { ...fuel, fractions: { Methane: 100 } },
      }).combustionAirKgS,
    ).toBeCloseTo(r.combustionAirKgS!);
    expect(
      calcHeaterRow(
        { ...row, fuelCaseOverride: "unknown" },
        DEFAULT_HEATER_CONFIG,
      ).etaHeatBalancePct,
    ).toBeNull();
    expect(
      calcHeaterRow({ ...row, fuelFlowKgS: -1 }, DEFAULT_HEATER_CONFIG)
        .etaHeatBalancePct,
    ).toBeNull();
  });
  it("converts kg/h duty to kW, keeps duty comparison when F is invalid and responds to area", () => {
    const row = {
      timestamp: "x",
      hotInC: 150,
      hotOutC: 100,
      coldInC: 30,
      coldOutC: 80,
      hotFlowKgHr: 3600,
      coldFlowKgHr: 3600,
      hotCpKjKgK: 4,
      coldCpKjKgK: 4,
      shellDpBar: 0,
      tubeDpBar: 0,
    };
    const r = calcExchangerRow(row, DEFAULT_EXCHANGER_CONFIG);
    expect(r.qAvgKw).toBe(200);
    expect(r.qAvgMw).toBe(0.2);
    expect(r.lmtdC).toBe(70);
    expect(r.effectivenessPct).toBeCloseTo((100 * 50) / 120);
    expect(
      calcExchangerRow(row, { ...DEFAULT_EXCHANGER_CONFIG, areaM2: 249.6 })
        .uDirtyWm2k,
    ).toBeCloseTo(r.uDirtyWm2k! / 2);
    expect(
      calcExchangerRow({ ...row, coldOutC: 160 }, DEFAULT_EXCHANGER_CONFIG)
        .dutyDeviationPct,
    ).not.toBeNull();
    expect(
      calcExchangerRow(
        { ...row, hotFlowKgHr: Infinity },
        DEFAULT_EXCHANGER_CONFIG,
      ).qAvgKw,
    ).toBeNull();
  });
  it("accepts zero recovery and rejects negative or impossible flows; applies pressure configuration", () => {
    const row = {
      timestamp: "x",
      feedFlowNm3Hr: 100,
      permeateFlowNm3Hr: 0,
      nonPermeateFlowNm3Hr: null,
      feedH2OnlinePct: 80,
      feedH2LabPct: 80,
      permeateH2OnlinePct: 90,
      permeateH2LabPct: 90,
      feedPressureKpag: 100,
    };
    expect(calcMembraneRow(row).recoveryOnlinePct).toBe(0);
    expect(
      calcMembraneRow({ ...row, permeateFlowNm3Hr: 80 }).recoveryOnlinePct,
    ).toBe(90);
    expect(
      calcMembraneRow({ ...row, permeateFlowNm3Hr: 101 }).recoveryOnlinePct,
    ).toBeNull();
    expect(calcMembraneRow({ ...row, feedFlowNm3Hr: -1 }).ratio).toBeNull();
    const imported = seedEquipment("membrane-analyzer");
    imported.source = "Imported plant CSV";
    const readings = calculate("membrane-analyzer", imported);
    expect(
      readings.every((r) => !r.quality.some((q) => q.includes("synthetic"))),
    ).toBe(true);
    expect(
      calcMembraneRow(row, {
        ...DEFAULT_MEMBRANE_CONFIG,
        designFeedPressureKpag: 80,
      }).feedPressureDeviationPct,
    ).toBe(25);
  });
});

describe("Operating-cost reconciliation", () => {
  const opex = structuredClone(DEFAULT_OPEX);
  opex.electricity = {
    basis: "hourly",
    consumption: 100,
    rate: 0.1,
    annualCad: 999999,
  };
  opex.steam = { basis: "throughput", consumption: 2, rate: 3, annualCad: 0 };
  opex.naturalGas = { basis: "hourly", consumption: 10, rate: 5, annualCad: 0 };
  opex.chemicals = {
    basis: "throughput",
    consumption: 0.1,
    rate: 4,
    annualCad: 0,
  };
  opex.maintenance = {
    basis: "annual",
    consumption: 0,
    rate: 0,
    annualCad: 10000,
  };
  it("charges each selected basis once and retains fixed costs at zero throughput", () => {
    expect(operatingCosts(opex, 100).annualCad).toBe(
      (10 + 600 + 50 + 40) * 7920 + 10000,
    );
    expect(operatingCosts(opex, 0).annualCad).toBe(60 * 7920 + 10000);
    expect(
      operatingCosts(
        {
          ...opex,
          maintenance: {
            basis: "throughput",
            consumption: 0,
            rate: 2,
            annualCad: 10000,
          },
        },
        100,
      ).items[4].annualCad,
    ).toBe(200 * 7920);
  });
  it("reconciles all three cases across all nine technology routes without changing sales or feed costs", () => {
    for (const residue of ["none", "lc_finer", "delayed_coker"] as const)
      for (const gas of ["none", "hydrocracker", "fcc"] as const) {
        const base = runModel(
          flows,
          cfg,
          cfg.crude_price_low_cad_m3,
          cfg.product_price_low_cad_m3,
          residue,
          gas,
        );
        const r = runModel(
          flows,
          { ...cfg, opex },
          cfg.crude_price_low_cad_m3,
          cfg.product_price_low_cad_m3,
          residue,
          gas,
        ).economics;
        for (const c of ["low", "high", "market"] as const) {
          expect(r[`revenue_${c}_cad_hr`]).toBe(
            base.economics[`revenue_${c}_cad_hr`],
          );
          expect(r[`crude_cost_${c}_cad_hr`]).toBe(
            base.economics[`crude_cost_${c}_cad_hr`],
          );
          expect(r[`margin_after_opex_${c}_mcad_yr`]).toBeCloseTo(
            ((r[`revenue_${c}_cad_hr`]! - r[`crude_cost_${c}_cad_hr`]!) *
              7920) /
              1e6 -
              r.operating_costs.annualCad / 1e6,
          );
        }
      }
  });
  it("rejects invalid costs and preserves old scenarios without an OPEX field", () => {
    expect(operatingCosts(undefined, 100).annualCad).toBe(0);
    const old = defaultResources().economics as Record<string, unknown>;
    expect(() => validateResource("economics", old)).not.toThrow();
    expect(
      (
        validateResource("economics", { ...old, config: { ...cfg, opex } }) as {
          config: typeof cfg;
        }
      ).config.opex,
    ).toEqual(opex);
    expect(() =>
      operatingCosts(
        { ...opex, electricity: { ...opex.electricity, rate: -1 } },
        100,
      ),
    ).toThrow();
    expect(() =>
      operatingCosts(
        { ...opex, electricity: { ...opex.electricity, consumption: NaN } },
        100,
      ),
    ).toThrow();
  });
});

describe("Revenue percentage OPEX", () => {
  it("defaults to 8%, handles zero and rejects invalid percentages", () => {
    expect(revenueOpex(undefined, undefined, 1, 1000).annualCad).toBe(633600);
    expect(revenueOpex(0, undefined, 1, 1000).annualCad).toBe(0);
    expect(revenueOpex(8, undefined, 0, 0).annualCad).toBe(0);
    for (const p of [-1, 101, NaN, Infinity, "8", null])
      expect(() => revenueOpex(p, undefined, 1, 1000)).toThrow();
  });
  it("uses each case revenue and replaces rather than adds legacy costs", () => {
    const r = runModel(
      flows,
      { ...cfg, opexRevenuePercent: 10, opex: DEFAULT_OPEX },
      cfg.crude_price_low_cad_m3,
      cfg.product_price_high_cad_m3,
    ).economics;
    for (const [key, cost] of [
      ["low", r.operating_costs],
      ["high", r.operating_costs_high],
      ["market", r.operating_costs_market],
    ] as const) {
      expect(cost!.annualCad).toBeCloseTo(
        r[`revenue_${key}_cad_hr`]! * 7920 * 0.1,
        5,
      );
      expect(r[`margin_after_opex_${key}_mcad_yr`]).toBeCloseTo(
        r[`margin_${key}_mcad_yr`]! - cost!.annualCad / 1e6,
        8,
      );
    }
  });
});
