// Cross-language Air Blower reference check.
// The Python upload is a reference engine. Shared math must match exactly;
// known site behavior differences are asserted explicitly so they cannot drift silently.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { spawnSync } from "node:child_process";

const tsSource = stripTypeScriptTypes(
  fs.readFileSync("src/engineering/blower/calculations.ts", "utf8"),
  { mode: "strip" },
)
  .replace(/^import[^;]+;\s*/gm, "")
  .replace(/\bexport\s+/g, "");

const ts = vm.runInNewContext(
  tsSource +
    ";({DEFAULT_BLOWER_SETTINGS,DEFAULT_BLOWER_LIMITS,shaftPowerKw,normalizePressures,fluidPowerKw,isentropicEfficiency,polytropicEfficiency,detectActiveBlower,processBlowerRow})",
);

const py = spawnSync(
  process.env.PYTHON || "python",
  [
    "-c",
    String.raw`import json, math, sys
sys.path.insert(0, "python/air_blower")
import engine as E

def finite_or_none(v):
    return None if isinstance(v, float) and math.isnan(v) else v

thermo_cases = (
  (283.15,390,0.93,2,1.4),
  (277,277,1,1,1.4),
  (300,410,1,3,1.3),
  (300,280,1,2,1.4),
)
pure = {
  "shaft": [E.shaft_power_kw(4000, i, 0.85) for i in (0, 5, 100, 117)],
  "pressures": list(E.normalize_pressures(93, 105, 0.93)),
  "fluid": E.fluid_power_kw(20000, 0.9),
  "isentropic": [finite_or_none(E.isentropic_efficiency(*x)) for x in thermo_cases],
  "polytropic": [finite_or_none(E.polytropic_efficiency(*x)) for x in thermo_cases],
  "active": [
    E.detect_active_blower(*x)
    for x in (
      (20,0,"auto",10),
      (20,30,"auto",10),
      (30,30,"auto",10),
      (0,0,"auto",10),
      (20,0,"B",10),
    )
  ],
  "python_dp_default": E.DEFAULT_LIMITS["blower_dp_max_bar"],
}

row = {
  "timestamp": "2021-12-22 04:00:00",
  "motor_current_a": 0,
  "motor_current_b": 114.42,
  "suction_pressure_b": 120.18,
  "discharge_pressure_b": 92.01,
  "controller_sp_b": 100,
  "bypass_op_b": 20,
  "filter_dp_b": 0.05,
  "total_flow": 20049.42,
  "suction_temp": 4,
  "discharge_temp_b": 74,
  "vibration_b_1": 0.06,
  "vibration_b_2": 0.04,
  "vibration_b_3": 0.77,
  "vibration_b_4": 0.77,
  "bearing_temp_b_1": 54.39,
  "bearing_temp_b_2": 68.29,
}
normal = E.process_single_row(row, limits={**E.DEFAULT_LIMITS, "blower_dp_max_bar": 1.0})
missing_t2 = E.process_single_row({**row, "discharge_temp_b": None}, limits={**E.DEFAULT_LIMITS, "blower_dp_max_bar": 1.0})
print(json.dumps({"pure":pure,"normal":normal,"missing_t2":missing_t2}, allow_nan=False))`,
  ],
  { encoding: "utf8" },
);
if (py.status !== 0) throw new Error(py.stderr);
const p = JSON.parse(py.stdout);

const close = (a, b, tol = 1e-12) => {
  if (Number.isNaN(a) && Number.isNaN(b)) return;
  assert.ok(Number.isFinite(a) && Number.isFinite(b));
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
};
const pyNum = (x) => (x === null ? NaN : x);

[0, 5, 100, 117].forEach((i, n) => close(ts.shaftPowerKw(4000, i, 0.85), p.pure.shaft[n]));
const [p1, p2] = ts.normalizePressures(93, 105, 0.93);
close(p1, p.pure.pressures[0]);
close(p2, p.pure.pressures[1]);
close(ts.fluidPowerKw(20000, 0.9), p.pure.fluid);

