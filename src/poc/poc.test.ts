import { describe, it, expect } from "vitest";
import { calculate, metricsFor, normalizeRows } from "../engineering/catalog";
import {
  demoBlower,
  cleanBaseline,
  healthScore,
  metricFacts,
  windowAverage,
  alignComparison,
} from "./blower";
import { flowSplitDomain, simulateFlowSplit, crossingHours } from "./scenario";
import { csv, parseCsv } from "../lib/files";
import {
  forecastPass,
  type FurnaceModelBundle,
} from "../engineering/furnace/calculations";
import { readFileSync } from "node:fs";
const data = demoBlower(),
  rows = calculate("air-blower", data),
  latest = rows.at(-1)!,
  metrics = metricsFor("air-blower", data.config, latest),
  bearing = metrics.find((m) => m.key === "maxBearingTempC")!;
describe("POC quality and comparison contracts", () => {
  it("computes the demo through the original engine and exposes an honest score", () => {
    expect(latest.values.maxBearingTempC).toBeCloseTo(71.8);
    expect(latest.values.efficiencyPolytropicPct).toBeCloseTo(78.8, 1);
    expect(latest.values.powerKw).toBeCloseTo(685);
    expect(healthScore(metrics, rows).score).toBe(82);
    expect(healthScore(metrics, cleanBaseline()).score).toBe(100);
  });
  it.each(["stale", "missing"] as const)(
    "excludes %s from condition alerts, scores, averages and comparison",
    (kind) => {
      const r = calculate("air-blower", demoBlower(kind));
      const last = r.at(-1)!;
      expect(metricFacts(bearing, last).reliable).toBe(false);
      expect(last.alerts.some((a) => /Bearing T/.test(a.message))).toBe(false);
      expect(healthScore(metrics, r).score).toBeNull();
      expect(windowAverage(bearing, [last])).toBeNull();
      expect(
        alignComparison([last], cleanBaseline().slice(-1), bearing)[0].delta,
      ).toBeNull();
    },
  );
  it("retains a disclosed bounded fallback and round-trips quality metadata", () => {
    expect(rows[711].qualityByMetric?.efficiencyPolytropicPct?.state).toBe(
      "Fallback",
    );
    expect(metricFacts(metrics[1], rows[711]).reliable).toBe(true);
    const d = demoBlower("stale");
    expect(normalizeRows("air-blower", parseCsv(csv(d.rows)))).toEqual(d.rows);
  });
  it("never interpolates mismatched sampling times", () => {
    const a = [rows[0], rows[2]],
      b = rows.slice(0, 3).map((r) => ({ ...r, epoch: r.epoch - 600000 }));
    const c = alignComparison(a, b, bearing);
    expect(c[1].a).toBeNull();
    expect(c[1].delta).toBeNull();
    expect(c[0].aTime! - c[0].bTime!).toBe(600000);
  });
  it("keeps original strict pressure thresholds", () => {
    const m = metrics.find((m) => m.key === "filterDpBar")!;
    expect(
      metricFacts(m, {
        ...latest,
        values: { ...latest.values, filterDpBar: 0.1 },
      }).severity,
    ).toBe("ok");
    expect(
      metricFacts(m, {
        ...latest,
        values: { ...latest.values, filterDpBar: 0.101 },
      }).severity,
    ).toBe("advisory");
  });
  it("parses quoted line breaks and rejects malformed CSV", () => {
    expect(parseCsv('a,b\n"two\nlines","say ""yes"""')[0]).toEqual({
      a: "two\nlines",
      b: 'say "yes"',
    });
    expect(() => parseCsv("a,a\n1,2")).toThrow();
    expect(() => parseCsv("a,b\n1")).toThrow();
  });
});
describe("Explicit flow-split simulation", () => {
  const bundle = JSON.parse(
    readFileSync(
      new URL(
        "../../public/data/furnace-skin-temp-model.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as FurnaceModelBundle;
  const furnace = bundle.furnaces.heater_1,
    last = furnace.history.at(-1)!;
  const current = Object.fromEntries(
    Object.entries(last).filter(([, v]) => typeof v === "number"),
  ) as Record<string, number>;
  const history = Object.fromEntries(
    Object.keys(furnace.tc_models).map((a) => [
      a,
      furnace.history
        .map((r) => r[a])
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        ),
    ]),
  );
  const baseline = forecastPass(
    furnace,
    3,
    current,
    history,
    bundle.alarm_threshold_c,
  )!;
  it("uses complete observed flow ratios and leaves baseline immutable", () => {
    const domain = flowSplitDomain(furnace)!;
    expect(domain.baseline).toBeGreaterThan(0);
    expect(domain.min).toBeLessThanOrEqual(domain.baseline);
    expect(domain.max).toBeGreaterThanOrEqual(domain.baseline);
    const before = JSON.stringify(baseline);
    const result = simulateFlowSplit(
      baseline,
      domain.baseline,
      domain.baseline - 2.5,
      475,
    );
    expect(result.effect24).toEqual([-7, -2]);
    expect(result.mode).toContain("not validated");
    expect(JSON.stringify(baseline)).toBe(before);
    expect(
      result.forecast.every((f) => Number.isFinite(f.value) && f.p10 <= f.p90),
    ).toBe(true);
  });
  it("zero adjustment preserves original forecasts and rejects invalid splits", () => {
    const result = simulateFlowSplit(baseline, 25, 25, 475);
    expect(result.forecast).toEqual(baseline.forecast);
    expect(() => simulateFlowSplit(baseline, 25, NaN, 475)).toThrow();
    expect(() => simulateFlowSplit(baseline, 25, 100, 475)).toThrow();
  });
  it("reports exact crossing and already-exceeded conditions", () => {
    const f = [{ day: 1, value: 480, p10: 475, p50: 480, p90: 485 }];
    expect(crossingHours(f, 470, 475)).toBe(12);
    expect(crossingHours(f, 475, 475)).toBe(0);
    expect(crossingHours(f, 470, 490)).toBeNull();
  });
});
