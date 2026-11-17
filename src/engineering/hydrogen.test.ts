import { describe, it, expect } from "vitest";
import {
  calculateHydrogen,
  defaultScenario,
  feedPreset,
  MOLAR_VOLUME,
  PROFILES,
  type Scenario,
} from "./hydrogen";
function pure(index: number): Scenario {
  const s = defaultScenario();
  s.feeds.forEach((f) => {
    f.flow = 0;
    f.composition = Array(10).fill(0);
    f.composition[index] = 100;
  });
  s.feeds[0].flow = MOLAR_VOLUME;
  return s;
}
function atoms(g: number[]) {
  return [
    g[2] + g[3] + g.slice(4).reduce((v, x, i) => v + x * (i + 1), 0),
    2 * g[0] + g.slice(4).reduce((v, x, i) => v + x * (2 * (i + 1) + 2), 0),
    g[2] + 2 * g[3],
  ];
}
describe("hydrogen reaction model", () => {
  it("uses a common reference volume from the ideal gas law", () => {
    expect(MOLAR_VOLUME).toBeCloseTo(23.644830036, 8);
  });
  it("reproduces supplied methane yield factors and reconciles dataset 2 shift", () => {
    for (const [i, h, w] of [
      [0, 2.833466596793103, 1.3627086686799967],
      [2, 2.816117133926624, 1.3542833256591456],
    ]) {
      const s = pure(4);
      s.settings = { ...PROFILES[i] };
      const t = calculateHydrogen(s).totals;
      expect(t.generatedH2).toBeCloseTo(h, 10);
      expect(t.water).toBeCloseTo(w, 10);
    }
    expect(PROFILES[1].shift).toBeCloseTo(0.7495931796509174, 12);
  });
  it("closes C H O and dry shift flow for all six combinations", () => {
    for (const feedCase of ["A", "B"] as const)
      for (let profile = 0; profile < 3; profile++) {
        const r = calculateHydrogen({
          feedCase,
          profile,
          feeds: feedPreset(feedCase),
          settings: { ...PROFILES[profile] },
        });
        for (const f of r.feeds) {
          const input = atoms(f.inlet),
            output = atoms(f.outlet);
          expect(output[0]).toBeCloseTo(input[0], 8);
          expect(output[1]).toBeCloseTo(input[1] + 2 * f.water, 8);
          expect(output[2]).toBeCloseTo(input[2] + f.water, 8);
          const co = f.reformer[2] - f.outlet[2];
          expect(
            f.outlet.reduce((a, b) => a + b, 0) -
              f.reformer.reduce((a, b) => a + b, 0),
          ).toBeCloseTo(co, 8);
          expect(f.productH2).toBeCloseTo(f.beforePSA * 0.9, 8);
        }
        expect(r.totals.productH2).toBeCloseTo(
          r.feeds.reduce((a, b) => a + b.productH2, 0),
          10,
        );
      }
  });
  it("handles ideal complete methane conversion, CO feed, inert gas, recovery and zero flow", () => {
    const s = pure(4);
    s.settings = { toCO: 1, toCO2: 0, shift: 1, recovery: 0.9 };
    expect(calculateHydrogen(s).totals).toMatchObject({
      generatedH2: 4,
      generatedCO2: 1,
      water: 2,
      productH2: 3.6,
      remainingCO: 0,
    });
    s.settings.recovery = 0;
    expect(calculateHydrogen(s).totals.productH2).toBe(0);
    const co = pure(2);
    co.settings = { toCO: 0, toCO2: 0, shift: 1, recovery: 1 };
    expect(calculateHydrogen(co).totals).toMatchObject({
      generatedH2: 1,
      generatedCO2: 1,
      water: 1,
    });
    for (const index of [0, 1, 3]) {
      const t = calculateHydrogen(pure(index)).totals;
      expect(t.generatedH2).toBe(0);
      expect(t.generatedCO2).toBe(0);
      expect(t.water).toBe(0);
    }
    const zero = defaultScenario();
    zero.feeds.forEach((f) => (f.flow = 0));
    expect(
      Object.values(calculateHydrogen(zero).totals).every((v) => v === 0),
    ).toBe(true);
  });
  it("counts hydrogenation methane and incoming hydrogen separately", () => {
    const s = defaultScenario();
    s.feeds = feedPreset("B");
    s.feeds[1].flow = 0;
    s.settings = { toCO: 1, toCO2: 0, shift: 1, recovery: 1 };
    const n = 1931 / MOLAR_VOLUME,
      t = calculateHydrogen(s).totals;
    expect(t.inletH2).toBeCloseTo(n * 0.96, 10);
    expect(t.generatedH2).toBeCloseTo(n * 0.04 * 4, 10);
    expect(t.productH2).toBeCloseTo(n * 1.12, 10);
  });
  it("normalizes small composition rounding without modifying input", () => {
    const s = defaultScenario(),
      before = JSON.stringify(s);
    const r = calculateHydrogen(s);
    expect(r.feeds[0].inlet.reduce((a, b) => a + b, 0)).toBeCloseTo(
      16173 / MOLAR_VOLUME,
      9,
    );
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects invalid input and overflow", () => {
    for (const value of [-1, NaN, Infinity]) {
      const s = defaultScenario();
      s.feeds[0].flow = value;
      expect(() => calculateHydrogen(s)).toThrow();
    }
    for (const value of [-1, NaN, Infinity, 101]) {
      const s = defaultScenario();
      s.feeds[0].composition[0] = value;
      expect(() => calculateHydrogen(s)).toThrow();
    }
    const bad = defaultScenario();
    bad.settings.toCO = 0.8;
    bad.settings.toCO2 = 0.5;
    expect(() => calculateHydrogen(bad)).toThrow();
    bad.settings = { ...PROFILES[0] };
    bad.feeds[0].composition[0] = 0;
    expect(() => calculateHydrogen(bad)).toThrow();
    const huge = defaultScenario();
    huge.feeds.forEach((f) => (f.flow = Number.MAX_VALUE));
    expect(() => calculateHydrogen(huge)).toThrow();
  });
});
