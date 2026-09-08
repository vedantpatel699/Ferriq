import { useState } from "react";
import { useResource, useWorkspace } from "../lib/WorkspaceContext";
import type { FerriqSettings } from "../lib/settingsStore";
export function SettingsPage() {
  const { data, version } = useResource<FerriqSettings>("settings"),
    { save, reset, published } = useWorkspace();
  const [draft, setDraft] = useState(data),
    [note, setNote] = useState(""),
    [draftVersion, setDraftVersion] = useState(version);
  async function apply(revert = false) {
    try {
      if (revert) {
        await reset("settings");
        setDraftVersion(1);
        setDraft(
          published.find((r) => r.key === "settings")!.data as FerriqSettings,
        );
      } else {
        await save("settings", draft, "settings", draftVersion);
        setDraftVersion(draftVersion + 1);
      }
      setNote(
        revert
          ? "Restored published shift settings."
          : "Shift settings saved in this browser.",
      );
    } catch (e) {
      setNote((e as Error).message);
    }
  }
  return (
    <>
      <h1>Settings</h1>
      <p>
        Site timezone: America/Edmonton. Shift windows use the dataset
        observation date. Saved settings apply to every equipment page in this
        browser.
      </p>
      <form
        className="card card-body"
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
        {(["shiftStartHour", "shiftEndHour"] as const).map((key, i) => (
          <label className="editor-field" key={key}>
            {i ? "Day-shift end (hour)" : "Day-shift start (hour)"}
            <input
              required
              type="number"
              min="0"
              max="23"
              step="1"
              value={draft[key]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [key]: e.target.valueAsNumber }))
              }
            />
          </label>
        ))}
        <p>Start must precede end; the remaining hours form the night shift.</p>
        <div className="action-bar">
          <button type="submit">Save Changes</button>
          <button type="button" onClick={() => void apply(true)}>
            Reset to Defaults
          </button>
        </div>
      </form>
      {note && <p role="status">{note}</p>}
    </>
  );
}
