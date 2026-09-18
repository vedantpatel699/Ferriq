import {
  DEFAULT_OPEX,
  OPEX_ITEMS,
  type OperatingCosts,
  type OpexKey,
  type OpexItem,
} from "../engineering/crudeToProfit/opex";

export function OpexConfiguration({
  value,
  onChange,
}: {
  value?: OperatingCosts;
  onChange: (v: OperatingCosts) => void;
}) {
  const config = value ?? DEFAULT_OPEX;
  const update = (key: OpexKey, patch: Partial<OpexItem>) =>
    onChange({ ...config, [key]: { ...config[key], ...patch } });
  return (
    <details className="advanced-panel">
      <summary>Operating costs</summary>
      <p>
        CAD, plant total. Enter net purchased consumption once. Annual budgets
        stay fixed; consumption per m³ scales with crude feed. Hourly
        consumption applies for 7,920 operating hours/year.
      </p>
      {(Object.keys(OPEX_ITEMS) as OpexKey[]).map((key) => {
        const { label, unit } = OPEX_ITEMS[key],
          item = config[key];
        const input = (
          field: "consumption" | "rate" | "annualCad",
          text: string,
        ) => (
          <label className="editor-field">
            {text}
            <input
              type="number"
              min="0"
              step="any"
              aria-label={`${label} ${text}`}
              value={Number.isFinite(item[field]) ? item[field] : ""}
              onChange={(e) => update(key, { [field]: e.target.valueAsNumber })}
            />
          </label>
        );
        return (
          <fieldset key={key}>
            <legend>{label}</legend>
            <div className="context-grid">
              <label className="editor-field">
                Basis
                <select
                  aria-label={`${label} cost basis`}
                  value={item.basis}
                  onChange={(e) =>
                    update(key, { basis: e.target.value as OpexItem["basis"] })
                  }
                >
                  <option value="annual">Fixed annual budget</option>
                  {key !== "maintenance" && (
                    <option value="hourly">
                      Consumption per operating hour
                    </option>
                  )}
                  <option value="throughput">Variable with crude feed</option>
                </select>
              </label>
              {item.basis === "annual" ? (
                input("annualCad", "Budget (CAD/year)")
              ) : (
                <>
                  {key !== "maintenance" &&
                    input(
                      "consumption",
                      `Consumption (${unit}/${item.basis === "hourly" ? "h" : "m³ feed"})`,
                    )}
                  {input("rate", `Rate (CAD/${unit})`)}
                </>
              )}
            </div>
          </fieldset>
        );
      })}
      <p>
        Only the selected basis is charged for each category. Utility and
        chemical rates use the stated units; natural gas consumption and price
        must use the same heating-value basis. Technology changes do not
        automatically estimate utility demand. Review these assumptions after
        changing routing. Internal fuel gas, steam generation and equipment
        energy are not charged separately by this model.
      </p>
    </details>
  );
}
