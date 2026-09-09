import {
  calculate,
  seedEquipment,
  type EquipmentData,
  type Metric,
  type Reading,
} from "../engineering/catalog";
export function demoBlower(
  kind: "current" | "baseline" | "stale" | "missing" = "current",
): EquipmentData {
  const seed = seedEquipment("air-blower");
  const baseline = kind === "baseline",
    start = Date.parse(
      baseline ? "2025-11-01T14:00:00Z" : "2026-01-01T14:00:00Z",
    );
  const rows = Array.from({ length: 721 }, (_, i) => {
    const day = i / 24,
      late = Math.max(0, (day - 18) / 12),
      eta = baseline ? 80.2 : 80.2 - 1.4 * late,
      flow = (baseline ? 21100 : 21050) + 45 * Math.sin(i / 19),
      t1 = 4;
    const bearing = baseline
      ? 64.5 + 0.25 * Math.sin(i / 18)
      : 65.8 + 6 * late + 0.25 * Math.sin(i / 18) * (1 - late);
    const timestamp = new Date(start + i * 3600000).toISOString();
    const row = {
      ...seed.rows[0],
      timestamp,
      motorCurrentA: 685000 / (Math.sqrt(3) * 4000 * 0.85),
      motorCurrentB: 0,
      suctionPressureA: 93,
      dischargePressureA: 95,
      suctionPressureB: 93,
      dischargePressureB: 0,
      totalFlowNm3hr: flow,
      controllerSpA: 95,
      bypassOpA: 4,
      filterDpA: baseline ? 0.035 : 0.035 + 0.045 * late,
      suctionTempC:
        !baseline && ((i >= 710 && i <= 712) || i === 720) ? null : t1,
      dischargeTempA:
        (t1 + 273.15) * Math.pow(1.88 / 0.93, (1.4 - 1) / (1.4 * (eta / 100))) -
        273.15,
      dischargeTempB: null,
      vibrationA: [0.7 + 0.07 * Math.sin(i / 12), 0.65, 0.72, 0.61],
      vibrationB: [0, 0, 0, 0],
      bearingTempA: [bearing, bearing - 1.5],
      bearingTempB: [25, 25],
    } as Record<string, unknown>;
    if (kind === "stale" && i >= 718) {
      row.bearingTempA = [71.8, 70.3];
      row._quality = {
        maxBearingTempC: {
          state: "Stale",
          lastFresh: new Date(start + 717 * 3600000).toISOString(),
          reason:
            "POC held bearing tag; last fresh sample precedes the observation cutoff.",
        },
      };
    }
    if (kind === "missing" && i >= 708) {
      row.bearingTempA = [null, null];
      row._quality = {
        maxBearingTempC: {
          state: "Missing",
          reason: "POC missing bearing tags.",
        },
      };
    }
    return row;
  });
  return {
    ...seed,
    rows,
    source: `POC simulated ${kind} dataset; hourly samples, not plant observations`,
  };
}
export function cleanBaseline(config?: EquipmentData["config"]) {
  const data = demoBlower("baseline");
  if (config) data.config = config;
  return calculate("air-blower", data);
}
export function family(key: string) {
  return /Vibration|Bearing/.test(key)
    ? "Mechanical"
    : /power|flow|bypass/i.test(key)
      ? "Load"
      : "Aerodynamic";
}
export function metricFacts(metric: Metric, reading: Reading) {
  const raw = reading.values[metric.key];
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  const quality =
    reading.qualityByMetric?.[metric.key] ??
    (value === null
      ? { state: "Missing" as const, reason: "No valid result." }
      : undefined);
  const reliable =
    value !== null &&
    quality?.state !== "Stale" &&
    quality?.state !== "Missing";
  const crossed = reliable
    ? (metric.limits ?? [])
        .filter((l) =>
          /maximum/i.test(l.name) ? value > l.value : value >= l.value,
        )
        .at(-1)
    : undefined;
  const state = !reliable
    ? "Unreliable"
    : (crossed?.name ??
      (metric.limits?.length || metric.reference !== undefined
        ? "Within reference"
        : "No limit configured"));
  return {
    value,
    quality,
    reliable,
    state,
    severity: !crossed
      ? "ok"
      : /Trip/i.test(crossed.name)
        ? "trip"
        : /Alarm/i.test(crossed.name)
          ? "alarm"
          : "advisory",
    flagged: !reliable || !!crossed || !!quality,
  };
}
export function windowAverage(metric: Metric, rows: Reading[]) {
  const values = rows
    .map((r) => metricFacts(metric, r))
    .filter((v) => v.reliable)
    .map((v) => v.value!);
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
export function healthScore(metrics: Metric[], rows: Reading[]) {
  const keys = [
    "maxVibrationMms",
    "maxBearingTempC",
    "dpBar",
    "filterDpBar",
    "bypassOpPct",
  ];
  const last = rows.at(-1);
  if (!last)
    return {
      score: null,
      formula: "No observations",
      deductions: [] as { metric: string; points: number }[],
    };
  const relevant = metrics.filter((m) => keys.includes(m.key));
  if (relevant.some((m) => !metricFacts(m, last).reliable))
    return {
      score: null,
      formula: "Score unavailable: a scored input is missing or stale.",
      deductions: [],
    };
  const deductions = relevant.flatMap((m) => {
    const severity = metricFacts(m, last).severity;
    const points =
      severity === "trip"
        ? 45
        : severity === "alarm"
          ? 28
          : severity === "advisory"
            ? 14
            : 0;
    return points ? [{ metric: m.label, points }] : [];
  });
  const bearing = metrics.find((m) => m.key === "maxBearingTempC");
  if (bearing && rows.length > 1) {
    const first = metricFacts(bearing, rows[0]),
      end = metricFacts(bearing, last);
    if (first.reliable && end.reliable && end.value! - first.value! > 2)
      deductions.push({
        metric: "Bearing temperature rise >2 °C in selected window",
        points: 4,
      });
  }
  const score = Math.max(0, 100 - deductions.reduce((a, d) => a + d.points, 0));
  return {
    score,
    formula:
      "100" +
      deductions.map((d) => ` - ${d.points} ${d.metric}`).join("") +
      ` = ${score}`,
    deductions,
  };
}
/** Align by elapsed time since each selected interval's first sample. No interpolation or nearest-neighbour substitution. */
export function alignComparison(
  current: Reading[],
  baseline: Reading[],
  metric: Metric,
) {
  const a0 = current[0]?.epoch ?? 0,
    b0 = baseline[0]?.epoch ?? 0;
  const a = new Map(current.map((r) => [r.epoch - a0, r])),
    b = new Map(baseline.map((r) => [r.epoch - b0, r]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort((x, y) => x - y)
    .map((elapsed) => {
      const ar = a.get(elapsed),
        br = b.get(elapsed),
        av = ar ? metricFacts(metric, ar) : null,
        bv = br ? metricFacts(metric, br) : null;
      return {
        elapsed,
        aTime: ar?.epoch ?? null,
        bTime: br?.epoch ?? null,
        a: av?.reliable ? av.value : null,
        b: bv?.reliable ? bv.value : null,
        delta: av?.reliable && bv?.reliable ? av.value! - bv.value! : null,
      };
    });
}
