import { z } from "zod";
import {
  timestamp,
  equipmentIds,
  normalizeRows,
  seedEquipment,
  type EquipmentData,
  type EquipmentId,
} from "../engineering/catalog";
import {
  CRUDES,
  PRODUCTS,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  DEFAULT_CRUDE_FLOWS_M3HR,
} from "../engineering/crudeToProfit/data";
export interface Resource {
  key: string;
  version: number;
  data: unknown;
  updatedAt: string;
}
export interface WorkspaceEvent {
  id: string;
  action: string;
  resourceKey: string;
  version: number;
  createdAt: string;
  actor: string;
}
export interface WorkspaceSnapshot {
  workspace: { id: string; name: string };
  user: { email: string; role: "viewer" | "editor" | "admin" };
  resources: Resource[];
  events: WorkspaceEvent[];
}
export const settingsSchema = z
  .object({
    shiftStartHour: z.number().int().min(0).max(23),
    shiftEndHour: z.number().int().min(0).max(23),
  })
  .strict()
  .refine((v) => v.shiftStartHour < v.shiftEndHour, {
    message:
      "Day-shift start must be before its end. Night shift is the complementary interval.",
  });
export function defaultResources(): Record<string, unknown> {
  return {
    ...Object.fromEntries(equipmentIds.map((id) => [id, seedEquipment(id)])),
    settings: { shiftStartHour: 7, shiftEndHour: 19 },
    economics: {
      flows: DEFAULT_CRUDE_FLOWS_M3HR,
      config: DEFAULT_CRUDE_TO_PROFIT_CONFIG,
      residueUnit: "lc_finer",
      gasOilUnit: "hydrocracker",
      market: null,
    },
  };
}
function validateShape(
  value: unknown,
  template: unknown,
  path = "configuration",
): void {
  if (typeof template === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw Error(`${path} must be a finite number.`);
    return;
  }
  if (typeof template === "string") {
    if (typeof value !== "string" || value.length > 500)
      throw Error(`${path} must be text.`);
    return;
  }
  if (template && typeof template === "object") {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) !== Array.isArray(template)
    )
      throw Error(`${path} has the wrong format.`);
    for (const [k, v] of Object.entries(template))
      validateShape((value as Record<string, unknown>)[k], v, `${path}.${k}`);
  }
}
export function validateResource(key: string, input: unknown): unknown {
  if (key === "settings") return settingsSchema.parse(input);
  if (equipmentIds.includes(key as EquipmentId)) {
    const v = z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(50000),
        config: z.record(z.string(), z.unknown()),
        source: z.string().min(1).max(250),
        importedAt: z.string().optional(),
      })
      .strict()
      .parse(input);
    validateShape(v.config, seedEquipment(key as EquipmentId).config);
    const config = v.config as Record<string, unknown>;
    if (key === "air-blower") {
      const s = config.settings as Record<string, unknown>;
      if (
        !["auto", "A", "B"].includes(String(s.blowerMode)) ||
        !["polytropic", "isentropic", "fluid"].includes(
          String(s.efficiencyMethod),
        )
      )
        throw Error("Choose a supported blower mode and efficiency method.");
      if (
        Number(s.gammaK) <= 1 ||
        Number(s.motorVoltageV) <= 0 ||
        Number(s.powerFactor) <= 0 ||
        Number(s.powerFactor) > 1
      )
        throw Error("Check motor voltage, power factor (0–1), and gamma (>1).");
    }
    if (
      key === "shell-tube-exchanger" &&
      (Number(config.areaM2) <= 0 ||
        Number(config.uCleanWm2k) <= 0 ||
        !Number.isInteger(config.nShell) ||
        Number(config.nShell) < 1)
    )
      throw Error("Area, clean U and shell-pass count must be positive.");
    for (const [k, val] of Object.entries(config))
      if (typeof val === "number" && val < 0 && !/Temp|refTemp/.test(k))
        throw Error(`${k} must not be negative.`);
    const rows = normalizeRows(key as EquipmentId, v.rows);
    if (
      !rows.some((r) =>
        Object.entries(r).some(
          ([k, x]) =>
            k !== "timestamp" && typeof x === "number" && Number.isFinite(x),
        ),
      )
    )
      throw Error(
        "No recognized numeric measurements. Use the input CSV template.",
      );
    const times = rows.map((r) => timestamp(r.timestamp));
    if (new Set(times).size !== times.length)
      throw Error(
        "Duplicate observation timestamps are not allowed in one dataset.",
      );
    return { ...v, rows } satisfies EquipmentData;
  }
  if (key === "economics") {
    const v = z
      .object({
        flows: z.object({
          OSH: z.number().nonnegative(),
          SHD: z.number().nonnegative(),
          AWB: z.number().nonnegative(),
          SCO: z.number().nonnegative(),
          FRB: z.number().nonnegative(),
        }),
        config: z.record(z.string(), z.unknown()),
        residueUnit: z.enum(["lc_finer", "delayed_coker"]),
        gasOilUnit: z.enum(["hydrocracker", "fcc"]),
        market: z.unknown().nullable(),
      })
      .strict()
      .parse(input);
    validateShape(v.config, DEFAULT_CRUDE_TO_PROFIT_CONFIG);
    const checkNumbers = (value: unknown, path: string) => {
      if (typeof value === "number" && (!Number.isFinite(value) || value < 0))
        throw Error(path + " must be finite and nonnegative.");
      if (value && typeof value === "object")
        for (const [k, n] of Object.entries(value))
          checkNumbers(n, path + "." + k);
    };
    checkNumbers(v.config, "Configuration");
    if (v.market !== null) {
      const market = z
        .object({
          date: z.iso.date(),
          source: z.string().trim().min(1).max(500),
          currency: z.literal("CAD"),
          unit: z.literal("CAD/m3"),
          crude: z.record(z.string(), z.number().nonnegative()),
          product: z.record(z.string(), z.number().nonnegative()),
        })
        .strict()
        .parse(v.market);
      if (
        !CRUDES.every((c) => market.crude[c] !== undefined) ||
        !PRODUCTS.every((p) => market.product[p] !== undefined)
      )
        throw Error(
          "A complete price snapshot requires all crudes and products.",
        );
      v.market = market;
    }
    return v;
  }
  if (key === "furnace-model") {
    const v = z
      .object({
        version: z.string(),
        trained_at: z.string(),
        horizon_hours: z.number().positive(),
        alarm_threshold_c: z.number().finite(),
        advisory_threshold_c: z.number().finite(),
        furnaces: z.record(z.string(), z.unknown()),
      })
      .passthrough()
      .parse(input);
    if (!Object.keys(v.furnaces).length)
      throw Error("Model must contain a furnace.");
    if (v.advisory_threshold_c >= v.alarm_threshold_c)
      throw Error("Model advisory threshold must be below alarm.");
    let count = 0;
    const check = (node: unknown, depth = 0) => {
      if (depth > 64 || ++count > 1000000)
        throw Error("Model exceeds supported tree size.");
      const n = z
        .object({
          v: z.number().finite().optional(),
          f: z.number().int().nonnegative().optional(),
          t: z.number().finite().optional(),
          m: z.number().int().min(0).max(1).optional(),
          l: z.unknown().optional(),
          r: z.unknown().optional(),
        })
        .parse(node);
      if (n.v === undefined) {
        if (n.f === undefined || n.t === undefined)
          throw Error("Invalid indexed tree node.");
        check(n.l, depth + 1);
        check(n.r, depth + 1);
      }
    };
    for (const f of Object.values(v.furnaces)) {
      const entry = z
        .object({
          label: z.string(),
          passes: z.number().int().positive(),
          cadence_hours: z.number().positive(),
          history: z
            .array(
              z.record(
                z.string(),
                z.union([z.string(), z.number().finite(), z.null()]),
              ),
            )
            .min(2),
          tc_models: z.record(
            z.string(),
            z.object({
              pass: z.number().int().positive(),
              feature_names: z.array(z.string()),
              p10: z.object({ trees: z.array(z.unknown()) }).passthrough(),
              p50: z.object({ trees: z.array(z.unknown()) }).passthrough(),
              p90: z.object({ trees: z.array(z.unknown()) }).passthrough(),
            }),
          ),
        })
        .passthrough()
        .parse(f);
      for (const row of entry.history)
        if (!Number.isFinite(timestamp(row.t)))
          throw Error("Each model history row needs a valid timestamp.");
      if (!Object.keys(entry.tc_models).length)
        throw Error("Model needs thermocouples.");
      for (let p = 1; p <= entry.passes; p++)
        if (
          !Object.entries(entry.tc_models).some(
            ([a, m]) =>
              m.pass === p &&
              entry.history.filter((row) => typeof row[a] === "number")
                .length >= 2,
          )
        )
          throw Error(
            "Each pass needs a thermocouple with at least two observations.",
          );
      for (const m of Object.values(entry.tc_models))
        for (const q of [m.p10, m.p50, m.p90]) q.trees.forEach((t) => check(t));
    }
    return v;
  }
  throw Error("Unknown workspace resource.");
}
