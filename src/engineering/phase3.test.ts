import { expect, it, vi } from "vitest";
import { calculate, seedEquipment } from "./catalog";
import * as simulation from "./simulation";
import { validateResource } from "../shared/workspace";

it("validates saved configuration without generating demo history", () => {
  const data = seedEquipment("air-blower");
  const generator = vi.spyOn(simulation, "simulatedEquipment");
  try {
    expect(() => validateResource("air-blower", data)).not.toThrow();
    expect(generator).not.toHaveBeenCalled();
  } finally {
    generator.mockRestore();
  }
});

it("preserves blower rejection and does not turn missing bypass into a closed valve", () => {
  const data = seedEquipment("air-blower");
  const normal = data.rows.at(-1)!;
  const rejected = calculate("air-blower", {
    ...data,
    rows: [{ ...normal, totalFlowNm3hr: null }],
  })[0];
  expect(rejected.values.drop).toBe(true);
  expect(rejected.values.reason).toContain("missing critical tag");
  const missing = calculate("air-blower", {
    ...data,
    rows: [{ ...normal, bypassOpA: null, bypassOpB: null }],
  })[0];
  expect(Number.isFinite(missing.values.thrustProxyPct)).toBe(false);
  expect(missing.alerts.some((a) => a.source === "control narrative")).toBe(
    false,
  );
});

it("does not project a bearing crossing from cancellation in a symmetric trend", () => {
  const data = seedEquipment("air-blower");
  data.rows = data.rows
    .slice(0, 7)
    .map((row, i) => ({
      ...row,
      bearingTempA: [60 + (i === 3 ? 1 : 0)],
      bearingTempB: [60],
    }));
  const last = calculate("air-blower", data).at(-1)!;
  expect(last.values.bearingTrendCPerDay).toBe(0);
  expect(last.values.bearingAdvisoryEtaDays).toBeNull();
});


it("rejects malformed original furnace history before rendering", async () => {
  const { readFileSync } = await import("node:fs");
  const bundle = JSON.parse(readFileSync("public/data/furnace-skin-temp-model.json", "utf8"));
  bundle.furnaces.heater_1.reference_history = "not an array";
  expect(() => validateResource("furnace-model", bundle)).toThrow();
});
