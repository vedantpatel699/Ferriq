import { MetricCard } from "./MetricCard";
import { formatNumber } from "../lib/format";
import type { Reading } from "../engineering/catalog";
import type { BlowerLimits } from "../engineering/blower/calculations";

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stateForLimit(
  value: number | null,
  advisory: number,
  alarm: number,
  trip: number,
) {
  if (value === null) return undefined;
  if (value >= alarm || value >= trip) return "investigate" as const;
  if (value >= advisory) return "watch" as const;
  return "normal" as const;
}

export function BlowerOverview({
  latest,
  limits,
  onSelectMetric,
}: {
  latest: Reading;
  limits: BlowerLimits;
  onSelectMetric?: (key: string) => void;
}) {
  const v = latest.values;
  const degradation = finite(v.performanceDegradationPct);
  const expectedFlow = finite(v.expectedFlowNm3hr);
  const flowResidual = finite(v.flowResidualPct);
  const modelApplicable = v.performanceModelApplicable === true;
  const bearingEta = finite(v.bearingAdvisoryEtaDays);
  const bearingTrend = finite(v.bearingTrendCPerDay);
  const vibrationTrend = finite(v.vibrationTrendMmsPerDay);
  const bearing = finite(v.maxBearingTempC);
  const vibration = finite(v.maxVibrationMms);
  const thermoAvailable =
    finite(v.efficiencyPolytropicPct) !== null &&
    finite(v.efficiencyIsentropicPct) !== null;

  const TrendButton = ({ metric }: { metric: string }) =>
    onSelectMetric ? (
      <button className="text-action" type="button" onClick={() => onSelectMetric(metric)}>
        View trend
      </button>
    ) : null;

  return (
    <div className="blower-overview">
      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Power &amp; efficiency</h2>
            <p className="section-note">Current operating point and energy-performance indicators.</p>
          </div>
        </div>
        <div className="metrics-grid">
          <MetricCard label="Motor input power" value={formatNumber(v.powerKw, 1)} unit="kW" />
          <MetricCard label="Measured flow" value={formatNumber(v.flowNm3hr, 0)} unit="Nm³/hr" />
          <MetricCard label="Pressure ratio" value={formatNumber(v.pressureRatio, 3)} unit="" />
          <MetricCard label="Pressure rise" value={formatNumber(v.dpBar, 3)} unit="bar" />
          <MetricCard
            label={thermoAvailable ? "Polytropic efficiency" : "Fluid-power indicator"}
            value={formatNumber(
              thermoAvailable ? v.efficiencyPolytropicPct : v.efficiencyFluidPct,
              1,
            )}
            unit="%"
            facts={[
              {
                rest: thermoAvailable
                  ? " Thermodynamic efficiency from measured suction and discharge temperatures."
                  : " Thermodynamic efficiency unavailable because a required temperature measurement is missing.",
              },
            ]}
            method={thermoAvailable ? "Polytropic method" : "Performance indicator only"}
          />
        </div>
        <TrendButton metric={thermoAvailable ? "efficiencyPolytropicPct" : "efficiencyFluidPct"} />
      </section>

      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Performance degradation</h2>
            <p className="section-note">Measured performance compared with the healthy-reference model at the current motor load.</p>
          </div>
        </div>
        <div className="performance-comparison">
          <div>
            <span>Measured flow</span>
            <strong>{formatNumber(v.flowNm3hr, 0)} Nm³/hr</strong>
          </div>
          <div>
            <span>Expected flow</span>
            <strong>{formatNumber(expectedFlow, 0)} Nm³/hr</strong>
          </div>
          <div>
            <span>Flow residual</span>
            <strong>{flowResidual === null ? "N/A" : `${formatNumber(flowResidual, 1)}%`}</strong>
          </div>
          <div>
            <span>Performance degradation</span>
            <strong>{degradation === null ? "N/A" : `${formatNumber(degradation, 1)}%`}</strong>
          </div>
        </div>
        <div className={`model-applicability ${modelApplicable ? "valid" : "unavailable"}`}>
          <strong>{modelApplicable ? "Baseline comparison valid" : "Baseline comparison not applied"}</strong>
          <span>
            {modelApplicable
              ? " Current bypass position and filter differential pressure are inside the configured baseline envelope."
              : " Current operating conditions are outside the configured baseline envelope."}
          </span>
        </div>
        <TrendButton metric="performanceDegradationPct" />
      </section>

      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Bearing health</h2>
            <p className="section-note">Active-train vibration, bearing temperature and short-window condition trends.</p>
          </div>
        </div>
        <div className="metrics-grid">
          <MetricCard
            label="Maximum vibration"
            value={formatNumber(vibration, 2)}
            unit="mm/s"
            state={stateForLimit(
              vibration,
              limits.vibAdvisoryMms,
              limits.vibAlarmMms,
              limits.vibTripMms,
            )}
            facts={[
              { bold: `${limits.vibAdvisoryMms} mm/s`, rest: " advisory threshold" },
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
            value={formatNumber(bearing, 1)}
            unit="°C"
            state={stateForLimit(
              bearing,
              limits.brgAdvisoryC,
              limits.brgAlarmC,
              limits.brgTripC,
            )}
            facts={[
              { bold: `${limits.brgAdvisoryC} °C`, rest: " advisory threshold" },
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
                    : " Linear trend projection only; not remaining useful life.",
              },
            ]}
          />
          <MetricCard
            label="Filter differential pressure"
            value={formatNumber(v.filterDpBar, 4)}
            unit="bar"
            facts={[{ bold: `${limits.filterDpMaxBar} bar`, rest: " configured maximum" }]}
          />
        </div>
        <div className="inline-actions">
          <TrendButton metric="maxVibrationMms" />
          <TrendButton metric="maxBearingTempC" />
        </div>
      </section>

      <section className="blower-section thrust-section">
        <div>
          <h2>Thrust health</h2>
          <p className="section-note">
            Dedicated thrust monitoring requires an axial-position, axial-displacement,
            thrust-bearing-temperature, or equivalent OEM-designated measurement.
          </p>
        </div>
        <div className="thrust-unavailable">
          <strong>Not instrumented</strong>
          <span>No dedicated thrust measurement is currently mapped, so thrust condition is not inferred from radial vibration.</span>
        </div>
      </section>
    </div>
  );
}
