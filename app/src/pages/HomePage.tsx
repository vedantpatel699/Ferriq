import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendRangeSelector } from "../components/TrendRangeSelector";
import { StatusBadge } from "../components/StatusBadge";
import { EQUIPMENT_REGISTRY } from "../lib/equipmentRegistry";
import type { TimeRangeId } from "../engineering/types";

// Illustrative summary numbers for the equipment grid and watchlist, until
// each equipment page's real engineering module is wired into a shared
// cross-equipment summary feed. Structure (fields, semantics) matches what
// the real feed will provide.
const EQUIPMENT_SUMMARY: Record<string, { value: string; unit: string; label: string; refLabel: string; refVal: string; deviation: string; byRange: Record<TimeRangeId, string>; semantic: string; freshness: string }> = {
  "air-blower": { value: "76.2", unit: "%", label: "Polytropic efficiency", refLabel: "rolling baseline", refVal: "78.6%", deviation: "−2.4 pp", byRange: { shift: "−0.2 pp", "24h": "−0.4 pp", "7d": "−1.1 pp", custom: "—" }, semantic: "Worsening", freshness: "Updated 2 min ago" },
  "fired-heater": { value: "84.7", unit: "%", label: "Indirect efficiency", refLabel: "design", refVal: "85.0%", deviation: "−0.3 pp", byRange: { shift: "0.0 pp", "24h": "0.0 pp", "7d": "−0.1 pp", custom: "—" }, semantic: "Stable", freshness: "Updated 3 min ago" },
  "shell-tube-exchanger": { value: "9.7×10⁻⁴", unit: "m²·K/W", label: "Fouling factor (Rf)", refLabel: "commissioning baseline", refVal: "0×10⁻⁴", deviation: "above baseline", byRange: { shift: "+0.3%", "24h": "+1%", "7d": "+3%", custom: "—" }, semantic: "Increasing", freshness: "Updated 2 min ago" },
  "membrane-analyzer": { value: "84.1", unit: "%", label: "H₂ recovery", refLabel: "design", refVal: "90.0%", deviation: "−5.9 pp", byRange: { shift: "−0.1 pp", "24h": "−0.1 pp", "7d": "−0.3 pp", custom: "—" }, semantic: "Stable", freshness: "Updated 1 min ago" },
  "furnace-skin-temp": { value: "437", unit: "°C", label: "Current skin TI", refLabel: "advisory", refVal: "460°C", deviation: "−23°C margin", byRange: { shift: "—", "24h": "—", "7d": "—", custom: "—" }, semantic: "Stable", freshness: "Updated 30 sec ago" },
};

export function HomePage() {
  const [range, setRange] = useState<TimeRangeId>("24h");
  const watchItems = EQUIPMENT_REGISTRY.filter((e) => e.state !== "normal");
  const now = new Date();

  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">Engineering overview</div>
          <div className="meta-line">
            {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · Last refresh "}
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="review-headline">
            {watchItems.length > 0 ? `${watchItems.length} items require engineering review` : "No engineering follow-up currently flagged"}
          </div>
          <div className="review-sub">All monitored inputs current</div>
        </div>
        <TrendRangeSelector value={range} onChange={setRange} includeCustom={false} />
      </div>

      {watchItems.length > 0 && (
        <div className="watchlist">
          <h2 className="section-heading">Watchlist</h2>
          <p className="section-sub" title="Ranked by deviation magnitude, rate of change, and persistence — not a single fixed formula.">
            Ordered by engineering priority.
          </p>
          <div className="watch-grid watch-head">
            <div>Asset</div><div>Condition</div><div>Current / reference</div><div>Change ({range})</div><div className="watch-duration">Condition duration</div>
          </div>
          {watchItems.map((eq) => {
            const s = EQUIPMENT_SUMMARY[eq.id];
            return (
              <Link className="watch-item watch-grid" to={eq.path} key={eq.id}>
                <div>
                  <div className="watch-asset-name">{eq.name}</div>
                  <div className="watch-asset-tag">{eq.tag}</div>
                </div>
                <div className="watch-condition">{s.label} below {s.refLabel}</div>
                <div>
                  <div className="watch-current">{s.value}{s.unit}</div>
                  <div className="watch-ref">{s.refVal} {s.refLabel} ({s.deviation})</div>
                </div>
                <div>
                  <div className="watch-delta">{s.byRange[range]}</div>
                  <div className="watch-semantic">{s.semantic}</div>
                </div>
                <div className="watch-duration">—</div>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="section-heading">Equipment</h2>
      <div className="equipment-grid">
        {EQUIPMENT_REGISTRY.map((eq) => {
          const s = EQUIPMENT_SUMMARY[eq.id];
          return (
            <Link className="eq-card" to={eq.path} key={eq.id}>
              <div className="eq-top">
                <div className="eq-id">
                  <span className="eq-name">{eq.name}</span>
                  <span className="eq-tag">{eq.tag}</span>
                </div>
                <StatusBadge state={eq.state} />
              </div>
              <div>
                <div className="kpi-row"><span className="kpi-value">{s.value}</span><span className="kpi-unit">{s.unit}</span></div>
                <div className="kpi-label">{s.label}</div>
              </div>
              <div className="eq-facts">
                <div className="eq-fact"><strong>{s.deviation}</strong> vs {s.refLabel}</div>
                <div className="eq-fact">{s.byRange[range]} change this {range} · {s.semantic}</div>
              </div>
              <div className="eq-fresh">{s.freshness}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
