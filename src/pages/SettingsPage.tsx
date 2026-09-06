import { useState } from "react";
import { DEFAULT_FERRIQ_SETTINGS, getFerriqSettings, saveFerriqSettings, resetFerriqSettings, type FerriqSettings } from "../lib/settingsStore";
import { SITE_TIMEZONE } from "../lib/timeRange";

/** Only settings that affect real engineering behavior are exposed here —
 *  shift boundaries, which drive the Shift time-range calculation
 *  everywhere in the app. UI-only knobs (decimal precision, line
 *  thickness, gridlines, a theme switch) are deliberately not modeled:
 *  Ferriq is light-theme only, and metric precision is defined per
 *  engineering quantity in each equipment module, not globally. */
export function SettingsPage() {
  const [draft, setDraft] = useState<FerriqSettings>(getFerriqSettings());
  const [savedNote, setSavedNote] = useState<string | null>(null);

  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">System</div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Site timezone and shift boundaries used by the Shift trend-range control</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Site &amp; shift configuration</div>
        <div className="card-body">
          <div className="config-row">
            <label htmlFor="site-timezone">Site timezone</label>
            <span id="site-timezone">{SITE_TIMEZONE}</span>
          </div>
          <div className="config-row">
            <label htmlFor="shift-start">Day-shift start (hour, 0–23)</label>
            <input
              id="shift-start"
              type="number" className="config-input" min={0} max={23} value={draft.shiftStartHour}
              onChange={(e) => setDraft((d) => ({ ...d, shiftStartHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
            />
          </div>
          <div className="config-row">
            <label htmlFor="shift-end">Day-shift end (hour, 0–23)</label>
            <input
              id="shift-end"
              type="number" className="config-input" min={0} max={23} value={draft.shiftEndHour}
              onChange={(e) => setDraft((d) => ({ ...d, shiftEndHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
            />
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button
          type="button" className="btn"
          onClick={() => { saveFerriqSettings(draft); setSavedNote("Saved."); setTimeout(() => setSavedNote(null), 2000); }}
        >
          Save Changes
        </button>
        <button
          type="button" className="btn btn-outline"
          onClick={() => { resetFerriqSettings(); setDraft(DEFAULT_FERRIQ_SETTINGS); setSavedNote("Reset to defaults."); setTimeout(() => setSavedNote(null), 2000); }}
        >
          Reset to Defaults
        </button>
        {savedNote && <span style={{ alignSelf: "center", fontSize: 13, color: "var(--text-secondary)" }}>{savedNote}</span>}
      </div>
    </>
  );
}
