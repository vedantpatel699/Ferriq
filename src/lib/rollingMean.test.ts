import { expect, it } from "vitest";
import { rollingMean } from "./rollingMean";

it("matches inclusive trailing averages with gaps, tied timestamps and invalid readings", () => {
  const points = [
    { epoch: 0, value: 1 }, { epoch: 2, value: 3 }, { epoch: 2, value: 5 },
    { epoch: 3, value: null }, { epoch: 4, value: NaN }, { epoch: 5, value: Infinity },
    { epoch: 6, value: 7 }, { epoch: 12, value: 9 },
  ];
  const result = rollingMean(points, 4);
  for (const p of points) {
    const values = points.filter(v => v.epoch >= p.epoch - 4 && v.epoch <= p.epoch
      && typeof v.value === "number" && Number.isFinite(v.value)).map(v => v.value as number);
    expect(result.get(p.epoch)).toEqual(values.length >= 2 ? values.reduce((a, b) => a + b) / values.length : null);
  }
});

it("handles the maximum supported dataset", () => {
  const points = Array.from({ length: 50000 }, (_, epoch) => ({ epoch, value: 80 }));
  const result = rollingMean(points, 7000);
  expect(result.size).toBe(50000);
  expect(result.get(49999)).toBe(80);
});
