import { useState } from "react";
import type { TimeRangeId } from "../engineering/types";
import { TIME_RANGE_LABELS } from "../lib/timeRange";

export interface TrendRangeSelectorProps {
  value: TimeRangeId;
  onChange: (id: TimeRangeId) => void;
  /** Detailed equipment dashboards get Shift/24H/7D/Custom; Home and
   *  Watchlist intentionally omit Custom (no advanced investigation
   *  controls on the surveillance-oriented pages). */
  includeCustom?: boolean;
  contextLabel?: string;
  onApplyCustom?: (start: string, end: string) => void;
  customStart?: string;
  customEnd?: string;
}

/** Shift / 24H / 7D / Custom control. Changing the value must actually
 *  drive chart data and period deltas in the caller — this component only
 *  owns the pill UI and the custom-range popover form. */
export function TrendRangeSelector({
  value, onChange, includeCustom = true, contextLabel, onApplyCustom, customStart, customEnd,
}: TrendRangeSelectorProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [startDraft, setStartDraft] = useState(customStart ?? "");
  const [endDraft, setEndDraft] = useState(customEnd ?? "");

  const ids: TimeRangeId[] = includeCustom ? ["shift", "24h", "7d", "custom"] : ["shift", "24h", "7d"];

  return (
    <div className="range-block">
      <div className="range-caption">Trend window</div>
      <div className="range-seg" role="group" aria-label="Trend observation window">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            className={`range-opt${value === id ? " active" : ""}`}
            onClick={() => {
              if (id === "custom") setCustomOpen((o) => !o);
              else { onChange(id); setCustomOpen(false); }
            }}
          >
            {TIME_RANGE_LABELS[id]}
          </button>
        ))}
      </div>
      {contextLabel && <div className="range-context">{contextLabel}</div>}
      {customOpen && (
        <div className="custom-panel">
          <div className="custom-row">
            <label htmlFor="custom-start">Start</label>
            <div className="custom-inputs">
              <input id="custom-start" type="datetime-local" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} />
            </div>
          </div>
          <div className="custom-row">
            <label htmlFor="custom-end">End</label>
            <div className="custom-inputs">
              <input id="custom-end" type="datetime-local" value={endDraft} onChange={(e) => setEndDraft(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="custom-apply"
            onClick={() => {
              if (!startDraft || !endDraft) return;
              onApplyCustom?.(startDraft, endDraft);
              onChange("custom");
              setCustomOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
