import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  evalTreeNode, predictTreeModel, statusForSkin, forecastPass, type FurnaceModelBundle, type TreeNode,
} from "./calculations";

describe("Furnace Skin TI Predictor — XGBoost tree walker", () => {
  // A tiny hand-built 3-node tree: split on "x" at threshold 10.
  const tree: TreeNode = { f: "x", t: 10, m: 1, l: { v: -1 }, r: { v: 2 } };

  it("routes left when the feature is below the split threshold", () => {
    expect(evalTreeNode(tree, { x: 5 })).toBe(-1);
  });
  it("routes right when the feature is at/above the split threshold", () => {
    expect(evalTreeNode(tree, { x: 15 })).toBe(2);
  });
  it("routes missing values per the node's missing-direction flag (m=1 -> left)", () => {
    expect(evalTreeNode(tree, {})).toBe(-1);
  });
  it("predictTreeModel sums base_score plus every tree's contribution", () => {
    const model = { trees: [tree, tree], base_score: 100, feature_names: ["x"] };
    expect(predictTreeModel(model, { x: 5 })).toBe(100 + -1 + -1);
    expect(predictTreeModel(model, { x: 15 })).toBe(100 + 2 + 2);
  });
});

describe("Furnace Skin TI Predictor — status classification", () => {
  it("measured >= 470C is always alarm regardless of forecast", () => {
    expect(statusForSkin(471, null)).toBe("alarm");
  });
  it("measured < 460C but <24h to alarm threshold is still alarm (imminence overrides measured value)", () => {
    expect(statusForSkin(440, 12)).toBe("alarm");
  });
  it("measured 460-470C is advisory", () => {
    expect(statusForSkin(465, null)).toBe("advisory");
  });
  it("measured below 460C with no near-term crossing is ok", () => {
    expect(statusForSkin(430, 500)).toBe("ok");
  });
});

describe("Furnace Skin TI Predictor — forecastPass smoke test against the real trained model", () => {
  const modelPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/data/furnace-skin-temp-model.json");
  const bundle: FurnaceModelBundle = JSON.parse(readFileSync(modelPath, "utf-8"));

  it("loads the real model.json bundle and produces a finite, internally-consistent forecast for heater_1 pass 1", () => {
    const furnace = bundle.furnaces["heater_1"];
    expect(furnace).toBeDefined();

    const tcAliases = Object.keys(furnace.tc_models).filter((a) => furnace.tc_models[a].pass === 1);
    expect(tcAliases.length).toBeGreaterThan(0);

    const historyByAlias: Record<string, number[]> = {};
    for (const alias of tcAliases) {
      historyByAlias[alias] = furnace.history.map((row) => row[alias] as number).filter((v) => v !== null && v !== undefined);
    }
    // Current operating state: the numeric non-history fields a feature
    // vector might reference (flow/fire-rate style drivers), taken from
    // the latest history row.
    const latestRow = furnace.history[furnace.history.length - 1];
    const currentState: Record<string, number> = {};
    for (const k in latestRow) {
      const v = latestRow[k];
      if (typeof v === "number") currentState[k] = v;
    }

    const result = forecastPass(furnace, 1, currentState, historyByAlias, bundle.alarm_threshold_c);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(Number.isFinite(result.skinNowC)).toBe(true);
    expect(result.forecast.length).toBe(2555);
    expect(result.forecast.every((f) => Number.isFinite(f.value))).toBe(true);
    // P10 <= P50 <= P90 at every step (band never inverted)
    expect(result.forecast.every((f) => f.p10 <= f.p50 + 1e-6 && f.p50 <= f.p90 + 1e-6)).toBe(true);
    if (result.hoursToAlarm !== null) expect(result.hoursToAlarm).toBeGreaterThan(0);
  });
});
