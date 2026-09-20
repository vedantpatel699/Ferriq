import { HOURS_PER_DAY, OPERATING_DAYS_PER_YEAR } from "./data";

export const OPEX_ITEMS = {
  electricity: { label: "Electricity", unit: "kWh" },
  steam: { label: "Steam", unit: "t" },
  naturalGas: { label: "Natural gas", unit: "GJ" },
  chemicals: { label: "Chemicals", unit: "kg" },
  maintenance: { label: "Maintenance", unit: "m³ feed" },
} as const;
export type OpexKey = keyof typeof OPEX_ITEMS;
export interface OpexItem {
  basis: "hourly" | "throughput" | "annual";
  consumption: number;
  rate: number;
  annualCad: number;
}
export type OperatingCosts = Record<OpexKey, OpexItem>;
export const DEFAULT_OPEX = Object.fromEntries(
  Object.keys(OPEX_ITEMS).map((key) => [
    key,
    { basis: "annual", consumption: 0, rate: 0, annualCad: 0 },
  ]),
) as OperatingCosts;

export function validateOpex(value: unknown): OperatingCosts {
  if (value === undefined) return structuredClone(DEFAULT_OPEX);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Operating costs must contain all five categories.");
  const out = value as OperatingCosts;
  if (Object.keys(out).some((k) => !(k in OPEX_ITEMS)))
    throw Error("Unknown operating-cost category.");
  for (const key of Object.keys(OPEX_ITEMS) as OpexKey[]) {
    const item = out[key];
    if (
      !item ||
      !["hourly", "throughput", "annual"].includes(item.basis) ||
      [item.consumption, item.rate, item.annualCad].some(
        (v) => typeof v !== "number" || !Number.isFinite(v) || v < 0,
      )
    )
      throw Error(
        `${OPEX_ITEMS[key].label}: enter a valid basis and finite, nonnegative costs and consumption.`,
      );
    if (key === "maintenance" && item.basis === "hourly")
      throw Error("Maintenance uses annual CAD or CAD per m³ feed.");
  }
  return out;
}

export function operatingCosts(value: unknown, feedM3Hr: number) {
  const config = validateOpex(value);
  if (!Number.isFinite(feedM3Hr) || feedM3Hr < 0)
    throw Error("Feed flow must be finite and nonnegative.");
  const hours = HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR;
  const items = (Object.keys(OPEX_ITEMS) as OpexKey[]).map((key) => {
    const item = config[key];
    const annualCad =
      item.basis === "annual"
        ? item.annualCad
        : hours *
          item.rate *
          (key === "maintenance"
            ? feedM3Hr
            : item.consumption * (item.basis === "throughput" ? feedM3Hr : 1));
    if (!Number.isFinite(annualCad))
      throw Error("Operating cost exceeds the supported numeric range.");
    return {
      key,
      category: OPEX_ITEMS[key].label,
      annualCad,
      cadPerOperatingHour: annualCad / hours,
    };
  });
  const annualCad = items.reduce((sum, item) => sum + item.annualCad, 0);
  if (!Number.isFinite(annualCad))
    throw Error("Total operating cost exceeds the supported numeric range.");
  return {
    items,
    annualCad,
    cadPerOperatingHour: annualCad / hours,
    hoursPerYear: hours,
  };
}

// Suncor 2025 R&M OS&G / operating revenues: 2,439 / 30,671 = 7.95%.
// Rounded planning allowance; includes selling/general costs, not just utilities.
export const DEFAULT_OPEX_REVENUE_PERCENT = 8;
export const REVENUE_OPEX_LABELS = {
  steam: "Steam",
  electricity: "Power",
  naturalGas: "Natural gas",
  chemicalsCatalyst: "Chemicals + catalyst",
} as const;
export type RevenueOpexComponents = Record<
  keyof typeof REVENUE_OPEX_LABELS,
  number
>;
export function revenueOpexComponents(
  percent: unknown,
  components?: unknown,
): RevenueOpexComponents {
  if (components !== undefined) {
    if (
      !components ||
      typeof components !== "object" ||
      Array.isArray(components)
    )
      throw Error("Enter all four variable-cost percentages.");
    const values = components as RevenueOpexComponents;
    if (
      Object.keys(values).length !== 4 ||
      Object.keys(values).some((k) => !(k in REVENUE_OPEX_LABELS)) ||
      Object.keys(REVENUE_OPEX_LABELS).some(
        (k) =>
          typeof values[k as keyof RevenueOpexComponents] !== "number" ||
          !Number.isFinite(values[k as keyof RevenueOpexComponents]) ||
          values[k as keyof RevenueOpexComponents] < 0,
      ) ||
      Object.values(values).reduce((a, b) => a + b, 0) > 100
    )
      throw Error(
        "Variable-cost percentages must be finite, nonnegative and total no more than 100%.",
      );
    return values;
  }
  const total = percent === undefined ? DEFAULT_OPEX_REVENUE_PERCENT : percent;
  if (
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    total < 0 ||
    total > 100
  )
    throw Error("OPEX must be between 0 and 100% of sales revenue.");
  return {
    steam: total / 4,
    electricity: total / 4,
    naturalGas: total / 4,
    chemicalsCatalyst: total / 4,
  };
}
export function revenueOpex(
  percent: unknown,
  legacy: unknown,
  feed: number,
  revenueCadHr: number,
  components?: unknown,
) {
  if (components === undefined && percent === undefined && legacy !== undefined)
    return operatingCosts(legacy, feed);
  const allocation = revenueOpexComponents(percent, components);
  if (!Number.isFinite(revenueCadHr) || revenueCadHr < 0)
    throw Error("Sales revenue must be finite and nonnegative.");
  const hours = HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR;
  const items = Object.entries(REVENUE_OPEX_LABELS).map(([key, category]) => {
    const percent = allocation[key as keyof RevenueOpexComponents];
    return {
      key,
      category,
      annualCad: ((revenueCadHr * percent) / 100) * hours,
      cadPerOperatingHour: (revenueCadHr * percent) / 100,
    };
  });
  const cost = items.reduce((sum, item) => sum + item.cadPerOperatingHour, 0);
  const annualCad = items.reduce((sum, item) => sum + item.annualCad, 0);
  if (!Number.isFinite(annualCad))
    throw Error("Operating cost exceeds the supported numeric range.");
  return {
    items,
    annualCad,
    cadPerOperatingHour: cost,
    hoursPerYear: hours,
  };
}
