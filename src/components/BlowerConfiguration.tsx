import { DataTable } from "./DataTable";
import type {
  BlowerLimits,
  BlowerSettings,
} from "../engineering/blower/calculations";

export function BlowerConfiguration({
  settings,
  limits,
}: {
  settings: BlowerSettings;
  limits: BlowerLimits;
}) {
  return (
    <>
      <h2>Configuration</h2>
      <p className="section-note">
        Engineering assumptions, operating-envelope settings and condition
        thresholds used by the Air Blower model.
      </p>
      <DataTable
        caption="Model settings"
        columns={["parameter", "value", "unit", "purpose"]}
        rows={[
          { parameter: "Blower selection mode", value: settings.blowerMode, unit: "—", purpose: "Auto-select running train or force A/B" },
          { parameter: "Motor line voltage", value: settings.motorVoltageV, unit: "V", purpose: "Three-phase motor input power" },
          { parameter: "Motor power factor", value: settings.powerFactor, unit: "—", purpose: "Three-phase motor input power" },
          { parameter: "Air heat-capacity ratio, k", value: settings.gammaK, unit: "—", purpose: "Isentropic and polytropic efficiency" },
          { parameter: "Site atmospheric pressure", value: settings.atmPressureBar, unit: "bar abs", purpose: "Gauge-to-absolute discharge pressure conversion" },
          { parameter: "Running-current threshold", value: settings.activeCurrentMinA, unit: "A", purpose: "Active blower detection" },
          { parameter: "Suction-temperature forward-fill limit", value: settings.suctionTempFfMaxHours, unit: "h", purpose: "Maximum age of a measured T1 used for thermodynamic efficiency" },
          { parameter: "Performance-baseline training window", value: settings.baselineTrainingDays, unit: "days", purpose: "Reference period used to fit current-to-flow regression" },
          { parameter: "Baseline maximum bypass opening", value: settings.performanceBypassMaxPct, unit: "%", purpose: "Operating-envelope requirement for baseline fitting and comparison" },
          { parameter: "Preferred efficiency method", value: settings.efficiencyMethod, unit: "—", purpose: "Headline efficiency when required measurements are valid" },
        ]}
      />

      <DataTable
        caption="Condition thresholds"
        columns={["parameter", "value", "unit", "application"]}
        rows={[
          { parameter: "Vibration advisory / alarm / trip", value: `${limits.vibAdvisoryMms} / ${limits.vibAlarmMms} / ${limits.vibTripMms}`, unit: "mm/s RMS", application: "Active-train maximum vibration" },
          { parameter: "Bearing temperature advisory / alarm / trip", value: `${limits.brgAdvisoryC} / ${limits.brgAlarmC} / ${limits.brgTripC}`, unit: "°C", application: "Active-train maximum bearing temperature" },
          { parameter: "Filter differential-pressure maximum", value: limits.filterDpMaxBar, unit: "bar", application: "Filter restriction and performance-model applicability" },
          { parameter: "Blower pressure-rise maximum", value: limits.blowerDpMaxBar, unit: "bar", application: "Process-condition advisory" },
          { parameter: "Bypass opening maximum", value: limits.bypassOpenMaxPct, unit: "%", application: "High recycle / bypass advisory" },
          { parameter: "Performance WATCH threshold", value: limits.performanceWatchPct, unit: "%", application: "Measured flow shortfall versus baseline" },
          { parameter: "Performance INVESTIGATE threshold", value: limits.performanceAlarmPct, unit: "%", application: "Measured flow shortfall versus baseline" },
        ]}
      />
    </>
  );
}
