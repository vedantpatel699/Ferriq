import { it, expect } from "vitest";
import { revenueOpex, revenueOpexComponents, DEFAULT_OPEX } from "./opex";
it("splits existing totals equally without adding legacy costs", () => {
  for (const total of [0, 8, 10, 100]) {
    const result = revenueOpex(total, DEFAULT_OPEX, 1, 1000);
    expect(result.items).toHaveLength(4);
    expect(
      result.items.every(
        (item) => item.cadPerOperatingHour === (1000 * total) / 400,
      ),
    ).toBe(true);
    expect(result.annualCad).toBeCloseTo(((1000 * total) / 100) * 7920, 6);
  }
});
it("uses explicit components once, overriding both previous cost modes", () => {
  const split = {
    steam: 1,
    electricity: 2,
    naturalGas: 3,
    chemicalsCatalyst: 4,
  };
  const legacy = structuredClone(DEFAULT_OPEX);
  legacy.maintenance.annualCad = 1e9;
  const result = revenueOpex(80, legacy, 100, 1000, split);
  expect(result.items.map((i) => i.annualCad)).toEqual([
    79200, 158400, 237600, 316800,
  ]);
  expect(result.annualCad).toBe(792000);
  expect(revenueOpex(undefined, undefined, 0, 0, split).annualCad).toBe(0);
});
it("rejects missing, invalid and overallocated component inputs", () => {
  const valid = revenueOpexComponents(8);
  for (const invalid of [
    null,
    [],
    {},
    { ...valid, steam: -1 },
    { ...valid, steam: NaN },
    { ...valid, steam: Infinity },
    { ...valid, steam: "2" },
    { ...valid, steam: true },
    { ...valid, steam: 95 },
    { ...valid, other: 2 },
  ]) {
    expect(() => revenueOpex(undefined, undefined, 1, 1000, invalid)).toThrow();
  }
});