const thermoCases = [
  [283.15,390,0.93,2,1.4],
  [277,277,1,1,1.4],
  [300,410,1,3,1.3],
  [300,280,1,2,1.4],
];
thermoCases.forEach((args, i) => {
  close(ts.isentropicEfficiency(...args), pyNum(p.pure.isentropic[i]));
  close(ts.polytropicEfficiency(...args), pyNum(p.pure.polytropic[i]));
});
const activeCases = [
  [20,0,"auto",10],
  [20,30,"auto",10],
  [30,30,"auto",10],
  [0,0,"auto",10],
  [20,0,"B",10],
];
activeCases.forEach((args, i) => assert.equal(ts.detectActiveBlower(...args), p.pure.active[i]));

const siteRow = {
  timestamp: "2021-12-22T04:00:00",
  motorCurrentA: 0,
  motorCurrentB: 114.42,
  suctionPressureA: NaN,
  suctionPressureB: 120.18,
  dischargePressureA: NaN,
  dischargePressureB: 92.01,
  controllerSpA: NaN,
  controllerSpB: 100,
  bypassOpA: NaN,
  bypassOpB: 20,
  filterDpA: NaN,
  filterDpB: 0.05,
  totalFlowNm3hr: 20049.42,
  suctionTempC: 4,
  dischargeTempA: null,
  dischargeTempB: 74,
  vibrationA: [NaN,NaN,NaN,NaN],
  vibrationB: [0.06,0.04,0.77,0.77],
  bearingTempA: [NaN,NaN],
  bearingTempB: [54.39,68.29],
};
const current = ts.processBlowerRow(siteRow, ts.DEFAULT_BLOWER_SETTINGS, ts.DEFAULT_BLOWER_LIMITS, null);
assert.equal(current.drop, false);
const pairs = {
  powerKw: "power_kw",
  pressureRatio: "pressure_ratio",
  dpBar: "dp_bar",
  p1BarAbs: "p1_bar_abs",
  p2BarAbs: "p2_bar_abs",
  flowNm3hr: "flow_nm3hr",
  fluidPowerKw: "fluid_power_kw",
  efficiencyFluidPct: "efficiency_fluid_pct",
  efficiencyIsentropicPct: "efficiency_isentropic_pct",
  efficiencyPolytropicPct: "efficiency_polytropic_pct",
  efficiencyHeadlinePct: "efficiency_headline_pct",
  maxVibrationMms: "max_vibration_mms",
  maxBearingTempC: "max_bearing_temp_c",
  filterDpBar: "filter_dp_bar",
  bypassOpPct: "bypass_op_pct",
  t1CUsed: "t1_c_used",
};
for (const [tk, pk] of Object.entries(pairs)) {
  // Python intentionally rounds its public row result; compare at that output precision.
  const digits = pk === "pressure_ratio" || pk === "dp_bar" || pk === "p1_bar_abs" || pk === "p2_bar_abs"
    ? 4
    : pk === "flow_nm3hr" || pk === "max_bearing_temp_c" || pk === "bypass_op_pct" || pk === "t1_c_used"
      ? 1
      : pk === "filter_dp_bar"
        ? 3
        : 2;
  assert.equal(Number(current[tk].toFixed(digits)), p.normal[pk], `${tk} row parity`);
}
assert.equal(current.activeBlower, p.normal.active_blower);
assert.equal(current.t1Source, p.normal.t1_source);
assert.equal(current.severity, p.normal.status);

// Intentional divergence #1: live site follows the preserved dashboard's 1.00 bar default.
assert.equal(p.pure.python_dp_default, 0.45);
assert.equal(ts.DEFAULT_BLOWER_LIMITS.blowerDpMaxBar, 1.0);

// Intentional divergence #2: site preserves a labelled fluid-power fallback when T2 is missing.
const noT2 = ts.processBlowerRow({...siteRow, dischargeTempB:null}, ts.DEFAULT_BLOWER_SETTINGS, ts.DEFAULT_BLOWER_LIMITS, null);
assert.equal(p.missing_t2.efficiency_headline_pct, null);
assert.equal(noT2.drop, false);
assert.ok(noT2.efficiencyMethodUsed.includes("fallback to fluid"));
assert.equal(Number(noT2.efficiencyHeadlinePct.toFixed(2)), p.missing_t2.efficiency_fluid_pct);

console.log("PASS: Air Blower Python reference and TypeScript site share the same core math; intentional site differences are explicitly asserted.");
