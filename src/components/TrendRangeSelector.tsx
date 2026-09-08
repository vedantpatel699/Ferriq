import { useState } from "react";
import type { TimeRangeId } from "../engineering/types";
import { DateTime } from "luxon";
export function TrendRangeSelector({
  value,
  onChange,
  includeCustom = true,
  contextLabel,
  onApplyCustom,
}: {
  value: TimeRangeId;
  onChange: (id: TimeRangeId) => void;
  includeCustom?: boolean;
  contextLabel?: string;
  onApplyCustom?: (s: string, e: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="range-block">
      <div className="range-caption">Trend window</div>
      <div
        className="range-seg"
        role="group"
        aria-label="Trend observation window"
      >
        {(
          [
            "shift",
            "24h",
            "7d",
            ...(includeCustom ? ["custom"] : []),
          ] as TimeRangeId[]
        ).map((id) => (
          <button
            type="button"
            className={`range-opt${value === id ? " active" : ""}`}
            aria-pressed={value === id}
            aria-expanded={id === "custom" ? open : undefined}
            key={id}
            onClick={() => {
              if (id === "custom") setOpen(!open);
              else {
                onChange(id);
                setOpen(false);
              }
            }}
          >
            {{ shift: "Shift", "24h": "24H", "7d": "7D", custom: "Custom" }[id]}
          </button>
        ))}
      </div>
      {contextLabel && <p className="range-context">{contextLabel}</p>}
      {open && (
        <form
          className="custom-panel"
          onSubmit={(e) => {
            e.preventDefault();
            const s = DateTime.fromISO(start, { zone: "America/Edmonton" }),
              t = DateTime.fromISO(end, { zone: "America/Edmonton" });
            if (!s.isValid || !t.isValid || s >= t) {
              setError("Enter a valid start before the end (Edmonton time).");
              return;
            }
            onApplyCustom?.(start, end);
            onChange("custom");
            setError("");
            setOpen(false);
          }}
        >
          <label>
            Start (Edmonton)
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            End (Edmonton)
            <input
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button>Apply</button>
        </form>
      )}
    </div>
  );
}
