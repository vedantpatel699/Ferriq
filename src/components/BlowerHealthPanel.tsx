import type { Reading } from "../engineering/catalog";
import type { EquipmentState, EngineeringAlert } from "../engineering/types";
import { formatNumber } from "../lib/format";

function stateTitle(state: EquipmentState) {
  if (state === "investigate") return "INVESTIGATE";
  if (state === "watch") return "WATCH";
  if (state === "data-issue") return "DATA REVIEW";
  return "NORMAL";
}

function severityLabel(alert: EngineeringAlert) {
  if (alert.severity === "trip") return "TRIP";
  if (alert.severity === "alarm") return "ALARM";
  if (alert.severity === "advisory") return "ADVISORY";
  return "NORMAL";
}

function recommendedAction(message: string) {
  if (/bearing/i.test(message))
    return "Check bearing cooling/lubrication and confirm the affected measurement.";
  if (/vibration/i.test(message))
    return "Review vibration trend and inspect bearing, alignment and mounting condition.";
  if (/filter/i.test(message))
    return "Review filter differential pressure and filter condition.";
  if (/bypass|recycle/i.test(message))
    return "Review recycle/bypass demand and controller operating point.";
  if (/flow|baseline|degrad/i.test(message))
    return "Confirm the operating point is comparable, then investigate sustained performance loss.";
  if (/pressure rise|blower dP|capacity/i.test(message))
    return "Review the blower operating point, restrictions and control response.";
  return "Review the current operating condition and supporting trends.";
}

export function BlowerHealthPanel({ latest }: { latest: Reading }) {
  const v = latest.values;
  const active = String(v.activeBlower ?? "—");
  const alerts = [...latest.alerts].sort((a, b) => {
    const rank = { trip: 3, alarm: 2, advisory: 1, ok: 0 };
    return rank[b.severity] - rank[a.severity];
  });
  const thrust =
    typeof v.thrustProxyPct === "number" && Number.isFinite(v.thrustProxyPct)
      ? Number(v.thrustProxyPct)
      : null;
  const degradation =
    typeof v.performanceDegradationPct === "number" &&
    Number.isFinite(v.performanceDegradationPct)
      ? Number(v.performanceDegradationPct)
      : null;

  return (
    <section className={`blower-health-panel ${latest.state}`} aria-label="System health">
      <div className="blower-health-head">
        <div>
          <div className="blower-health-kicker">System health</div>
          <h2>{stateTitle(latest.state)}</h2>
        </div>
        <div className="blower-active-train">Active: Train {active}</div>
      </div>

      <div className="blower-health-summary">
        {alerts.length === 0 ? (
          <div className="health-condition normal">
            <strong>NORMAL:</strong> No configured engineering condition is exceeded.
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div className={`health-condition ${alert.severity}`} key={i}>
              <div>
                <strong>{severityLabel(alert)}:</strong> {alert.message}
              </div>
              <div className="health-action">{recommendedAction(alert.message)}</div>
            </div>
          ))
        )}
      </div>

      <div className="blower-health-facts">
        <span>
          Bearing <strong>{formatNumber(v.maxBearingTempC, 1)} °C</strong>
        </span>
        <span>
          Vibration <strong>{formatNumber(v.maxVibrationMms, 2)} mm/s</strong>
        </span>
        <span>
          Performance{" "}
          <strong>
            {degradation === null ? "N/A" : `${formatNumber(degradation, 1)}% degradation`}
          </strong>
        </span>
        <span>
          Operating deviation{" "}
          <strong>
            {thrust === null ? "N/A" : `${formatNumber(thrust, 1)}%`}
          </strong>
        </span>
      </div>

      {latest.quality.length > 0 && (
        <details className="blower-quality-details">
          <summary>Data quality and unavailable measurements</summary>
          <ul>
            {latest.quality.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
