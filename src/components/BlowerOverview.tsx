import { MetricCard } from "./MetricCard";
import { formatNumber } from "../lib/format";
import type { Reading } from "../engineering/catalog";

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function BlowerOverview({ latest }: { latest: Reading }) {
  const v = latest.values;
  const degradation = finite(v.performanceDegradationPct);
  const expectedFlow = finite(v.expectedFlowNm3hr);
  const flowResidual = finite(v.flowResidualPct);
  const modelApplicable = v.performanceModelApplicable === true;
  const bearingEta = finite(v.bearingAdvisoryEtaDays);
  const bearingTrend = finite(v.bearingTrendCPerDay);
  const vibrationTrend = finite(v.vibrationTrendMmsPerDay);
  const thermoAvailable =
    finite(v.efficiencyPolytropicPct) !== null &&
    finite(v.efficiencyIsentropicPct) !== null;

  return (
    <>
      <div className="section-heading-row">
        <h2>Performance</h2>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label="Active blower"
          value={String(v.activeBlower ?? "—")}
          facts={[{ rest: " Selected from motor current." }]}
        />
        <MetricCard
          label="Motor input power"
          value={formatNumber(v.powerKw, 1)}
          unit="kW"
        />
        <MetricCard
          label="Measured flow"
          value={formatNumber(v.flowNm3hr, 0)}
          unit="Nm³/hr"
        />
        <MetricCard
          label="Performance vs baseline"
          value={modelApplicable ? formatNumber(degradation, 1) : "N/A"}
          unit={modelApplicable ? "%" : ""}
          state={
            !modelApplicable
              ? undefined
              : degradation !== null && degradation >= 10
                ? "investigate"
                : degradation !== null && degradation >= 5
                  ? "watch"
                  : "normal"
          }
          facts={[
            {
              bold:
                expectedFlow === null
                  ? undefined
                  : `${formatNumber(expectedFlow, 0)} Nm³/hr`,
              rest: " expected flow",
            },
            {
              bold:
                flowResidual === null
                  ? undefined
                  : `${formatNumber(flowResidual, 1)}%`,
              rest: modelApplicable
                ? " measured-flow residual"
                : " baseline comparison not applied at this operating condition",
            },
          ]}
          method="Current-to-flow healthy-reference regression"
        />
        <MetricCard
          label={
            thermoAvailable
              ? "Polytropic efficiency"
              : "Fluid-power indicator"
          }
          value={formatNumber(
            thermoAvailable
              ? v.efficiencyPolytropicPct
              : v.efficiencyFluidPct,
            1,
          )}
          unit="%"
          method={
            thermoAvailable
              ? "Thermodynamic efficiency"
              : "Thermodynamic temperature inputs unavailable"
          }
        />
        <MetricCard
          label="Pressure rise"
          value={formatNumber(v.dpBar, 3)}
          unit="bar"
        />
        <MetricCard
          label="Bypass opening"
          value={formatNumber(v.bypassOpPct, 1)}
          unit="%"
        />
      </div>

      <div className="section-heading-row">
        <h2>Mechanical condition</h2>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label="Maximum vibration"
          value={formatNumber(v.maxVibrationMms, 2)}
          unit="mm/s"
          facts={[
            {
              rest:
                vibrationTrend === null
                  ? " Trend unavailable."
                  : ` 7-observation trend ${vibrationTrend >= 0 ? "+" : ""}${formatNumber(vibrationTrend, 3)} mm/s/day.`,
            },
          ]}
        />
        <MetricCard
          label="Maximum bearing temperature"
          value={formatNumber(v.maxBearingTempC, 1)}
          unit="°C"
          facts={[
            {
              rest:
                bearingTrend === null
                  ? " Trend unavailable."
                  : ` 7-observation trend ${bearingTrend >= 0 ? "+" : ""}${formatNumber(bearingTrend, 2)} °C/day.`,
            },
          ]}
        />
        <MetricCard
          label="Bearing advisory projection"
          value={formatNumber(bearingEta, 1)}
          unit={bearingEta === null ? "" : "days"}
          facts={[
            {
              rest:
                bearingEta === null
                  ? " No rising trend below the advisory threshold."
                  : " Trend projection only; not remaining useful life.",
            },
          ]}
        />
        <MetricCard
          label="Filter differential pressure"
          value={formatNumber(v.filterDpBar, 4)}
          unit="bar"
        />
      </div>
      <p className="source-note">
        Thrust health is not calculated until an axial-position or
        thrust-bearing-temperature measurement is mapped.
      </p>
    </>
  );
}
