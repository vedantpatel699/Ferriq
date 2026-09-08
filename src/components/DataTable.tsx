import { useState } from "react";
import { formatNumber, labelFor } from "../lib/format";
export function DataTable({
  rows,
  caption,
  columns,
}: {
  rows: Record<string, unknown>[];
  caption: string;
  columns?: string[];
}) {
  const [page, setPage] = useState(0);
  const keys = columns ?? [...new Set(rows.flatMap(Object.keys))];
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const current = Math.min(page, pages - 1);
  return (
    <div className="data-view">
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="data">
          <caption>
            {caption} · {rows.length} rows
          </caption>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} scope="col">
                  {labelFor(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 50, current * 50 + 50).map((r, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} className={typeof r[k]==="number"?"num":undefined}>
                    {typeof r[k] === "number"
                      ? formatNumber(r[k], 4)
                      : typeof r[k] === "object" && r[k] !== null
                        ? JSON.stringify(r[k])
                        : String(r[k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="action-bar">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous rows
          </button>
          <span>
            Page {current + 1} of {pages}
          </span>
          <button
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next rows
          </button>
        </div>
      )}
    </div>
  );
}
