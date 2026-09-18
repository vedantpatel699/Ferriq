import { DateTime } from "luxon";
// Furnace Skin TI Predictor engineering module — ported verbatim from the
// live predictors/furnace-skin-temp.html engine. This is a genuinely
// different system from backend-furnace-skin-temp.md's simple
// Dittus-Boelter K-baseline correlation: the live app walks trained
// XGBoost quantile-regression trees (P10/P50/P90, one triplet per
// thermocouple) bundled in model.json, and extrapolates long-horizon
// forecasts via a hybrid linear-trend + data-driven-quantile-spread
// approach (tree models cannot extrapolate beyond their training range).

import type { RawSeverity } from "../types";

export interface TreeNode {
  v?: number; // leaf value
  f?: number | string; // bundled models use numeric feature positions
  t?: number; // split threshold
  m?: number; // missing-value direction (1 = go left)
  l?: TreeNode;
  r?: TreeNode;
}

export interface TreeModel {
  trees: TreeNode[];
  base_score?: number;
  feature_names: string[];
}

export interface ThermocoupleModel {
  metrics?: Record<string, number>;
  holdout?: {
    timestamps: string[];
    actual: number[];
    p10: number[];
    p50: number[];
    p90: number[];
  };
  pass: number;
  p10: TreeModel;
  p50: TreeModel;
  p90: TreeModel;
  feature_names: string[];
}

export interface FurnaceEntry {
  key: string;
  label: string;
  passes: number;
  cadence_hours: number;
  tc_models: Record<string, ThermocoupleModel>;
  history: Record<string, number | string | null>[];
  reference_history?: Record<string, number | string | null>[];
}

export interface FurnaceModelBundle {
  demo_source?: string;
  demo_as_of?: string;
  version: string;
  trained_at: string;
  horizon_hours: number;
  alarm_threshold_c: number;
  advisory_threshold_c: number;
  furnaces: Record<string, FurnaceEntry>;
}

/** Walk one XGBoost regression tree. `m===1` means "route missing values
 *  left"; matches the live engine's evalNode exactly, including its
 *  missing-value handling (a feature absent from the current state routes
 *  by the tree's own missing-direction flag, not by treating it as 0). */
export function evalTreeNode(
  node: TreeNode,
  x: Record<string, number> | number[],
): number {
  if (node.v !== undefined) return node.v;
  const v = (x as Record<string | number, number>)[node.f!];
  if (v === undefined || v === null || Number.isNaN(v)) {
    return node.m === 1 ? evalTreeNode(node.l!, x) : evalTreeNode(node.r!, x);
  }
  return v < node.t! ? evalTreeNode(node.l!, x) : evalTreeNode(node.r!, x);
}

export function predictTreeModel(
  model: TreeModel,
  featureValues: Record<string, number> | number[],
): number {
  const trees = model.trees || [];
  const base = model.base_score || 0;
  let sum = base;
  for (const t of trees) sum += evalTreeNode(t, featureValues);
  return sum;
}

export function buildFeatureVector(
  featureNames: string[],
  currentState: Record<string, number>,
  skinNow: number,
  skin7dMean: number,
  skinVelocity: number,
): number[] {
  const vec: number[] = [];
  for (const name of featureNames) {
    if (name === "skin_max_now" || name === "tc_now") vec.push(skinNow);
    else if (name === "skin_max_7d_mean" || name === "tc_7d_mean")
      vec.push(skin7dMean);
    else if (
      name === "skin_max_velocity_c_per_d" ||
      name === "tc_velocity_c_per_d"
    )
      vec.push(skinVelocity);
    else if (name in currentState) vec.push(currentState[name]);
    else vec.push(NaN);
  }
  return vec;
}

/** Always run 7 years forward so forecast-tile values (hours-to-alarm,
 *  final projection) are independent of the user's chosen display window
 *  — the chart slices this internal horizon down to what's shown. */
export const INTERNAL_HORIZON_DAYS = 2555;

export interface ForecastStep {
  day: number;
  value: number;
  p10: number;
  p50: number;
  p90: number;
  drivenBy?: string;
}

export interface TcForecastResult {
  tcAlias: string;
  tcNow: number;
  tcVelocityCPerDay: number;
  slopePerDay: number;
  forecast: ForecastStep[];
  modelPrediction: { hours: number; p10: number; p50: number; p90: number };
  mean7d: number;
  missingModelInputs: string[];
}

