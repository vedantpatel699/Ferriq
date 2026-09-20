import {
  REVENUE_OPEX_LABELS,
  revenueOpexComponents,
  type RevenueOpexComponents,
} from "../engineering/crudeToProfit/opex";
export function OpexConfiguration({
  value,
  components,
  legacy,
  onChange,
}: {
  value?: number;
  components?: RevenueOpexComponents;
  legacy: boolean;
  onChange: (value: RevenueOpexComponents) => void;
}) {
  const allocation = components ?? revenueOpexComponents(value);
  const total = Object.values(allocation).reduce((a, b) => a + b, 0);
  return (
    <section className="advanced-panel" aria-label="Operating costs">
      <h2>Variable operating costs</h2>
      {legacy && value === undefined && components === undefined ? (
        <>
          <p>Your saved itemized costs remain active.</p>
          <button onClick={() => onChange(revenueOpexComponents(undefined))}>
            Replace itemized costs with provisional 8% split
          </button>
        </>
      ) : (
        <>
          {Object.entries(REVENUE_OPEX_LABELS).map(([key, label]) => (
            <label className="editor-field" key={key}>
              {label} (% of sales revenue)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                value={
                  Number.isFinite(
                    allocation[key as keyof RevenueOpexComponents],
                  )
                    ? allocation[key as keyof RevenueOpexComponents]
                    : ""
                }
                onChange={(e) =>
                  onChange({ ...allocation, [key]: e.target.valueAsNumber })
                }
              />
            </label>
          ))}
          <p>
            Total variable-cost allowance:{" "}
            {Number.isFinite(total) ? total : "—"}% of sales revenue.
          </p>
        </>
      )}
      <p>
        Provisional default: 2% each, 8% total. The equal split is a planning
        placeholder, not measured plant costs. Adjust each component separately;
        Low, High and Live use their own sales revenue.
      </p>
      <p>
        Saved single-percentage allowances are split equally without changing
        their total. Component costs replace the combined allowance, so they are
        deducted only once. Crude purchases remain separate.
      </p>
      <p>
        The original 8% benchmark included maintenance and overhead. This
        four-component allocation is unverified and excludes separate
        maintenance, overhead and other costs. Count natural gas used to
        generate steam or power in only one component.
      </p>
    </section>
  );
}
