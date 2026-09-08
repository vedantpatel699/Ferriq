import { describe, it, expect } from "vitest";
import { defaultResources, validateResource } from "./workspace";
import {
  seedEquipment,
  equipmentIds,
  calculate,
  normalizeRows,
} from "../engineering/catalog";
import { csv, parseCsv } from "../lib/files";
import {
  evalTreeNode,
  buildFeatureVector,
} from "../engineering/furnace/calculations";
describe("Published dataset and import contracts", () => {
  it("retains full HTML datasets and round trips canonical CSV including probe arrays", () => {
    const counts = [45, 60, 228, 51];
    equipmentIds.forEach((id, i) => {
      const d = seedEquipment(id);
      expect(d.rows).toHaveLength(counts[i]);
      expect(normalizeRows(id, parseCsv(csv(d.rows)))).toEqual(d.rows);
      expect(calculate(id, d)).toHaveLength(counts[i]);
      expect(() => validateResource(id, d)).not.toThrow();
    });
  });
  it("rejects reversed shifts, negative crude flow, duplicate times and incomplete snapshots", () => {
    expect(() =>
      validateResource("settings", { shiftStartHour: 19, shiftEndHour: 7 }),
    ).toThrow();
    const e = defaultResources().economics as any;
    expect(() =>
      validateResource("economics", { ...e, flows: { ...e.flows, OSH: -1 } }),
    ).toThrow();
    expect(() =>
      validateResource("economics", {
        ...e,
        market: {
          date: "2026-09-07",
          source: "Test",
          currency: "CAD",
          unit: "CAD/m3",
          crude: {},
          product: {},
        },
      }),
    ).toThrow();
    const d = seedEquipment("air-blower");
    expect(() =>
      validateResource("air-blower", { ...d, rows: [d.rows[0], d.rows[0]] }),
    ).toThrow();
  });
  it("walks actual numeric feature positions and missing directions", () => {
    const vector = buildFeatureVector(
      ["flow", "skin_max_now"],
      { flow: 5 },
      430,
      420,
      1,
    );
    const tree = { f: 0, t: 10, m: 0, l: { v: 3 }, r: { v: 9 } };
    expect(evalTreeNode(tree, vector)).toBe(3);
    expect(evalTreeNode(tree, [NaN])).toBe(9);
    expect(vector[1]).toBe(430);
  });
  it("never substitutes zero for missing thermodynamic efficiency", () => {
    const d = seedEquipment("air-blower");
    d.rows = d.rows.map((r) => ({
      ...r,
      dischargeTempA: null,
      dischargeTempB: null,
    }));
    const r = calculate("air-blower", d).at(-1)!;
    expect(Number.isFinite(r.values.efficiencyPolytropicPct)).toBe(false);
    expect(r.quality.join(" ")).toContain("fluid-power");
  });
});
