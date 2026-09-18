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
  const thrustProxy = finite(v.thrustProxyPct);
  const modelIntercept = finite(v.performanceModelIntercept);
  const modelSlope = finite(v.performanceModelSlope);
  const modelTrainingRows = finite(v.performanceModelTrainingRows);
  const powerFactorUsed = finite(v.powerFactorUsed);
  const thermoAvailable =
    finite(v.efficiencyPolytropicPct) !== null &&
    finite(v.efficiencyIsentropicPct) !== null;

  const TrendButton = ({ metric }: { metric: string }) =>
    onSelectMetric ? (
      <button
        className="text-action"
        type="button"
        onClick={() => onSelectMetric(metric)}
      >
        View trend
      </button>
    ) : null;

  return (
    <div className="blower-overview">
      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Power &amp; efficiency</h2>
            <p className="section-note">
              Current operating point and energy-performance indicators.
            </p>
          </div>
        </div>
        <div className="metrics-grid">
          <MetricCard
            label="Total electrical input"
            value={formatNumber(v.totalPowerKw, 1)}
            unit="kW"
            facts={[
              {
                bold:
                  powerFactorUsed === null
                    ? undefined
                    : `PF ${formatNumber(powerFactorUsed, 3)}`,
                rest: ` ${String(v.powerFactorSource ?? "")} for selected train; each running motor uses its own current.`,
              },
            ]}
          />
          <MetricCard
            label="Measured flow"
            value={formatNumber(v.flowNm3hr, 0)}
            unit="Nm³/hr"
          />
          <MetricCard
            label="Pressure ratio"
            value={formatNumber(v.pressureRatio, 3)}
            unit=""
          />
          <MetricCard
            label="Pressure rise"
            value={formatNumber(v.dpBar, 3)}
            unit="bar"
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
            facts={[
              {
                rest: thermoAvailable
                  ? " Thermodynamic efficiency from supplied suction and discharge temperatures."
                  : " Thermodynamic efficiency unavailable because a required temperature measurement is missing.",
              },
            ]}
            method={
              thermoAvailable
                ? "Polytropic method"
                : "Performance indicator only"
            }
          />
        </div>
        <TrendButton
          metric={
            thermoAvailable ? "efficiencyPolytropicPct" : "efficiencyFluidPct"
          }
        />
      </section>

      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Performance degradation</h2>
            <p className="section-note">
              Measured performance compared with the healthy-reference model at
              the current motor load.
            </p>
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
            <strong>
              {flowResidual === null
                ? "N/A"
                : `${formatNumber(flowResidual, 1)}%`}
            </strong>
          </div>
          <div>
            <span>Performance degradation</span>
            <strong>
              {degradation === null
                ? "N/A"
                : `${formatNumber(degradation, 1)}%`}
            </strong>
          </div>
        </div>
        <div
          className={`model-applicability ${modelApplicable ? "valid" : "unavailable"}`}
        >
          <strong>
            {modelApplicable
              ? "Within reference range"
              : "Baseline comparison not applied"}
          </strong>
          <span>
            {modelApplicable
              ? " Current, pressure ratio, bypass and filter differential pressure meet the reference checks. Constant speed is assumed."
              : " A completed reference period and complete comparable measurements are required."}
          </span>
        </div>
        <details className="disclosure">
          <summary>Baseline model details</summary>
          <div className="disclosure-body">
            <p>
              Qexpected = a + b × motor current. a ={" "}
              <strong>{formatNumber(modelIntercept, 1)}</strong> Nm³/hr; b ={" "}
              <strong>{formatNumber(modelSlope, 2)}</strong> Nm³/hr/A; training
              observations ={" "}
              <strong>{formatNumber(modelTrainingRows, 0)}</strong>.
            </p>
            <p>
              a and b are fitted from the initial assumed-healthy reference
              window, not taken from the vendor datasheet.
            </p>
          </div>
        </details>
        <TrendButton metric="performanceDegradationPct" />
      </section>

      <section className="blower-section">
        <div className="section-heading-row">
          <div>
            <h2>Bearing health</h2>
            <p className="section-note">
              Active-train vibration, bearing temperature and short-window
              condition trends.
            </p>
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
              {
                bold: `${limits.vibAdvisoryMms} mm/s`,
                rest: " advisory threshold",
              },
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
              {
                bold: `${limits.brgAdvisoryC} °C`,
                rest: " advisory threshold",
              },
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
            facts={[
              {
                bold: `${limits.filterDpMaxBar} bar`,
                rest: " configured maximum",
              },
            ]}
          />
        </div>
        <div className="inline-actions">
          <TrendButton metric="maxVibrationMms" />
          <TrendButton metric="maxBearingTempC" />
        </div>
      </section>

      <section className="blower-section thrust-section">
        <div>
          <h2>Thrust assessment</h2>
          <p className="section-note">
            Direct thrust assessment is unavailable. The index below shows
            operating deviation only; it does not measure thrust or predict
            failure.
          </p>
        </div>
        <div className="metrics-grid">
          <MetricCard
            label="Operating-deviation index"
            value={formatNumber(thrustProxy, 1)}
            unit="%"
            facts={[
              {
                rest: " Informational index; no health alarm is assigned.",
              },
              {
                rest: " Direct axial or thrust-bearing instrumentation is still required for a true thrust assessment.",
              },
            ]}
            method="Equal-weight RMS of flow, pressure-ratio and bypass deviations from the design point"
          />
        </div>
        <TrendButton metric="thrustProxyPct" />
      </section>
    </div>
  );
}
