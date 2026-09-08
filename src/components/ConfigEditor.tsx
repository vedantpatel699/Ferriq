import { labelFor } from "../lib/format";
export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ConfigValue }
  | ConfigValue[];
export function ConfigEditor({
  value,
  onChange,
  path = "Configuration",
}: {
  value: ConfigValue;
  onChange: (v: ConfigValue) => void;
  path?: string;
}) {
  if (value === null) return <span>Not set</span>;
  if (typeof value === "object")
    return (
      <div className="config-fields">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            {typeof v === "object" && v !== null ? (
              <details>
                <summary>{labelFor(k)}</summary>
                <ConfigEditor
                  value={v}
                  path={`${path} ${labelFor(k)}`}
                  onChange={(next) =>
                    onChange(
                      Array.isArray(value)
                        ? value.map((x, i) => (i === Number(k) ? next : x))
                        : { ...value, [k]: next },
                    )
                  }
                />
              </details>
            ) : (
              <label className="editor-field">
                <span>{labelFor(k)}</span>
                <ConfigEditor
                  value={v}
                  path={`${path} ${labelFor(k)}`}
                  onChange={(next) =>
                    onChange(
                      Array.isArray(value)
                        ? value.map((x, i) => (i === Number(k) ? next : x))
                        : { ...value, [k]: next },
                    )
                  }
                />
              </label>
            )}
          </div>
        ))}
      </div>
    );
  return typeof value === "boolean" ? (
    <input
      aria-label={path}
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
    />
  ) : (
    <input
      aria-label={path}
      type={typeof value === "number" ? "number" : "text"}
      step="any"
      value={value}
      onChange={(e) => {
        if (typeof value === "number") {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        } else onChange(e.target.value);
      }}
    />
  );
}
