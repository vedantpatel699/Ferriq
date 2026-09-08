import { useMemo } from "react";
import { useWorkspace } from "./WorkspaceContext";
import {
  calculate,
  metricsFor,
  equipmentIds,
  identities,
  timestamp,
  type EquipmentData,
  type Reading,
  type Metric,
} from "../engineering/catalog";
import {
  forecastPass,
  statusForSkin,
  type FurnaceModelBundle,
} from "../engineering/furnace/calculations";
import { stateFromAlerts } from "../engineering/catalog";
import type { EquipmentState } from "../engineering/types";
export interface Summary {
  id: string;
  name: string;
  tag: string;
  path: string;
  state: EquipmentState;
  condition: string;
  metric: Metric;
  value: number | null;
  rows: Reading[];
  asOf: number;
  quality: string[];
  duration: string;
  priority: number;
}
export function changeOver(
  rows: Reading[],
  key: string,
  start: number,
  end: number,
): number | null {
  const valid = rows.filter(
    (r) =>
      r.epoch >= start &&
      r.epoch <= end &&
      typeof r.values[key] === "number" &&
      Number.isFinite(r.values[key]),
  );
  return valid.length >= 2
    ? Number(valid.at(-1)!.values[key]) - Number(valid[0].values[key])
    : null;
}
export function useSummaries(): Summary[] {
  const { snapshot } = useWorkspace();
  return useMemo(() => {
    const summaries: Summary[] = equipmentIds.map((id) => {
      const data = snapshot.resources.find((r) => r.key === id)!
        .data as EquipmentData;
      const rows = calculate(id, data),
        latest = rows.at(-1)!;
      const metric = metricsFor(id, data.config, latest)[0];
      let first = rows.length - 1;
      while (first > 0 && rows[first - 1].state === latest.state) first--;
      const hours = (latest.epoch - rows[first].epoch) / 3600000;
      const priority =
        latest.state === "investigate"
          ? 3
          : latest.state === "watch"
            ? 2
            : latest.quality.length
              ? 1
              : 0;
      return {
        id,
        ...identities[id],
        path: "/equipment/" + id,
        state: latest.state,
        condition:
          latest.alerts[0]?.message ??
          (latest.quality.length
            ? "Review data qualification"
            : "Within configured reference limits"),
        metric,
        value:
          typeof latest.values[metric.key] === "number" &&
          Number.isFinite(latest.values[metric.key])
            ? Number(latest.values[metric.key])
            : null,
        rows,
        asOf: latest.epoch,
        quality: latest.quality,
        duration: priority
          ? `${first === 0 ? "At least " : ""}${hours >= 24 ? (hours / 24).toFixed(1) + " d" : hours.toFixed(1) + " h"} in current state`
          : "—",
        priority,
      };
    });
    const model = snapshot.resources.find((r) => r.key === "furnace-model")
      ?.data as FurnaceModelBundle | undefined;
    if (model) {
      const passes = [];
      for (const [key, f] of Object.entries(model.furnaces)) {
        const last = f.history.at(-1)!;
        const current = Object.fromEntries(
          Object.entries(last).filter(([, v]) => typeof v === "number"),
        ) as Record<string, number>;
        const by = Object.fromEntries(
          Object.keys(f.tc_models).map((a) => [
            a,
            f.history.map((r) => r[a] as number).filter((v) => v != null),
          ]),
        );
        for (let pass = 1; pass <= f.passes; pass++) {
          const result = forecastPass(
            f,
            pass,
            current,
            by,
            model.alarm_threshold_c,
          );
          if (result)
            passes.push({
              key,
              f,
              pass,
              result,
              severity: statusForSkin(result.skinNowC, result.hoursToAlarm),
            });
        }
      }
      passes.sort(
        (a, b) =>
          ({ alarm: 3, trip: 3, advisory: 2, ok: 0 })[b.severity] -
            { alarm: 3, trip: 3, advisory: 2, ok: 0 }[a.severity] ||
          b.result.skinNowC - a.result.skinNowC,
      );
      const p = passes[0];
      if (p) {
        const state = stateFromAlerts(
          p.severity === "ok"
            ? []
            : [{ severity: p.severity, message: "", source: "Furnace engine" }],
        );
        summaries.push({
          id: "furnace-skin-temp",
          name: "Furnace Skin TI Predictor",
          tag: `${p.f.label} · Pass ${p.pass}`,
          path: `/predictors/furnace-skin-temp?furnace=${p.key}&pass=${p.pass}`,
          state,
          condition:
            state === "normal"
              ? "All passes within configured review criteria"
              : `Highest-priority pass: ${p.result.skinNowC.toFixed(1)}°C; review measured and forecast reference criteria.`,
          metric: {
            key: "skinNowC",
            label: "Highest-priority pass skin TI",
            unit: "°C",
            reference: model.alarm_threshold_c,
            referenceLabel: "Alarm reference",
          },
          value: p.result.skinNowC,
          rows: [],
          asOf: timestamp(p.f.history.at(-1)!.t),
          quality: [],
          duration: "Forecast snapshot; duration unavailable",
          priority: state === "investigate" ? 3 : state === "watch" ? 2 : 0,
        });
      }
    }
    return summaries;
  }, [snapshot.resources]);
}
