import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import { useSummaries } from "../lib/summaries";
import { formatNumber } from "../lib/format";
import { stateLabel } from "../lib/equipmentRegistry";
export function SummaryList({
  watchOnly = false,
  predictorsOnly = false,
}: {
  watchOnly?: boolean;
  predictorsOnly?: boolean;
}) {
  const items = useSummaries()
    .filter(
      (e) =>
        (!watchOnly || e.priority > 0) &&
        (!predictorsOnly || e.id === "furnace-skin-temp"),
    )
    .sort((a, b) => b.priority - a.priority);
  return (
    <>
      {items.length === 0 && (
        <p>No conditions requiring review in the loaded data.</p>
      )}
      <div className="summary-grid">
        {items.map((e) => (
          <article className="card card-body" key={e.id}>
            <div className="section-heading-row">
              <h2>
                <Link to={e.path}>{e.name}</Link>
              </h2>
              <span className={"state-pill " + e.state}>
                {stateLabel(e.state)}
              </span>
            </div>
            <p>{e.tag}</p>
            <p className="metric-value">
              {formatNumber(e.value, e.metric.digits ?? 2)}{" "}
              <small>{e.metric.unit}</small>
            </p>
            <p>{e.metric.label}</p>
            <p>{e.condition}</p>
            {e.metric.reference !== undefined && (
              <p>
                {e.metric.referenceLabel}: {formatNumber(e.metric.reference, 2)}{" "}
                {e.metric.unit}
              </p>
            )}
            <p>{e.duration}</p>
            <p className="source-note">
              Observation:{" "}
              {DateTime.fromMillis(e.asOf, {
                zone: "America/Edmonton",
              }).toFormat("LLL d, yyyy HH:mm")}{" "}
              Edmonton
            </p>
            {e.quality.map((q) => (
              <p className="quality-note" key={q}>
                {q}
              </p>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
