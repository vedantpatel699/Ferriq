import { DateTime } from "luxon";
import reference from "../reference/data.json";
import {
  DEFAULT_BLOWER_SETTINGS,
  DEFAULT_BLOWER_LIMITS,
  processBlowerRow,
  fitSimpleFlowModel,
  predictFlowNm3hr,
  type BlowerRowInput,
  type BlowerSettings,
  type BlowerLimits,
} from "./blower/calculations";
import {
  DEFAULT_HEATER_CONFIG,
  calcHeaterRow,
  buildHeaterAlerts,
  type HeaterConfig,
  type HeaterRowInput,
} from "./heater/calculations";
import {
  DEFAULT_EXCHANGER_CONFIG,
  calcExchangerRow,
  buildExchangerAlerts,
  type ExchangerConfig,
  type ExchangerRowInput,
} from "./exchanger/calculations";
import {
  DEFAULT_MEMBRANE_CONFIG,
  calcMembraneRow,
  synthesizeOnlineFeedH2,
  buildMembraneAlerts,
  type MembraneConfig,
  type MembraneRowInput,
} from "./membrane/calculations";
import type { EngineeringAlert, EquipmentState } from "./types";
import { reviewMessage } from "../lib/format";
import { BLOWER_DEMO_DATA } from "./blower/demoData";
export const equipmentIds = [
  "air-blower",
  "fired-heater",
  "shell-tube-exchanger",
  "membrane-analyzer",
] as const;
export type EquipmentId = (typeof equipmentIds)[number];
export type Row = Record<string, unknown>;
export interface EquipmentData {
  rows: Row[];
  config: Row;
  source: string;
  importedAt?: string;
}
export interface Metric {
  key: string;
  label: string;
  unit: string;
  digits?: number;
  reference?: number;
  referenceLabel?: string;
  limits?: { name: string; value: number }[];
}
export interface QualityMark {
  state: "Missing" | "Stale" | "Fallback";
  reason: string;
  lastFresh?: string;
}
export interface Reading {
  qualityByMetric?: Record<string, QualityMark>;
  timestamp: string;
  epoch: number;
  values: Row;
  alerts: EngineeringAlert[];
  state: EquipmentState;
  quality: string[];
}
export const identities: Record<EquipmentId, { name: string; tag: string }> = {
  "air-blower": { name: "Air Blower", tag: "C-101A/B" },
  "fired-heater": { name: "Fired Heater", tag: "H-401" },
  "shell-tube-exchanger": { name: "Shell & Tube Exchanger", tag: "E-201" },
  "membrane-analyzer": { name: "Membrane Analyzer", tag: "M-301" },
};
export function stateFromAlerts(
  alerts: EngineeringAlert[],
  unavailable = false,
): EquipmentState {
  if (alerts.some((a) => a.severity === "alarm" || a.severity === "trip"))
    return "investigate";
  if (alerts.some((a) => a.severity === "advisory")) return "watch";
  return unavailable ? "data-issue" : "normal";
}
export function timestamp(value: unknown): number {
  const text = String(value ?? "");
  const d = DateTime.fromISO(text.replace(" ", "T"), {
    zone: "America/Edmonton",
  });
  return d.isValid ? d.toMillis() : NaN;
}
const mappings: Record<string, Record<string, string>> = {
  "fired-heater": {
    timestamp: "timestamp",
    fuel_flow_kg_s: "fuelFlowKgS",
    air_temp_c: "combustionAirTempC",
    stack_temp_c: "stackTempC",
    fuel_temp_c: "fuelTempC",
    process_flow_kg_s: "processFlowKgS",
    process_inlet_c: "processInC",
    process_outlet_c: "processOutC",
    process_cp_kjkgk: "processCpKjKgK",
    stack_o2_pct: "stackO2Pct",
    bridgewall_a_c: "bridgewallAC",
    bridgewall_b_c: "bridgewallBC",
    fuel_blend: "fuelCaseOverride",
    fuel_pressure_kpa: "fuelPressureKpa",
  },
  "shell-tube-exchanger": {
    timestamp: "timestamp",
    t_hot_in_c: "hotInC",
    t_hot_out_c: "hotOutC",
    m_hot_kghr: "hotFlowKgHr",
    cp_hot: "hotCpKjKgK",
    t_cold_in_c: "coldInC",
    t_cold_out_c: "coldOutC",
    m_cold_kghr: "coldFlowKgHr",
    cp_cold: "coldCpKjKgK",
  },
  "membrane-analyzer": {
    timestamp: "timestamp",
    q_feed: "feedFlowNm3Hr",
    q_non_perm: "nonPermeateFlowNm3Hr",
    q_perm: "permeateFlowNm3Hr",
    y_perm_h2_online: "permeateH2OnlinePct",
    y_perm_h2_lab: "permeateH2LabPct",
    y_feed_h2_lab: "feedH2LabPct",
    y_feed_h2_online: "feedH2OnlinePct",
    p_feed_kpag: "feedPressureKpag",
  },
};
const blowerMap: Record<string, string> = {
  timestamp: "timestamp",
  motor_current_a: "motorCurrentA",
  motor_current_b: "motorCurrentB",
  suction_pressure_a: "suctionPressureA",
  suction_pressure_b: "suctionPressureB",
  discharge_pressure_a: "dischargePressureA",
  discharge_pressure_b: "dischargePressureB",
  controller_sp_a: "controllerSpA",
  controller_sp_b: "controllerSpB",
  bypass_op_a: "bypassOpA",
  bypass_op_b: "bypassOpB",
  filter_dp_a: "filterDpA",
  filter_dp_b: "filterDpB",
  total_flow: "totalFlowNm3hr",
  suction_temp: "suctionTempC",
  discharge_temp_a: "dischargeTempA",
  discharge_temp_b: "dischargeTempB",
};
export function normalizeRows(id: EquipmentId, raw: Row[]): Row[] {
  const aliases = reference[id].aliases as Record<string, string[]>;
  const map = id === "air-blower" ? blowerMap : mappings[id];
  return raw
    .map((r, i) => {
      const out: Row = {};
      for (const [canonical, target] of Object.entries(map)) {
        const keys = [
          target,
          canonical,
          ...(aliases[canonical] ?? []),
          ...(canonical === "timestamp" ? ["ts"] : []),
        ];
        const key = keys.find((k) => r[k] !== undefined);
        const v = key === undefined ? null : r[key];
        if (target === "timestamp") {
          if (!Number.isFinite(timestamp(v)))
            throw new Error(
              `Row ${i + 1}: invalid timestamp. Use ISO date/time in the site timezone or with an offset.`,
            );
          out[target] = String(v);
        } else if (target === "fuelCaseOverride") out[target] = v || undefined;
        else {
          const n = v === null || v === "" ? null : Number(v);
          if (n !== null && !Number.isFinite(n))
            throw new Error(
              `Row ${i + 1}: ${target} must be numeric or blank.`,
            );
          out[target] = n;
        }
      }
      if (id === "air-blower")
        for (const train of ["A", "B"])
          for (const [prefix, count] of [
            ["vibration", 4],
            ["bearing_temp", 2],
          ] as const) {
            const target =
              (prefix === "vibration" ? "vibration" : "bearingTemp") + train;
            out[target] = Array.isArray(r[target])
              ? r[target]
              : typeof r[target] === "string" &&
                  String(r[target]).trim().startsWith("[")
                ? JSON.parse(String(r[target]))
                : Array.from({ length: count }, (_, j) => {
                    const canon = `${prefix}_${train.toLowerCase()}_${j + 1}`;
                    const k = [canon, ...(aliases[canon] ?? [])].find(
                      (k) => r[k] !== undefined,
                    );
                    const v = k ? r[k] : null;
                    return v === null || v === "" ? null : Number(v);
                  });
          }
      if (id === "shell-tube-exchanger") {
        for (const key of ["shellDpBar", "tubeDpBar"]) {
          const v = r[key];
          out[key] =
            v === null || v === undefined || v === "" ? null : Number(v);
          if (out[key] !== null && !Number.isFinite(out[key]))
            throw Error(key + " must be numeric or blank.");
        }
      }
      if (id === "air-blower")
        for (const key of [
          "vibrationA",
          "vibrationB",
          "bearingTempA",
          "bearingTempB",
        ]) {
          const values = out[key];
          if (
            !Array.isArray(values) ||
            values.length !== (key.startsWith("vibration") ? 4 : 2) ||
            values.some(
              (v) =>
                v !== null && (typeof v !== "number" || !Number.isFinite(v)),
            )
          )
            throw Error(
              key +
                " needs the expected number of numeric or null probe values.",
            );
        }
      if (
        r._quality !== undefined &&
        r._quality !== null &&
        r._quality !== ""
      ) {
        const marks =
          typeof r._quality === "string" ? JSON.parse(r._quality) : r._quality;
        if (!marks || typeof marks !== "object" || Array.isArray(marks))
          throw Error("Invalid per-metric quality metadata.");
        for (const [k, v] of Object.entries(marks)) {
          const q = v as QualityMark;
          if (
            !q ||
            !["Missing", "Stale", "Fallback"].includes(q.state) ||
            typeof q.reason !== "string" ||
            q.reason.length > 500 ||
            k.length > 100
          )
            throw Error("Invalid quality marker.");
          if (
            q.state === "Stale" &&
            (!Number.isFinite(timestamp(q.lastFresh)) ||
              timestamp(q.lastFresh) > timestamp(out.timestamp))
          )
            throw Error(
              "Stale quality needs a valid last-fresh timestamp no later than the observation.",
            );
        }
        out._quality = marks;
      }
      return out;
    })
    .sort((a, b) => timestamp(a.timestamp) - timestamp(b.timestamp));
}
export function seedEquipment(id: EquipmentId): EquipmentData {
  let rows: Row[];
  if (id === "shell-tube-exchanger")
    rows = reference[id].rows.map((r) =>
      Object.fromEntries(
        [
          "timestamp",
          "hotInC",
          "hotOutC",
          "hotFlowKgHr",
          "hotCpKjKgK",
          "coldInC",
          "coldOutC",
          "coldFlowKgHr",
          "coldCpKjKgK",
        ].map((k, i) => [k, r[i]]),
      ),
    );
  else if (id === "membrane-analyzer")
    rows = reference[id].rows.map((r) => ({
      ...Object.fromEntries(
        [
          "timestamp",
          "feedFlowNm3Hr",
          "nonPermeateFlowNm3Hr",
          "permeateFlowNm3Hr",
          "permeateH2OnlinePct",
          "permeateH2LabPct",
          "feedH2LabPct",
          "feedPressureKpag",
        ].map((k, i) => [k, r[i]]),
      ),
      feedH2OnlinePct: null,
    }));
  else if (id === "air-blower")
    rows = BLOWER_DEMO_DATA as unknown as Row[];
  else rows = reference[id].rows as unknown as Row[];
  const config =
    id === "air-blower"
      ? { settings: DEFAULT_BLOWER_SETTINGS, limits: DEFAULT_BLOWER_LIMITS }
      : id === "fired-heater"
        ? DEFAULT_HEATER_CONFIG
        : id === "shell-tube-exchanger"
          ? DEFAULT_EXCHANGER_CONFIG
          : DEFAULT_MEMBRANE_CONFIG;
  return {
    rows: normalizeRows(id, rows),
    config: structuredClone(config) as unknown as Row,
    source:
      id === "air-blower"
        ? "Reference historian dataset (not live)"
        : "Bundled reference dataset (not live)",
  };
}
export function calculate(id: EquipmentId, data: EquipmentData): Reading[] {
  const rows = data.rows;
  let lastT1: number | null = null,
    lastT1At = 0;
  const synth =
    id === "membrane-analyzer" &&
    !rows.some(
      (r) => r.feedH2OnlinePct !== null && r.feedH2OnlinePct !== undefined,
    )
      ? synthesizeOnlineFeedH2(rows.map((r) => r.feedH2LabPct as number | null))
      : null;
  const calculated = rows.map((raw, i) => {
    const epoch = timestamp(raw.timestamp);
    let values: Row = { ...raw },
      alerts: EngineeringAlert[] = [];
    const quality: string[] = [];
    if (id === "air-blower") {
      const cfg = data.config as unknown as {
        settings: BlowerSettings;
        limits: BlowerLimits;
      };
      const row = { ...raw } as unknown as BlowerRowInput;
      for (const key of [
        "vibrationA",
        "vibrationB",
        "bearingTempA",
        "bearingTempB",
      ] as const)
        (row[key] as number[]) = row[key].map((v) => (v === null ? NaN : v));
      for (const key of [
        "motorCurrentA",
        "motorCurrentB",
        "suctionPressureA",
        "suctionPressureB",
        "dischargePressureA",
        "dischargePressureB",
        "totalFlowNm3hr",
      ] as const)
        if (row[key] === null) row[key] = NaN;
      const ff =
        lastT1 !== null &&
        (epoch - lastT1At) / 3600000 <= cfg.settings.suctionTempFfMaxHours
          ? lastT1
          : null;
      const result = processBlowerRow(row, cfg.settings, cfg.limits, ff);
      if (result.drop) {
        quality.push(result.reason);
        values = { ...values, efficiencyHeadlinePct: null };
      } else {
        values = { ...values, ...result };
        alerts = result.alerts;
        if (result.t1Source === "measured" && result.t1CUsed !== null) {
          lastT1 = result.t1CUsed;
          lastT1At = epoch;
        }
        if (result.efficiencyMethodUsed.includes("fallback"))
          quality.push(
            "Thermodynamic efficiency is unavailable because a required temperature is missing; the headline is the fluid-power performance indicator.",
          );
        if (result.t1Source === "forward-filled")
          quality.push(
            `Suction temperature forward-filled within the configured ${cfg.settings.suctionTempFfMaxHours} h window.`,
          );
        if (result.t1Source === "unavailable")
          quality.push(
            "Suction temperature is not present in the client source data; no fixed temperature is substituted into thermodynamic efficiency.",
          );
      }
    } else if (id === "fired-heater") {
      const cfg = data.config as unknown as HeaterConfig,
        result = calcHeaterRow(raw as unknown as HeaterRowInput, cfg);
      values = { ...values, ...result };
      alerts = buildHeaterAlerts(result, cfg);
      if (result.closurePct !== null && result.closurePct > 3)
        quality.push(
          `Heat-balance/process closure discrepancy ${result.closurePct.toFixed(1)}%. Review input units and energy boundary before interpreting efficiency.`,
        );
    } else if (id === "shell-tube-exchanger") {
      const cfg = data.config as unknown as ExchangerConfig,
        result = calcExchangerRow(raw as unknown as ExchangerRowInput, cfg);
      values = { ...values, ...result };
      alerts = buildExchangerAlerts(result, cfg);
      if (result.crossover)
        quality.push(
          "Temperature crossover or invalid correction factor: U and fouling cannot be interpreted.",
        );
      if (
        result.imbalancePct !== null &&
        result.imbalancePct > cfg.imbalanceAdvisoryPct
      )
        quality.push(
          `Energy imbalance ${result.imbalancePct.toFixed(1)}% exceeds ${cfg.imbalanceAdvisoryPct}%. Review measurements before a cleaning decision.`,
        );
    } else {
      const cfg = data.config as unknown as MembraneConfig,
        r = {
          ...raw,
          feedH2OnlinePct: synth ? synth[i] : raw.feedH2OnlinePct,
        } as unknown as MembraneRowInput,
        result = calcMembraneRow(r);
      values = { ...values, ...result };
      alerts = buildMembraneAlerts(result, cfg);
      if (synth)
        quality.push(
          "Recovery uses a synthetic feed-H₂ signal interpolated from periodic lab samples; it is not a continuous feed measurement.",
        );
    }
    const primary = {
      "air-blower": "efficiencyHeadlinePct",
      "fired-heater": "etaHeatBalancePct",
      "shell-tube-exchanger": "rfE4",
      "membrane-analyzer": "recoveryOnlinePct",
    }[id];
    const finite =
      typeof values[primary] === "number" && Number.isFinite(values[primary]);
    if (!finite)
      quality.push(
        "Primary result is unavailable; review missing or invalid inputs.",
      );
    const qualityByMetric: Record<string, QualityMark> = {
      ...((raw._quality as Record<string, QualityMark>) ?? {}),
    };
    if (id === "air-blower") {
      for (const key of [
        "efficiencyHeadlinePct",
        "efficiencyPolytropicPct",
        "efficiencyIsentropicPct",
        "maxBearingTempC",
        "maxVibrationMms",
      ])
        if (typeof values[key] !== "number" || !Number.isFinite(values[key]))
          qualityByMetric[key] = {
            state: "Missing",
            reason: "Required measurements are unavailable.",
          };
      if (String(values.efficiencyMethodUsed).includes("fallback"))
        qualityByMetric.efficiencyHeadlinePct = {
          state: "Fallback",
          reason:
            "Fluid-power indicator replaces unavailable thermodynamic efficiency.",
        };
      if (values.t1Source === "forward-filled")
        for (const key of [
          "t1CUsed",
          "efficiencyPolytropicPct",
          "efficiencyIsentropicPct",
        ])
          if (!qualityByMetric[key])
            qualityByMetric[key] = {
              state: "Fallback",
              reason: "Suction temperature uses a bounded forward-fill.",
            };
      if (values.t1Source === "unavailable")
        for (const key of [
          "t1CUsed",
          "efficiencyPolytropicPct",
          "efficiencyIsentropicPct",
        ])
          qualityByMetric[key] = {
            state: "Missing",
            reason: "No measured suction-temperature tag is present.",
          };
      for (const [key, pattern] of [
        ["maxBearingTempC", /^Bearing T/i],
        ["maxVibrationMms", /^Vibration/i],
      ] as const) {
        const q = qualityByMetric[key];
        if (q && (q.state === "Stale" || q.state === "Missing")) {
          alerts = alerts.filter((a) => !pattern.test(a.message));
          quality.push(
            `${q.state}: ${key === "maxBearingTempC" ? "Bearing temperature" : "Vibration"} state not reliable. ${q.lastFresh ? `Last fresh ${q.lastFresh}; age ${((epoch - timestamp(q.lastFresh)) / 3600000).toFixed(1)} h. ` : ""}${q.reason}`,
          );
        }
      }
    }
    const unreliable = Object.values(qualityByMetric).some(
      (q) => q.state === "Stale" || q.state === "Missing",
    );
    const rank = { trip: 3, alarm: 3, advisory: 2, ok: 0 };
    alerts.sort((a, b) => rank[b.severity] - rank[a.severity]);
    return {
      timestamp: String(raw.timestamp),
      epoch,
      values,
      alerts: alerts.map((a) => ({ ...a, message: reviewMessage(a.message) })),
      quality,
      qualityByMetric,
      state: stateFromAlerts(
        alerts,
        !finite || Boolean(values.drop) || unreliable,
      ),
    };
  });

  if (id !== "air-blower") return calculated;

  const cfg = data.config as unknown as {
    settings: BlowerSettings;
    limits: BlowerLimits;
  };
  for (const train of ["A", "B"] as const) {
    const training = calculated
      .filter(
        (r) =>
          r.values.activeBlower === train &&
          typeof r.values.totalFlowNm3hr === "number" &&
          Number.isFinite(r.values.totalFlowNm3hr) &&
          typeof r.values[train === "A" ? "motorCurrentA" : "motorCurrentB"] ===
            "number" &&
          Number.isFinite(
            r.values[train === "A" ? "motorCurrentA" : "motorCurrentB"],
          ) &&
          Number(r.values.bypassOpPct ?? 0) < 5 &&
          Number(r.values.filterDpBar ?? 0) <= cfg.limits.filterDpMaxBar,
      )
      .slice(0, 14)
      .map((r) => ({
        currentA: Number(
          r.values[train === "A" ? "motorCurrentA" : "motorCurrentB"],
        ),
        flowNm3hr: Number(r.values.totalFlowNm3hr),
      }));
    const model = fitSimpleFlowModel(training);
    for (const r of calculated.filter((x) => x.values.activeBlower === train)) {
      const current = Number(
        r.values[train === "A" ? "motorCurrentA" : "motorCurrentB"],
      );
      const expected = predictFlowNm3hr(model, current);
      const withinBaselineEnvelope =
        Number(r.values.bypassOpPct ?? 0) < 5 &&
        Number(r.values.filterDpBar ?? 0) <= cfg.limits.filterDpMaxBar;
      const residual =
        withinBaselineEnvelope && expected !== null && expected > 0
          ? ((Number(r.values.totalFlowNm3hr) - expected) / expected) * 100
          : null;
      r.values.expectedFlowNm3hr = expected;
      r.values.flowResidualPct = residual;
      r.values.performanceDegradationPct =
        residual === null ? null : Math.max(0, -residual);
      r.values.performanceModelTrainingRows = model?.trainingRows ?? 0;
      r.values.performanceModelApplicable = withinBaselineEnvelope && model !== null;
      if (!withinBaselineEnvelope) {
        r.qualityByMetric = {
          ...(r.qualityByMetric ?? {}),
          performanceDegradationPct: {
            state: "Missing",
            reason:
              "Baseline comparison is not applied while bypass is 5% or greater or filter differential pressure exceeds its limit.",
          },
        };
      }
      if (residual !== null && residual <= -cfg.limits.performanceAlarmPct) {
        r.alerts.push({
          severity: "alarm",
          message: `Measured flow is ${Math.abs(residual).toFixed(1)}% below the baseline regression expectation.`,
          source: "healthy-baseline linear regression",
        });
      } else if (
        residual !== null &&
        residual <= -cfg.limits.performanceWatchPct
      ) {
        r.alerts.push({
          severity: "advisory",
          message: `Measured flow is ${Math.abs(residual).toFixed(1)}% below the baseline regression expectation.`,
          source: "healthy-baseline linear regression",
        });
      }
      r.state = stateFromAlerts(r.alerts, r.state === "data-issue");
    }
  }

  const slopePerDay = (
    history: { epoch: number; value: number }[],
  ): number | null => {
    if (history.length < 3) return null;
    const t0 = history[0].epoch;
    const xs = history.map((p) => (p.epoch - t0) / 86400000);
    const ys = history.map((p) => p.value);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const denom = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (denom <= 0) return null;
    return (
      xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / denom
    );
  };

  calculated.forEach((r, i) => {
    for (const [metric, output] of [
      ["maxBearingTempC", "bearingTrendCPerDay"],
      ["maxVibrationMms", "vibrationTrendMmsPerDay"],
    ] as const) {
      const history = calculated
        .slice(Math.max(0, i - 6), i + 1)
        .map((x) => ({ epoch: x.epoch, value: Number(x.values[metric]) }))
        .filter((x) => Number.isFinite(x.value));
      r.values[output] = slopePerDay(history);
    }
    const bearing = Number(r.values.maxBearingTempC);
    const slope = Number(r.values.bearingTrendCPerDay);
    r.values.bearingAdvisoryEtaDays =
      Number.isFinite(bearing) &&
      Number.isFinite(slope) &&
      slope > 0 &&
      bearing < cfg.limits.brgAdvisoryC
        ? (cfg.limits.brgAdvisoryC - bearing) / slope
        : null;
    r.values.thrustHealth = "unavailable";
  });
  return calculated;
}
const metric = (
  key: string,
  label: string,
  unit: string,
  reference?: number,
  referenceLabel = "Design",
  limits?: Metric["limits"],
): Metric => ({ key, label, unit, reference, referenceLabel, limits });
export function metricsFor(
  id: EquipmentId,
  c: Row,
  latest?: Reading,
): Metric[] {
  if (id === "air-blower")
    return [
      metric(
        "efficiencyHeadlinePct",
        String(
          latest?.values.efficiencyMethodUsed ?? "Selected efficiency",
        ).includes("fallback")
          ? "Fluid-power indicator (fallback)"
          : "Selected efficiency",
        "%",
      ),
      metric("efficiencyPolytropicPct", "Polytropic efficiency", "%"),
      metric("efficiencyIsentropicPct", "Isentropic efficiency", "%"),
      metric("powerKw", "Motor input power", "kW"),
      metric("flowNm3hr", "Measured flow", "Nm³/hr"),
      metric("expectedFlowNm3hr", "Expected flow (baseline model)", "Nm³/hr"),
      metric("flowResidualPct", "Flow residual vs model", "%"),
      metric("performanceDegradationPct", "Performance degradation", "%", 0, "Healthy baseline"),
      metric("bearingTrendCPerDay", "Bearing temperature trend", "°C/day"),
      metric("bearingAdvisoryEtaDays", "Trend projection to bearing advisory", "days"),
      metric("maxVibrationMms", "Maximum vibration", "mm/s"),
      metric("maxBearingTempC", "Maximum bearing temperature", "°C"),
      metric("dpBar", "Blower pressure rise", "bar"),
      metric("filterDpBar", "Filter pressure drop", "bar"),
      metric("bypassOpPct", "Bypass opening", "%"),
      metric("pressureRatio", "Pressure ratio", ""),
      metric("t1CUsed", "Suction temperature used", "°C"),
    ].map((m) => {
      const lim = c.limits as unknown as BlowerLimits;
      return {
        ...m,
        limits:
          m.key === "maxVibrationMms"
            ? [
                { name: "Advisory", value: lim.vibAdvisoryMms },
                { name: "Alarm", value: lim.vibAlarmMms },
                { name: "Trip", value: lim.vibTripMms },
              ]
            : m.key === "maxBearingTempC"
              ? [
                  { name: "Advisory", value: lim.brgAdvisoryC },
                  { name: "Alarm", value: lim.brgAlarmC },
                  { name: "Trip", value: lim.brgTripC },
                ]
              : m.key === "dpBar"
                ? [{ name: "Design maximum", value: lim.blowerDpMaxBar }]
                : m.key === "filterDpBar"
                  ? [{ name: "Maximum", value: lim.filterDpMaxBar }]
                  : m.key === "bypassOpPct"
                    ? [{ name: "Maximum", value: lim.bypassOpenMaxPct }]
                    : m.key === "performanceDegradationPct"
                      ? [
                          { name: "Watch", value: lim.performanceWatchPct },
                          { name: "Investigate", value: lim.performanceAlarmPct },
                        ]
                      : undefined,
      };
    });
  if (id === "fired-heater") {
    const cfg = c as unknown as HeaterConfig;
    return [
      metric(
        "etaHeatBalancePct",
        "Heat-balance efficiency",
        "%",
        cfg.designEffPct,
      ),
      metric("etaPtc4Pct", "PTC4 indirect efficiency", "%", cfg.designEffPct),
      metric("etaProcessPct", "Process-side efficiency", "%"),
      metric("etaDeltaPp", "Heat-balance minus process-side efficiency", "pp"),
      metric("closurePct", "Energy closure discrepancy", "%", undefined, "", [
        { name: "Review", value: 3 },
      ]),
      metric(
        "stackTempC",
        "Stack temperature",
        "°C",
        cfg.designStackC,
        "Design",
        [
          { name: "Advisory", value: cfg.stackAdvisoryC },
          { name: "Alarm", value: cfg.stackAlarmC },
        ],
      ),
      metric("excessAirPct", "Excess air", "%", undefined, "", [
        { name: "Advisory", value: cfg.eaAdvisoryPct },
        { name: "Alarm", value: cfg.eaAlarmPct },
      ]),
      metric("bridgewallAvgC", "Bridgewall temperature", "°C", cfg.designBwC),
      metric("qAbsorbedKw", "Absorbed duty", "kW", cfg.designDutyKw),
      metric("qProcessKw", "Process duty", "kW"),
      metric("qLhvKw", "Fuel LHV input", "kW"),
      metric("dryLossPct", "Dry-gas loss", "pp"),
      metric("moistureLossPct", "Moisture loss", "pp"),
      metric("combustionAirKgS", "Combustion air", "kg/s"),
      metric("stackMassKgS", "Flue gas flow", "kg/s"),
    ];
  }
  if (id === "shell-tube-exchanger") {
    const cfg = c as unknown as ExchangerConfig;
    return [
      metric(
        "rfE4",
        "Fouling resistance",
        "×10⁻⁴ m²·K/W",
        0,
        "Clean baseline",
        [
          { name: "Advisory", value: cfg.rfAdvisoryE4 },
          { name: "Alarm", value: cfg.rfAlarmE4 },
        ],
      ),
      metric(
        "uDirtyWm2k",
        "Overall U (dirty)",
        "W/m²·K",
        cfg.uCleanWm2k,
        "Clean baseline",
      ),
      metric("effectivenessPct", "Effectiveness", "%"),
      metric("imbalancePct", "Energy imbalance", "%", undefined, "", [
        { name: "Review", value: cfg.imbalanceAdvisoryPct },
      ]),
      metric("qAvgMw", "Average duty", "MW", cfg.designQMw),
      metric("qHotKw", "Hot-side duty", "kW"),
      metric("qColdKw", "Cold-side duty", "kW"),
      metric("lmtdC", "LMTD", "°C"),
      metric("fFactor", "LMTD correction F", ""),
      metric("approachHotC", "Hot-end approach", "°C"),
      metric("approachColdC", "Cold-end approach", "°C"),
    ];
  }
  const cfg = c as unknown as MembraneConfig;
  return [
    metric(
      "recoveryOnlinePct",
      "H₂ recovery (online / derived feed)",
      "%",
      cfg.designRecoveryPct,
      "Design",
      [{ name: "Recovery floor", value: cfg.recoveryFloorPct }],
    ),
    metric(
      "permeateH2OnlinePct",
      "Permeate H₂ purity (online)",
      "%",
      cfg.designPermeateH2Pct,
      "Design",
      [
        { name: "Advisory", value: cfg.purityAdvisoryPct },
        { name: "Alarm", value: cfg.purityAlarmPct },
      ],
    ),
    metric("recoveryLabPct", "Lab-verified recovery", "%"),
    metric(
      "ratio",
      "Total / non-permeate ratio",
      "",
      cfg.designRatio,
      "Design",
      [{ name: "Alarm", value: cfg.ratioAlarm }],
    ),
    metric("feedFlowNm3Hr", "Feed flow", "Nm³/hr", cfg.designFlowNm3Hr),
    metric("permeateFlowNm3Hr", "Permeate flow", "Nm³/hr"),
    metric("nonPermeateFlowNm3Hr", "Non-permeate flow", "Nm³/hr"),
    metric("feedH2OnlinePct", "Feed H₂ (online / synthetic)", "%"),
    metric("feedH2LabPct", "Feed H₂ (lab)", "%"),
    metric("permeateH2LabPct", "Permeate H₂ (lab)", "%"),
    metric(
      "feedPressureKpag",
      "Feed pressure",
      "kPag",
      cfg.designFeedPressureKpag,
    ),
  ];
}
