import { firstDifference } from "./submission-compare";
/** Independent website outputs, saved for offline Python comparisons.
 * Rebuild with npm run submission:fixtures. This imports production engines.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { DateTime } from "luxon";
import {
  seedEquipment,
  calculate,
  normalizeRows,
  type EquipmentId,
} from "../src/engineering/catalog";
import {
  calcHeaterRow,
  buildHeaterAlerts,
} from "../src/engineering/heater/calculations";
import {
  calcExchangerRow,
  buildExchangerAlerts,
} from "../src/engineering/exchanger/calculations";
import {
  calcMembraneRow,
  buildMembraneAlerts,
} from "../src/engineering/membrane/calculations";
import {
  forecastPass,
  statusForSkin,
} from "../src/engineering/furnace/calculations";
import { simulateFlowSplit } from "../src/poc/scenario";
import { runModel } from "../src/engineering/crudeToProfit/calculations";
import {
  DEFAULT_CRUDE_FLOWS_M3HR,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG,
} from "../src/engineering/crudeToProfit/data";
import {
  simulatedEconomics,
  economicsWindow,
} from "../src/engineering/crudeToProfit/history";
import { demoTimeline, demoOperation } from "../src/engineering/simulation";
import { DEFAULT_OPEX } from "../src/engineering/crudeToProfit/opex";
import { formatNumber } from "../src/lib/format";
const root = "submission/sudhakar/";
const defaults = JSON.parse(readFileSync(root + "data/defaults.json", "utf8"));
const clean = (v: any) => JSON.parse(JSON.stringify(v));
const stamp = (v: string) =>
  DateTime.fromISO(v, { zone: "America/Edmonton" }).toFormat(
    "yyyy-MM-dd'T'HH:mm:ssZZ",
  );
const cases: any[] = [];
function envelope(
  model: string,
  rows: any[],
  config: any = {},
  parameters: any = {},
) {
  return {
    schemaVersion: "1.0",
    model,
    source: "simulated verification fixture",
    timezone: "America/Edmonton",
    config,
    parameters,
    measurements: rows.map(({ timestamp, ...values }) => ({
      timestamp: stamp(timestamp),
      values,
    })),
  };
}
// Explicit output mapping documents which derived site fields are delivered.
const blowerKeys =
  "drop activeBlower sharedFlowAmbiguous totalPowerKw powerKw powerFactorUsed pressureRatio dpBar p1BarAbs p2BarAbs flowNm3hr fluidPowerKw efficiencyFluidPct efficiencyIsentropicPct efficiencyPolytropicPct efficiencyHeadlinePct efficiencyMethodUsed maxVibrationMms maxBearingTempC filterDpBar bypassOpPct t1CUsed t1Source thrustProxyPct expectedFlowNm3hr flowResidualPct performanceDegradationPct performanceModelTrainingRows performanceModelIntercept performanceModelSlope performanceModelApplicable bearingTrendCPerDay vibrationTrendMmsPerDay bearingAdvisoryEtaDays thrustHealth".split(
    " ",
  );
function equipment(model: EquipmentId, rows: any[], config: any) {
  if (model === "air-blower")
    return calculate(model, {
      rows: normalizeRows(model, rows),
      config,
      source: "submission fixture",
    }).map((r) =>
      r.values.drop
        ? { timestamp: r.values.timestamp, drop: true, reason: r.values.reason }
        : {
            timestamp: r.values.timestamp,
            ...Object.fromEntries(blowerKeys.map((k) => [k, r.values[k]])),
            severity: r.alerts.some((a) => a.severity === "trip")
              ? "trip"
              : r.alerts.some((a) => a.severity === "alarm")
                ? "alarm"
                : r.alerts.some((a) => a.severity === "advisory")
                  ? "advisory"
                  : "ok",
            alerts: r.alerts.map(({ severity, source }) => ({
              severity,
              source,
            })),
          },
    );
  const fn: any =
    model === "fired-heater"
      ? calcHeaterRow
      : model === "shell-tube-exchanger"
        ? calcExchangerRow
        : calcMembraneRow;
  const alerts: any =
    model === "fired-heater"
      ? buildHeaterAlerts
      : model === "shell-tube-exchanger"
        ? buildExchangerAlerts
        : buildMembraneAlerts;
  return rows.map((r) => {
    const value = fn(r, config);
    const a = alerts(value, config).map(({ severity, source }: any) => ({
      severity,
      source,
    }));
    return {
      ...value,
      alerts: a,
      severity: a.some((v: any) => v.severity === "alarm")
        ? "alarm"
        : a.length
          ? "advisory"
          : "ok",
    };
  });
}
function addEquipment(
  model: EquipmentId,
  name: string,
  rows: any[],
  patch: any = {},
) {
  const config = structuredClone(defaults[model]);
  for (const [k, v] of Object.entries(patch))
    config[k] = typeof v === "object" ? { ...config[k], ...v } : v;
  const input = envelope(model, rows, config);
  const canonical = input.measurements.map((r) => ({
    timestamp: r.timestamp,
    ...r.values,
  }));
  cases.push({
    name,
    input,
    expected: clean(equipment(model, canonical, config)),
  });
}
for (const id of [
  "air-blower",
  "fired-heater",
  "shell-tube-exchanger",
  "membrane-analyzer",
] as EquipmentId[]) {
  const data = seedEquipment(id);
  const normal = data.rows.at(-1)!;
  addEquipment(id, "complete simulated YTD", data.rows);
  addEquipment(id, "normal", [normal]);
  const fields = Object.keys(normal).filter((k) => k !== "timestamp");
  for (const key of fields)
    addEquipment(id, "missing " + key, [{ ...normal, [key]: null }]);
  for (const value of [0, -1, -300])
    addEquipment(id, "boundary " + value, [
      Object.fromEntries(
        Object.entries(normal).map(([k, v]) => [
          k,
          typeof v === "number" ? value : v,
        ]),
      ),
    ]);
  const config =
    id === "air-blower"
      ? {
          settings: {
            motorVoltageV: 4100,
            powerFactorMode: "fixed",
            baselineTrainingDays: 7,
          },
        }
      : id === "fired-heater"
        ? { radiationLossPct: 2, refTempC: 20 }
        : id === "shell-tube-exchanger"
          ? { nShell: 1, areaM2: 150, uCleanWm2k: 550 }
          : { designFeedPressureKpag: 16000 };
  addEquipment(id, "changed configuration", data.rows.slice(-24), config);
  if (id === "air-blower") {
    addEquipment(
      id,
      "bounded suction fallback",
      data.rows
        .slice(0, 8)
        .map((r, i) => ({ ...r, suctionTempC: i ? null : r.suctionTempC })),
    );
    addEquipment(id, "two running trains", [{ ...normal, motorCurrentB: 120 }]);
    addEquipment(id, "explicit inactive train", [normal], {
      settings: { blowerMode: "B" },
    });
  }
  if (id === "fired-heater") {
    for (const fractions of [
      { Methane: 2, CO2: 1 },
      { Hydrogen_Sulfide: 0.1, Methane: 0.9 },
      { Unknown: 1 },
      { Methane: -1 },
      { Methane: 0 },
    ])
      addEquipment(id, "custom fuel " + JSON.stringify(fractions), [normal], {
        fuelCase: "Custom",
        customCase: { fractions, averageMw: 1, lhvMjKg: 1 },
      });
  }
}
const flows = DEFAULT_CRUDE_FLOWS_M3HR;
for (const residue of ["none", "lc_finer", "delayed_coker"] as const)
  for (const gas of ["none", "hydrocracker", "fcc"] as const)
    for (const percent of [0, 8, 12.5, 100]) {
      const cfg = {
        ...DEFAULT_CRUDE_TO_PROFIT_CONFIG,
        opexRevenuePercent: percent,
      };
      const timestamp = "2026-09-17T17:00:00-06:00";
      const input = envelope("crude-to-profit", [{ timestamp, flows }], cfg, {
        residueUnit: residue,
        gasOilUnit: gas,
      });
      cases.push({
        name: `routing ${residue}/${gas}; OPEX ${percent}`,
        input,
        expected: [
          {
            ...clean(runModel(flows, cfg, null, null, residue, gas)),
            timestamp,
          },
        ],
      });
    }
const bundle = JSON.parse(
  readFileSync(root + "data/furnace-model.json", "utf8"),
);
// Price completeness, zero feed, legacy itemized OPEX, and percentage replacement.
for (const variant of [
  "zero feed",
  "complete market",
  "incomplete market",
  "itemized",
  "percentage replaces items",
]) {
  const cfg: any = structuredClone(DEFAULT_CRUDE_TO_PROFIT_CONFIG);
  if (variant.includes("item") || variant === "itemized") {
    cfg.opex = structuredClone(DEFAULT_OPEX);
    cfg.opex.electricity = {
      basis: "hourly",
      consumption: 2500,
      rate: 0.1,
      annualCad: 900000,
    };
    cfg.opex.steam = {
      basis: "throughput",
      consumption: 0.2,
      rate: 40,
      annualCad: 0,
    };
    cfg.opex.maintenance = {
      basis: "annual",
      consumption: 0,
      rate: 0,
      annualCad: 500000,
    };
    if (variant === "itemized") delete cfg.opexRevenuePercent;
  }
  const f =
    variant === "zero feed"
      ? Object.fromEntries(Object.keys(flows).map((k) => [k, 0]))
      : flows;
  const market: any = {
    crude: { ...cfg.crude_price_high_cad_m3 },
    product: { ...cfg.product_price_low_cad_m3 },
  };
  if (variant === "incomplete market") delete market.product.diesel;
  const input = envelope(
    "crude-to-profit",
    [{ timestamp: "2026-09-17T17:00:00-06:00", flows: f, market }],
    cfg,
  );
  cases.push({
    name: variant,
    input,
    expected: [
      {
        ...clean(runModel(f as any, cfg, market.crude, market.product)),
        timestamp: input.measurements[0].timestamp,
      },
    ],
  });
}
// Use the production generator's inputs and integration path, including partial intervals.
const times = demoTimeline(24),
  cfg = DEFAULT_CRUDE_TO_PROFIT_CONFIG;
const intervals = simulatedEconomics(flows, cfg, "delayed_coker", "fcc");
for (const days of [260, 7, 1 / 48]) {
  const end = times.at(-1)!,
    start = Math.max(times[0], end - days * 86400000);
  const reference = economicsWindow(intervals, start, end);
  const rows = times.slice(0, -1).flatMap((t, i) => {
    if (times[i + 1] <= start || t >= end) return [];
    const { day, load } = demoOperation(t),
      factor = 0.5 + 0.2 * Math.sin(day / 31);
    const blend = (lo: any, hi: any) =>
      Object.fromEntries(
        Object.keys(lo).map((k) => [k, lo[k] * (1 - factor) + hi[k] * factor]),
      );
    return [
      {
        timestamp: new Date(t).toISOString(),
        intervalEnd: new Date(times[i + 1]).toISOString(),
        flows: Object.fromEntries(
          Object.entries(flows).map(([k, v]) => [k, v * load]),
        ),
        market: {
          crude: blend(cfg.crude_price_low_cad_m3, cfg.crude_price_high_cad_m3),
          product: blend(
            cfg.product_price_low_cad_m3,
            cfg.product_price_high_cad_m3,
          ),
        },
      },
    ];
  });
  const input = envelope("crude-to-profit", rows, cfg, {
    residueUnit: "delayed_coker",
    gasOilUnit: "fcc",
    integrationWindow: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    },
  });
  const expected = input.measurements.map(
    ({ timestamp, values }: any, i: number) => {
      const p = reference[i];
      return {
        ...clean(
          runModel(
            values.flows,
            cfg,
            values.market.crude,
            values.market.product,
            "delayed_coker",
            "fcc",
          ),
        ),
        timestamp,
        period: {
          operatingHours: p.operatingHours,
          revenueCad: p.revenueCad,
          feedCostCad: p.feedCostCad,
          opexCad: p.opexCad,
          marginCad: p.marginCad,
        },
      };
    },
  );
  cases.push({ name: `historical integration ${days} days`, input, expected });
}
for (const [key, f] of Object.entries(bundle.furnaces) as [string, any][]) {
  for (const variant of [
    "YTD",
    "missing latest TC",
    "irregular history",
    "already above limit",
  ]) {
    const furnace = structuredClone(f);
    if (variant !== "YTD") furnace.history = furnace.history.slice(-55);
    const alias = Object.keys(furnace.tc_models)[0];
    if (variant === "missing latest TC") furnace.history.at(-1)[alias] = null;
    if (variant === "already above limit") furnace.history.at(-1)[alias] = 480;
    if (variant === "irregular history")
      furnace.history = furnace.history.filter(
        (_: any, i: number) => i % 4 !== 1,
      );
    const rows = furnace.history.map(({ t, ...v }: any) => ({
      timestamp: t,
      ...v,
    }));
    const pass = f.passes >= 3 ? 3 : 1;
    const input = envelope("furnace-skin-temp", rows, {
      furnace: key,
      pass,
      horizonDays: 7,
    });
    furnace.history = input.measurements.map(({ timestamp, values }: any) => ({
      t: timestamp,
      ...values,
    }));
    const passes = Array.from({ length: f.passes }, (_, i) =>
      forecastPass(
        furnace,
        i + 1,
        {},
        {},
        bundle.alarm_threshold_c,
        bundle.horizon_hours,
      ),
    );
    const selected = passes[pass - 1]!;
    cases.push({
      name: key + " " + variant,
      input,
      expected: clean({
        passes,
        severity: selected
          ? statusForSkin(selected.skinNowC, selected.hoursToAlarm)
          : "unavailable",
        projection: selected?.forecast.slice(0, 7) ?? [],
        scenario: null,
      }),
    });
    if (variant === "YTD" && pass === 3) {
      const last = furnace.history.at(-1);
      const reference =
        (100 * last.flow_p3) /
        Array.from(
          { length: f.passes },
          (_, i) => last["flow_p" + (i + 1)],
        ).reduce((a: number, b: number) => a + b, 0);
      cases.push({
        name: key + " flow-split scenario",
        input: { ...input, parameters: { flowSplit: reference - 2 } },
        expected: clean({
          passes,
          severity: statusForSkin(selected.skinNowC, selected.hoursToAlarm),
          projection: selected.forecast.slice(0, 7),
          scenario: simulateFlowSplit(
            selected,
            reference,
            reference - 2,
            bundle.alarm_threshold_c,
          ),
        }),
      });
    }
  }
}
// Capture actual display formatting at 1/2/4 decimals, sampled throughout each output.
function leaves(v: any, path: (string | number)[] = []): any[] {
  return typeof v === "number" || v === null
    ? [{ path, value: v }]
    : v && typeof v === "object"
      ? Object.entries(v).flatMap(([k, x]) =>
          leaves(x, [...path, Array.isArray(v) ? Number(k) : k]),
        )
      : [];
}
for (const c of cases) {
  const all = leaves(c.expected),
    stride = Math.max(1, Math.floor(all.length / 80));
  c.display = all
    .filter((_: any, i: number) => i % stride === 0)
    .flatMap(({ path, value }: any) =>
      [1, 2, 4].map((digits) => ({
        path,
        digits,
        text: formatNumber(value, digits),
      })),
    );
  if (Array.isArray(c.expected) && c.input.model !== "crude-to-profit") {
    const last = DateTime.fromISO(
      c.input.measurements.at(-1).timestamp,
    ).toMillis();
    c.input.window = {
      start: new Date(last - 7 * 86400000).toISOString(),
      end: new Date(last).toISOString(),
    };
    const selected = c.expected.filter(
      (r: any) =>
        DateTime.fromISO(r.timestamp).toMillis() >= last - 7 * 86400000,
    );
    const keys = [
      ...new Set(
        selected.flatMap((r: any) =>
          Object.keys(r).filter(
            (k) => typeof r[k] === "number" && Number.isFinite(r[k]),
          ),
        ),
      ),
    ] as string[];
    c.window = {
      count: selected.length,
      sampleAverages: Object.fromEntries(
        keys.map((k) => {
          const xs = selected
            .map((r: any) => r[k])
            .filter((v: any) => typeof v === "number" && Number.isFinite(v));
          return [k, xs.reduce((a: number, b: number) => a + b, 0) / xs.length];
        }),
      ),
    };
  }
}
const fixture = gzipSync(JSON.stringify(cases), { level: 9 });
if (process.argv.includes("--check")) {
  const difference = firstDifference(
    JSON.parse(
      gunzipSync(readFileSync(root + "tests/website-cases.json.gz")).toString(),
    ),
    JSON.parse(gunzipSync(fixture).toString()),
  );
  if (difference) throw Error("Submission fixtures differ: " + difference);
} else writeFileSync(root + "tests/website-cases.json.gz", fixture);
for (const model of Object.keys(defaults)) {
  const c = cases.find(
    (c) =>
      c.input.model === model &&
      (c.name === "normal" ||
        c.name.includes("OPEX 8") ||
        c.name === "heater_1 YTD"),
  )!;
  if (!process.argv.includes("--check")) {
    writeFileSync(
      root + `examples/${model}.input.json`,
      JSON.stringify(c.input, null, 2) + "\n",
    );
    writeFileSync(
      root + `examples/${model}.expected.json`,
      JSON.stringify(c.expected) + "\n",
    );
  }
}
console.log(`${cases.length} production-engine fixture cases written`);