/** Linear trend projection and a separate, single trained-horizon prediction.
 * Missing observations retain their timestamps; tree quantiles are never
 * recentered on the trend or recursively extended beyond their trained horizon. */
export function forecastThermocouple(
  model: ThermocoupleModel,
  currentState: Record<string, number>,
  history: number[],
  cadenceHours: number,
  tcAlias: string,
  epochs?: number[],
  modelHorizonHours = 24,
): TcForecastResult | null {
  if (
    !model?.p50 ||
    !Number.isFinite(cadenceHours) ||
    cadenceHours <= 0 ||
    !Number.isFinite(modelHorizonHours) ||
    modelHorizonHours <= 0
  )
    return null;
  const all = history.map((value, i) => ({
    value,
    time: epochs?.[i] ?? i * cadenceHours * 3600000,
  }));
  const last = all.at(-1);
  if (
    !last ||
    !Number.isFinite(last.time) ||
    !Number.isFinite(last.value) ||
    last.value == null
  )
    return null;
  const points = all.filter(
    (p) =>
      typeof p.value === "number" &&
      Number.isFinite(p.value) &&
      Number.isFinite(p.time) &&
      p.time <= last.time &&
      p.time >= last.time - 30 * 86400000,
  );
  if (points.length < 2) return null;
  const slope = (ps: typeof points) => {
    const xs = ps.map((p) => (p.time - last.time) / 86400000);
    const mx = xs.reduce((a, b) => a + b, 0) / ps.length;
    const my = ps.reduce((a, p) => a + p.value, 0) / ps.length;
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    return den > 0
      ? xs.reduce((a, x, i) => a + (x - mx) * (ps[i].value - my), 0) / den
      : null;
  };
  const slopePerDay = slope(points);
  if (slopePerDay === null) return null;
  const weekStart = last.time - 7 * 86400000;
  const week = points.filter((p) => p.time > weekStart);
  const mean7d = week.reduce((a, p) => a + p.value, 0) / week.length;
  const velocity = slope(week) ?? slopePerDay;
  // Training uses a seven-day lag difference, not the trend regression slope.
  const lag = all.find((p) => p.time === weekStart && Number.isFinite(p.value));
  const trainedVelocity = lag ? (last.value - lag.value) / 7 : NaN;
  const x = buildFeatureVector(
    model.feature_names,
    currentState,
    last.value,
    mean7d,
    trainedVelocity,
  );
  const median = predictTreeModel(model.p50, x);
  const low = predictTreeModel(model.p10, x),
    high = predictTreeModel(model.p90, x);
  if (![median, low, high].every(Number.isFinite)) return null;
  const forecast = Array.from({ length: INTERNAL_HORIZON_DAYS }, (_, i) => {
    const day = i + 1,
      value = last.value + slopePerDay * day;
    // Coincident endpoints are placeholders for legacy scenario consumers, not a confidence band.
    return { day, value, p10: value, p50: value, p90: value };
  });
  return {
    tcAlias,
    tcNow: last.value,
    tcVelocityCPerDay: velocity,
    slopePerDay,
    forecast,
    mean7d,
    missingModelInputs: model.feature_names.filter(
      (_, i) => !Number.isFinite(x[i]),
    ),
    modelPrediction: {
      hours: modelHorizonHours,
      p10: Math.min(low, median, high),
      p50: median,
      p90: Math.max(low, median, high),
    },
  };
}

export interface PassForecastResult {
  observationEpoch: number;
  dataAgeHours: number;
  missingThermocouples: string[];
  skinNowC: number;
  skin7dMeanC: number;
  skinVelocityCPerDay: number;
  forecast: ForecastStep[];
  hoursToAlarm: number | null;
  hoursToAlarmUpperBand: number | null;
  extrapolatedDays: number | null;
  horizonDays: number;
  finalProjection: ForecastStep;
  tcResults: TcForecastResult[];
}

/** Aggregate per-thermocouple forecasts into a per-pass result: at every
 *  step, the pass-level value is driven by whichever thermocouple has the
 *  highest P50 at that step (matches the live engine's max-across-TC
 *  rule, including carrying that TC's full quantile triplet). */
