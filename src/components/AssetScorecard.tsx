import { useState } from "react";
import type { Metric, Reading } from "../engineering/catalog";
import { formatNumber } from "../lib/format";
export function AssetScorecard({
  metrics,
  latest,
  windowRows,
  selected,
  onSelect,
}: {
  metrics: Metric[];
  latest: Reading;
  windowRows: Reading[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [all, setAll] = useState(false);
  const rows = metrics.map((m) => {
    const raw = latest.values[m.key],
      value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const samples = windowRows
      .map((r) => r.values[m.key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const average = samples.length
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : null;
    const crossed = (m.limits ?? [])
      .filter((l) => value !== null && value >= l.value)
      .at(-1);
    const fallback =
      (m.key === "efficiencyHeadlinePct" &&
        String(latest.values.efficiencyMethodUsed).includes("fallback")) ||
      (m.key === "t1CUsed" && latest.values.t1Source !== "measured");
    return {
      m,
      value,
      average,
      state:
        value === null
          ? "Missing"
          : crossed
            ? crossed.name
            : "Within reference",
      fallback,
      flagged: value === null || !!crossed || fallback,
    };
  });
  const shown = all ? rows : rows.filter((r) => r.flagged);
  return (
    <section className="card card-body" aria-label="Asset health scorecard">
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
      <p className="source-note">
        {rows.filter((r) => r.flagged).length} flagged metrics ·{" "}
        {rows.filter((r) => !r.flagged).length} other metrics. Quality markers
        belong to each metric. No numerical health score is configured.
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Asset health metrics"
      >
        <table>
          <caption>Latest reading and selected-window average</caption>
          <thead>
            <tr>
              {[
                "Metric",
                "Latest",
                "Window avg",
                "Limit / reference",
                "Delta to reference",
                "State / quality",
              ].map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ m, value, average, state, fallback }) => {
              const limit = m.limits?.[0]?.value ?? m.reference;
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
                  </th>
                  <td>
                    {formatNumber(value, 2)} {m.unit}
                  </td>
                  <td>
                    {formatNumber(average, 2)} {m.unit}
                  </td>
                  <td>
                    {limit === undefined
                      ? "Not configured"
                      : formatNumber(limit, 2) + " " + m.unit}
                  </td>
                  <td>
                    {value === null || limit === undefined
                      ? "—"
                      : formatNumber(value - limit, 2) +
                        " " +
                        (m.unit === "%" ? "pp" : m.unit)}
                  </td>
                  <td>
                    {state}
                    {fallback ? " · Fallback used" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
