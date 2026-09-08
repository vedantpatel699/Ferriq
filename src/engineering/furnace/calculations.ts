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
}

export interface FurnaceModelBundle {
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
    if (name === "skin_max_now") vec.push(skinNow);
    else if (name === "skin_max_7d_mean") vec.push(skin7dMean);
    else if (name === "skin_max_velocity_c_per_d") vec.push(skinVelocity);
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
}

/** Forecast one thermocouple with a hybrid trend + quantile-residual
 *  approach: the long-horizon central trajectory is a linear regression on
 *  the last ~30 days of history (tree models can't extrapolate beyond
 *  their training range), decorated by the XGBoost P10/P50/P90 spread
 *  (walked recursively, used only for the uncertainty band width — never
 *  fabricated). Includes the live engine's early-exit once the recursive
 *  spread converges for 14 consecutive steps. */
export function forecastThermocouple(
  model: ThermocoupleModel,
  currentState: Record<string, number>,
  history: number[],
  cadenceHours: number,
  tcAlias: string,
): TcForecastResult | null {
  if (!model?.p50) return null;
  const series = history.filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(v),
  );
  if (series.length < 2) return null;
  const tcNow = series[series.length - 1];

  const stepsN = Math.max(7, Math.round((30 * 24) / cadenceHours));
  const recent = series.slice(-stepsN);
  const nR = recent.length;
  const xs = recent.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / nR;
  const yMean = recent.reduce((a, b) => a + b, 0) / nR;
  let num = 0,
    den = 0;
  for (let i = 0; i < nR; i++) {
    num += (xs[i] - xMean) * (recent[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slopePerStep = den > 0 ? num / den : 0;
  const slopePerDay = slopePerStep * (24 / cadenceHours);
  const oneWeekAgo =
    series[
      Math.max(0, series.length - 1 - Math.round((7 * 24) / cadenceHours))
    ];
  const tcVelocity0 = (tcNow - oneWeekAgo) / 7.0;

  const tc7dMean0 = recent.reduce((a, b) => a + b, 0) / recent.length;
  let cur50 = tcNow,
    cur10 = tcNow,
    cur90 = tcNow;
  let mean50 = tc7dMean0,
    vel50 = tcVelocity0;
  let mean10 = tc7dMean0,
    vel10 = tcVelocity0;
  let mean90 = tc7dMean0,
    vel90 = tcVelocity0;
  let convergedSteps = 0,
    cvSpreadHi: number | null = null,
    cvSpreadLo: number | null = null;

  const forecast: ForecastStep[] = [];
  for (let d = 1; d <= INTERNAL_HORIZON_DAYS; d++) {
    const central = tcNow + slopePerDay * d;
    let spreadHi: number, spreadLo: number;

    if (convergedSteps >= 14 && cvSpreadHi !== null && cvSpreadLo !== null) {
      spreadHi = cvSpreadHi;
      spreadLo = cvSpreadLo;
    } else {
      const x50 = buildFeatureVector(
        model.feature_names,
        currentState,
        cur50,
        mean50,
        vel50,
      );
      const x10 = buildFeatureVector(
        model.feature_names,
        currentState,
        cur10,
        mean10,
        vel10,
      );
      const x90 = buildFeatureVector(
        model.feature_names,
        currentState,
        cur90,
        mean90,
        vel90,
      );
      const xb50 = predictTreeModel(model.p50, x50);
      const xb10 = predictTreeModel(model.p10, x10);
      const xb90 = predictTreeModel(model.p90, x90);
      const lo = Math.min(xb10, xb50);
      const hi = Math.max(xb90, xb50);
      spreadHi = Math.max(0, hi - xb50);
      spreadLo = Math.max(0, xb50 - lo);

      if (Math.abs(xb50 - cur50) < 0.05) {
        convergedSteps += 1;
        cvSpreadHi = spreadHi;
        cvSpreadLo = spreadLo;
      } else {
        convergedSteps = 0;
        cvSpreadHi = null;
        cvSpreadLo = null;
      }

      vel50 = xb50 - cur50;
      mean50 = 0.7 * mean50 + 0.3 * xb50;
      cur50 = xb50;
      vel10 = lo - cur10;
      mean10 = 0.7 * mean10 + 0.3 * lo;
      cur10 = lo;
      vel90 = hi - cur90;
      mean90 = 0.7 * mean90 + 0.3 * hi;
      cur90 = hi;
    }

    forecast.push({
      day: d,
      value: central,
      p10: central - spreadLo,
      p50: central,
      p90: central + spreadHi,
    });
  }

  return {
    tcAlias,
    tcNow,
    tcVelocityCPerDay: tcVelocity0,
    slopePerDay,
    forecast,
  };
}

export interface PassForecastResult {
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
): PassForecastResult | null {
  const tcAliases = Object.keys(furnace.tc_models || {}).filter(
    (a) => furnace.tc_models[a].pass === passNum,
  );
  if (tcAliases.length === 0) return null;

  const tcResults = tcAliases
    .map((a) =>
      forecastThermocouple(
        furnace.tc_models[a],
        currentState,
        historyByAlias[a] || [],
        furnace.cadence_hours,
        a,
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
    tcResults.reduce((a, r) => {
      const series = (historyByAlias[r.tcAlias] || []).filter(
        (v) => v !== null && v !== undefined,
      );
      const recent = series.slice(
        -Math.max(1, Math.round((7 * 24) / furnace.cadence_hours)),
      );
      return a + recent.reduce((p, q) => p + q, 0) / Math.max(1, recent.length);
    }, 0) / tcResults.length;

  let hoursToAlarm: number | null = null;
  {
    let prevVal = skinNow,
      prevH = 0;
    for (const f of forecast) {
      const h = f.day * 24;
      if (prevVal < alarmThresholdC && f.value >= alarmThresholdC) {
        const frac = (alarmThresholdC - prevVal) / (f.value - prevVal);
        hoursToAlarm = prevH + frac * (h - prevH);
        break;
      }
      prevVal = f.value;
      prevH = h;
    }
  }

  let hoursToAlarmUpperBand: number | null = null;
  {
    let prevUB = skinNow,
      prevHU = 0;
    for (const f of forecast) {
      const h = f.day * 24;
      if (prevUB < alarmThresholdC && f.p90 >= alarmThresholdC) {
        const frac = (alarmThresholdC - prevUB) / (f.p90 - prevUB);
        hoursToAlarmUpperBand = prevHU + frac * (h - prevHU);
        break;
      }
      prevUB = f.p90;
      prevHU = h;
    }
  }

  let extrapolatedDays: number | null = null;
  if (hoursToAlarm === null) {
    const last = forecast[forecast.length - 1];
    const slopePerDay = (last.value - skinNow) / horizon;
    if (slopePerDay > 0.001 && last.value < alarmThresholdC) {
      const extra = (alarmThresholdC - last.value) / slopePerDay;
      if (extra > 0 && isFinite(extra)) extrapolatedDays = horizon + extra;
    }
  }

  return {
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