export function forecastPass(
  furnace: FurnaceEntry,
  passNum: number,
  currentState: Record<string, number>,
  historyByAlias: Record<string, number[]>,
  alarmThresholdC: number,
  modelHorizonHours = 24,
): PassForecastResult | null {
  const tcAliases = Object.keys(furnace.tc_models || {}).filter(
    (a) => furnace.tc_models[a].pass === passNum,
  );
  if (tcAliases.length === 0) return null;

  const observationIndex = furnace.history.findLastIndex((row) =>
    tcAliases.some(
      (a) => typeof row[a] === "number" && Number.isFinite(row[a]),
    ),
  );
  const alignedHistory = furnace.history.slice(0, observationIndex + 1);
  const epoch = (t: unknown) =>
    DateTime.fromISO(String(t).replace(" ", "T"), {
      zone: "America/Edmonton",
    }).toMillis();
  const observationEpoch = alignedHistory.length
    ? epoch(alignedHistory.at(-1)!.t)
    : 0;
  if (furnace.history.length && !alignedHistory.length) return null;
  const state = alignedHistory.length
    ? (Object.fromEntries(
        Object.entries(alignedHistory.at(-1)!).filter(
          ([, v]) => typeof v === "number" && Number.isFinite(v),
        ),
      ) as Record<string, number>)
    : currentState;
  const tcResults = tcAliases
    .map((a) =>
      forecastThermocouple(
        furnace.tc_models[a],
        state,
        alignedHistory.length
          ? alignedHistory.map((r) => r[a] as number)
          : historyByAlias[a] || [],
        furnace.cadence_hours,
        a,
        alignedHistory.length
          ? alignedHistory.map((r) => epoch(r.t))
          : undefined,
        modelHorizonHours,
      ),
    )
    .filter((r): r is TcForecastResult => r !== null);
  if (tcResults.length === 0) return null;

  const horizon = INTERNAL_HORIZON_DAYS;
  const skinNow = Math.max(...tcResults.map((r) => r.tcNow));

  const forecast: ForecastStep[] = [];
  for (let d = 1; d <= horizon; d++) {
    let maxVal = -Infinity,
      maxP10 = 0,
      maxP90 = 0,
      drivenBy = "";
    for (const r of tcResults) {
      const f = r.forecast[d - 1];
      if (!f) continue;
      if (f.value > maxVal) {
        maxVal = f.value;
        maxP10 = f.p10;
        maxP90 = f.p90;
        drivenBy = r.tcAlias;
      }
    }
    forecast.push({
      day: d,
      value: maxVal,
      p10: maxP10,
      p50: maxVal,
      p90: maxP90,
      drivenBy,
    });
  }

  const skinVelocity =
    tcResults.reduce((a, r) => a + r.tcVelocityCPerDay, 0) / tcResults.length;
  const skin7dMean =
    tcResults.reduce((sum, r) => sum + r.mean7d, 0) / tcResults.length;

  const crossings = tcResults
    .map((r) =>
      r.tcNow >= alarmThresholdC
        ? 0
        : r.slopePerDay > 0
          ? (24 * (alarmThresholdC - r.tcNow)) / r.slopePerDay
          : Infinity,
    )
    .filter((h) => Number.isFinite(h) && h <= horizon * 24);
  const hoursToAlarm = crossings.length ? Math.min(...crossings) : null;

  // No pass-level calibrated interval is available for the long-range trend.
  const hoursToAlarmUpperBand = null;
  const extrapolatedDays = null;

  return {
    observationEpoch,
    dataAgeHours: furnace.history.length
      ? (epoch(furnace.history.at(-1)!.t) - observationEpoch) / 3600000
      : 0,
    missingThermocouples: tcAliases.filter(
      (a) => !tcResults.some((r) => r.tcAlias === a),
    ),
    skinNowC: skinNow,
    skin7dMeanC: skin7dMean,
    skinVelocityCPerDay: skinVelocity,
    forecast,
    hoursToAlarm: skinNow >= alarmThresholdC ? 0 : hoursToAlarm,
    hoursToAlarmUpperBand:
      skinNow >= alarmThresholdC ? 0 : hoursToAlarmUpperBand,
    extrapolatedDays,
    horizonDays: horizon,
    finalProjection: forecast[forecast.length - 1],
    tcResults,
  };
}

/** Ported from the live engine's statusFor: measured-value classification
 *  combined with imminence (hours to the alarm threshold). */
export function statusForSkin(
  skinC: number,
  hoursToAlarm: number | null,
): RawSeverity {
  if (skinC >= 470 || (hoursToAlarm !== null && hoursToAlarm < 24))
    return "alarm";
  if (skinC >= 460 || (hoursToAlarm !== null && hoursToAlarm < 72))
    return "advisory";
  return "ok";
}
