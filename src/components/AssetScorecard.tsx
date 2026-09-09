import { useState } from "react";
import type { Metric, Reading } from "../engineering/catalog";
import { formatNumber } from "../lib/format";
import { family, metricFacts, windowAverage, healthScore } from "../poc/blower";
export function AssetScorecard({
  metrics,
  latest,
  windowRows,
  selected,
  onSelect,
  baseline,
}: {
  metrics: Metric[];
  latest: Reading;
  windowRows: Reading[];
  selected: string;
  onSelect: (key: string) => void;
  baseline?: Reading[];
}) {
  const [all, setAll] = useState(false);
  const rows = metrics.map((m) => ({
    m,
    ...metricFacts(m, latest),
    average: windowAverage(m, windowRows),
  }));
  const score = healthScore(metrics, windowRows),
    bScore = baseline ? healthScore(metrics, baseline) : null;
  const lastB = baseline?.at(-1);
  const stable = ["Mechanical", "Aerodynamic", "Load"].map((name) => ({
    name,
    rows: rows.filter((r) => family(r.m.key) === name && !r.flagged),
  }));
  return (
    <section
      className="card card-body scorecard"
      aria-label="Asset health scorecard"
    >
      <div className="section-heading-row">
        <h2>Asset health scorecard</h2>
        <div role="group" aria-label="Scorecard metrics">
          <button aria-pressed={!all} onClick={() => setAll(false)}>
            Flagged
          </button>
          <button aria-pressed={all} onClick={() => setAll(true)}>
            All metrics
          </button>
        </div>
      </div>
      <p>
        <strong>{latest.state.replaceAll("-", " ").toUpperCase()}</strong> ·{" "}
        {latest.alerts[0]?.message ??
          (latest.quality.length
            ? (latest.quality.find((q) => /^(Missing|Stale):/.test(q)) ??
              latest.quality[0])
            : "No configured condition is exceeded.")}
      </p>
      <div className="scorecard-context">
        <span>
          {rows.filter((r) => r.quality?.state === "Stale").length} stale ·{" "}
          {rows.filter((r) => r.quality?.state === "Missing").length} missing ·{" "}
          {rows.filter((r) => r.quality?.state === "Fallback").length} fallback
          metrics
        </span>
        <details>
          <summary>
            POC health index A: {formatNumber(score.score, 0)} / 100
            {bScore
              ? ` · B: ${formatNumber(bScore.score, 0)} · Δ ${formatNumber(score.score !== null && bScore.score !== null ? score.score - bScore.score : null, 0)}`
              : ""}
          </summary>
          <p>{score.formula}</p>
          <p>
            Portfolio rubric, not plant-calibrated: each scored vibration,
            bearing temperature, pressure-rise, filter-drop or bypass condition
            deducts 14 advisory / 28 alarm / 45 trip points. Bearing rise over 2
            °C in the selected window deducts 4 points. Missing or stale scored
            inputs make the index unavailable; there is no invented quality
            penalty.
          </p>
          {bScore && <p>Baseline: {bScore.formula}</p>}
        </details>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Asset health metrics"
      >
        <table>
          <caption>
            {baseline
              ? "A current versus B clean-filter baseline"
              : "Latest reading and selected-window average"}
          </caption>
          <thead>
            <tr>
              {(baseline
                ? [
                    "Metric",
                    "A latest",
                    "B latest",
                    "A avg",
                    "B avg",
                    "Δ avg",
                    "Limit / reference",
                    "State change / quality",
                  ]
                : [
                    "Metric",
                    "Latest",
                    "Window avg",
                    "Limit / reference",
                    "Delta to reference",
                    "State / quality",
                  ]
              ).map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => all || r.flagged)
              .map(
                ({ m, value, average, state, quality, severity, reliable }) => {
                  const limit = m.limits?.[0]?.value ?? m.reference,
                    b = lastB ? metricFacts(m, lastB) : null,
                    bAvg = baseline ? windowAverage(m, baseline) : null;
                  const unit = m.unit === "%" ? "pp" : m.unit;
                  return (
                    <tr
                      key={m.key}
                      className={selected === m.key ? "scorecard-selected" : ""}
                    >
                      <th scope="row">
                        <button
                          aria-pressed={selected === m.key}
                          onClick={() => onSelect(m.key)}
                        >
                          {m.label}
                        </button>
                        <small>{family(m.key)}</small>
                      </th>
                      <td className="num">
                        {formatNumber(value, 2)} {m.unit}
                        {quality?.state === "Stale" && (
                          <small>Last reported, held</small>
                        )}
                      </td>
                      {baseline && (
                        <td className="num baseline-cell">
                          {formatNumber(b?.value, 2)} {m.unit}
                        </td>
                      )}
                      <td className="num">
                        {formatNumber(average, 2)} {m.unit}
                      </td>
                      {baseline && (
                        <>
                          <td className="num baseline-cell">
                            {formatNumber(bAvg, 2)} {m.unit}
                          </td>
                          <td className="num">
                            {formatNumber(
                              average !== null && bAvg !== null
                                ? average - bAvg
                                : null,
                              2,
                            )}{" "}
                            {unit}
                          </td>
                        </>
                      )}
                      <td className="num">
                        {limit === undefined
                          ? "Not configured"
                          : formatNumber(limit, 2) + " " + m.unit}
                      </td>
                      {!baseline && (
                        <td className="num">
                          {formatNumber(
                            reliable && limit !== undefined
                              ? value! - limit
                              : null,
                            2,
                          )}{" "}
                          {unit}
                        </td>
                      )}
                      <td>
                        {baseline && b && <span>{b.state} → </span>}
                        <span className={"metric-state severity-" + severity}>
                          {state}
                        </span>
                        {quality && (
                          <span
                            className={
                              "quality-marker quality-" +
                              quality.state.toLowerCase()
                            }
                            title={quality.reason}
                          >
                            {quality.state === "Fallback"
                              ? "ƒ"
                              : quality.state === "Stale"
                                ? "◷"
                                : "⚑"}{" "}
                            {quality.state}
                            {quality.lastFresh
                              ? ` · ${((latest.epoch - Date.parse(quality.lastFresh)) / 3600000).toFixed(1)} h old`
                              : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
          </tbody>
        </table>
      </div>
      {!all && (
        <div className="stable-families">
          {stable.map((f) => (
            <span key={f.name}>
              {f.name}: {f.rows.length} unflagged metrics
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
