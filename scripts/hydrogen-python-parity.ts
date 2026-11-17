import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  calculateHydrogen,
  defaultScenario,
  feedPreset,
  PROFILES,
  type Scenario,
} from "../src/engineering/hydrogen";

const cases: Scenario[] = [];
for (const feedCase of ["A", "B"] as const)
  for (let profile = 0; profile < 3; profile++)
    cases.push({
      feedCase,
      profile,
      feeds: feedPreset(feedCase),
      settings: { ...PROFILES[profile] },
    });
let seed = 2601116;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
for (let i = 0; i < 40; i++) {
  const scenario = defaultScenario();
  scenario.settings.toCO = random();
  scenario.settings.toCO2 = random() * (1 - scenario.settings.toCO);
  scenario.settings.shift = random();
  scenario.settings.recovery = random();
  for (const feed of scenario.feeds) {
    feed.flow = i === 0 ? 0 : random() * 100000;
    const components = Array.from({ length: 10 }, random);
    const sum = components.reduce((a, b) => a + b, 0);
    feed.composition = components.map((x) => (100 * x) / sum);
  }
  cases.push(scenario);
}
for (const component of [0, 1, 2, 3, 4, 9]) {
  const s = defaultScenario();
  s.settings = { toCO: 1, toCO2: 0, shift: 1, recovery: 1 };
  for (const feed of s.feeds) {
    feed.composition.fill(0);
    feed.composition[component] = 100;
  }
  cases.push(s);
}
const invalid = [
  (s: Scenario) => {
    s.feeds[0].flow = -1;
  },
  (s: Scenario) => {
    s.feeds[0].flow = Infinity;
  },
  (s: Scenario) => {
    s.feeds[0].composition[0] = NaN;
  },
  (s: Scenario) => {
    s.feeds[0].composition[0] = -1;
  },
  (s: Scenario) => {
    s.feeds[0].composition[0] = 101;
  },
  (s: Scenario) => {
    s.feeds[0].composition.fill(0);
  },
  (s: Scenario) => {
    s.feeds[0].composition.pop();
  },
  (s: Scenario) => {
    s.settings.toCO = 1;
    s.settings.toCO2 = 0.1;
  },
  (s: Scenario) => {
    s.settings.recovery = -0.01;
  },
  (s: Scenario) => {
    s.settings.shift = 1.01;
  },
  (s: Scenario) => {
    s.profile = 3;
  },
  (s: Scenario) => {
    s.profile = 1.5;
  },
  (s: Scenario) => {
    s.feeds.forEach((f) => {
      f.flow = Number.MAX_VALUE;
    });
  },
];
for (const edit of invalid) {
  const s = defaultScenario();
  edit(s);
  cases.push(s);
}
const serialized = JSON.stringify(cases);
const expected = (JSON.parse(serialized) as Scenario[]).map((s) => {
  try {
    return calculateHydrogen(s);
  } catch {
    return { invalid: true };
  }
});
const proc = spawnSync(
  "python",
  [
    "-c",
    `
import sys,json
sys.path.insert(0,'python')
from hydrogen_production import calculate
results=[]
for scenario in json.load(sys.stdin):
    try: results.append(calculate(scenario))
    except (ValueError,OverflowError): results.append({'invalid':True})
print(json.dumps(results,allow_nan=False))
`,
  ],
  { input: serialized, encoding: "utf8" },
);
assert.equal(proc.status, 0, proc.stderr || String(proc.error));
let comparisons = 0;
function compare(actual: unknown, expected: unknown) {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number");
    assert.ok(
      Math.abs((actual as number) - expected) <=
        1e-8 + Math.abs(expected) * 1e-12,
    );
    comparisons++;
  } else if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual));
    assert.equal(actual.length, expected.length);
    expected.forEach((value, i) => compare(actual[i], value));
  } else if (expected && typeof expected === "object") {
    assert.ok(actual && typeof actual === "object");
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected))
      compare((actual as Record<string, unknown>)[key], value);
  } else assert.equal(actual, expected);
}
compare(JSON.parse(proc.stdout), expected);
console.log(
  `PASS: hydrogen Python/website parity, ${cases.length} scenarios, ${comparisons} numeric comparisons, ${invalid.length} invalid-input cases.`,
);
