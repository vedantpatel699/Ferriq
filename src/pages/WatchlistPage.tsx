import { useState } from "react";
import { Link } from "react-router-dom";
import { EQUIPMENT_REGISTRY } from "../lib/equipmentRegistry";
import { EmptyState } from "../components/EmptyState";
import type { TimeRangeId } from "../engineering/types";

const WATCH_DELTA: Record<string, Record<TimeRangeId, string>> = {
  "shell-tube-exchanger": { shift: "+0.3%", "24h": "+1%", "7d": "+3%", custom: "—" },
  "air-blower": { shift: "−0.2 pp", "24h": "−0.4 pp", "7d": "−1.1 pp", custom: "—" },
  "membrane-analyzer": { shift: "−0.1 pp", "24h": "−0.1 pp", "7d": "−0.3 pp", custom: "—" },
};

/** Condition existence/ranking comes from Ferriq engineering logic, not
 *  from this page's range control. Only a small "change over" selector is
 *  offered here (no Shift/Custom investigation controls) and changing it
 *  never makes an active condition disappear — it only updates the
 *  displayed delta column. */
export function WatchlistPage() {
  const [range, setRange] = useState<Exclude<TimeRangeId, "shift" | "custom">>("24h");
  const watchItems = EQUIPMENT_REGISTRY.filter((e) => e.state !== "normal");

  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">Monitor</div>
          <div className="page-title">Watchlist</div>
          <div className="page-sub">{watchItems.length} items require engineering review, ranked by engineering priority</div>
        </div>
        <div className="range-block">
          <div className="range-caption">Change over</div>
          <div className="range-seg">
            <button type="button" className={`range-opt${range === "24h" ? " active" : ""}`} onClick={() => setRange("24h")}>24H</button>
            <button type="button" className={`range-opt${range === "7d" ? " active" : ""}`} onClick={() => setRange("7d")}>7D</button>
          </div>
        </div>
      </div>

      <p className="section-sub" title="Ranked by deviation magnitude, rate of change, and persistence — not a single fixed formula.">
        Ordered by engineering priority, not raw alarm count.
      </p>

      {watchItems.length === 0 ? (
        <EmptyState title="No engineering follow-up currently flagged" detail="All monitored inputs current." />
      ) : (
        <>
          <div className="watch-grid watch-head">
            <div>Asset</div><div>Condition</div><div>Current / reference</div><div>Change ({range})</div><div className="watch-duration">Condition duration</div>
          </div>
          {watchItems.map((eq) => (
            <Link className="watch-item watch-grid" to={eq.path} key={eq.id}>
              <div>
                <div className="watch-asset-name">{eq.name}</div>
                <div className="watch-asset-tag">{eq.tag}</div>
              </div>
              <div className="watch-condition">Engineering review flagged</div>
              <div><div className="watch-current">—</div></div>
              <div><div className="watch-delta">{WATCH_DELTA[eq.id]?.[range] ?? "—"}</div></div>
              <div className="watch-duration">—</div>
            </Link>
          ))}
        </>
      )}
    </>
  );
}
