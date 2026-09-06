// Shared engineering types used by every equipment module and by the UI
// layer that consumes their output. The UI must never compute engineering
// values itself — it only formats and displays what these modules return.

/** Ferriq's own page-level engineering-state vocabulary. Distinct from the
 * raw physical severity tiers (advisory/alarm/trip) that come from
 * underlying standards like ISO 10816 or API 530 — those are reported as
 * plain facts (see Condition.rawSeverity / health-bar zone labels), never
 * as this top-level state. Ferriq sits upstream of DCS-style alarming and
 * does not implement alarm acknowledgement, shelving, or notification
 * workflows. */
export type EquipmentState = "normal" | "watch" | "investigate" | "data-issue";

/** Raw physical severity tier from an underlying engineering standard
 * (ISO 10816 vibration zones, API 530 tube-metal-temperature limits,
 * etc). Shown as reference facts (health-bar zone labels, threshold
 * lines) — never surfaced as the page-level EquipmentState. */
export type RawSeverity = "ok" | "advisory" | "alarm" | "trip";

export interface MetricValue {
  label: string;
  value: number | null;
  unit: string;
  /** True when the underlying inputs made this value unavailable to compute
   * (e.g. missing discharge temperature) rather than merely zero. */
  unavailable?: boolean;
  method?: string;
}

export interface EngineeringReference {
  /** What the current value is being compared against — a design value,
   * commissioning baseline, or rolling baseline. Always a fixed
   * engineering quantity, never redefined by the selected trend window. */
  label: string;
  value: number;
  unit: string;
  /** Deviation of the current value from this reference (signed). */
  deviation: number;
  deviationUnit: string;
}

export type TrendSemantic = "improving" | "worsening" | "stable";

export interface TrendState {
  /** Change in the metric during the selected time range — a distinct
   * quantity from EngineeringReference.deviation (which is fixed and
   * range-independent). */
  changeByRange: Record<TimeRangeId, number>;
  changeUnit: string;
  semantic: TrendSemantic;
}

export interface Condition {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentTag: string;
  href: string;
  description: string;
  current: MetricValue;
  reference: EngineeringReference;
  trend: TrendState;
  rawSeverity: RawSeverity;
  /** Wall-clock duration the condition has been active, e.g. "6 h". Kept
   * as a plain temporal fact, independent of the priority ranking (which
   * ordering in the Watchlist conveys). */
  durationLabel: string;
  isNewSinceLastReview: boolean;
}

export interface Prediction {
  currentValue: number;
  projectedValue: number;
  horizonLabel: string;
  marginToConstraint: number;
  projectedMarginToConstraint: number;
  constraintLabel: string;
  constraintValue: number;
}

/** The three terminology classes the user's spec requires kept separate;
 * never conflated in UI copy. */
export type DataQualityKind = "data-quality" | "calculation-assumption" | "model-limitation";

export interface DataQualityState {
  kind: DataQualityKind;
  message: string;
}

export type TimeRangeId = "shift" | "24h" | "7d" | "custom";

export interface TimeRange {
  id: TimeRangeId;
  start: Date;
  end: Date;
}

export interface TimeSeriesPoint {
  t: number; // epoch ms
  v: number | null;
}

export interface EquipmentResult {
  equipmentId: string;
  timestamp: string;
  state: EquipmentState;
  rawSeverity: RawSeverity;
  metrics: MetricValue[];
  dataQuality: DataQualityState[];
  alerts: EngineeringAlert[];
}

export interface EngineeringAlert {
  severity: RawSeverity;
  message: string;
  source: string;
}
