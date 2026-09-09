import type {
  FurnaceEntry,
  PassForecastResult,
  ForecastStep,
} from "../engineering/furnace/calculations";
export function flowSplitDomain(furnace: FurnaceEntry, pass = 3) {
  const values = furnace.history.flatMap((row) => {
    const flows = Array.from(
      { length: furnace.passes },
      (_, i) => row["flow_p" + (i + 1)],
    );
    if (
      flows.some((v) => typeof v !== "number" || !Number.isFinite(v) || v <= 0)
    )
      return [];
    const total = (flows as number[]).reduce((a, b) => a + b, 0);
    return [(Number(flows[pass - 1]) / total) * 100];
  });
  if (!values.length) return null;
  return {
    baseline: values.at(-1)!,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
export function crossingHours(
  forecast: ForecastStep[],
  initial: number,
  limit: number,
) {
  if (initial >= limit) return 0;
  let previous = initial,
    hours = 0;
  for (const f of forecast) {
    const next = f.day * 24;
    if (previous < limit && f.value >= limit)
      return (
        hours + ((limit - previous) / (f.value - previous)) * (next - hours)
      );
    previous = f.value;
    hours = next;
  }
  return null;
}
/** Explicit POC response, never a trained model or validated causal effect. Does not mutate baseline. */
export function simulateFlowSplit(
  baseline: PassForecastResult,
  referenceSplit: number,
  split: number,
  threshold: number,
) {
  if (!Number.isFinite(split) || split <= 0 || split >= 100)
    throw Error("Flow split must be between 0 and 100 percent.");
  const delta = split - referenceSplit;
  const effect24 = [
    Math.min(0.8 * delta, 2.8 * delta),
    Math.max(0.8 * delta, 2.8 * delta),
  ] as [number, number];
  const forecast = baseline.forecast.map((f) => {
    const effect = delta * (0.36 + 1.44 * Math.exp(-(f.day - 1) / 2));
    const addedSpread =
      Math.abs(delta) * (0.4 + Math.sqrt(Math.max(0, f.day - 1)) * 0.25);
    return {
      ...f,
      value: f.value + effect,
      p50: f.p50 + effect,
      p10: f.p10 + effect - addedSpread,
      p90: f.p90 + effect + addedSpread,
    };
  });
  return {
    split,
    delta,
    effect24,
    forecast,
    hoursToThreshold: crossingHours(forecast, baseline.skinNowC, threshold),
    mode: "POC simulation - not validated" as const,
  };
}
