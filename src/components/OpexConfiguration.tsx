import { DEFAULT_OPEX_REVENUE_PERCENT } from "../engineering/crudeToProfit/opex";
export function OpexConfiguration({
  value,
  legacy,
  onChange,
}: {
  value?: number;
  legacy: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <section className="advanced-panel" aria-label="Operating costs">
      <h2>Operating costs</h2>
      {legacy && value === undefined ? (
        <>
          <p>Your saved itemized costs remain active.</p>
          <button onClick={() => onChange(DEFAULT_OPEX_REVENUE_PERCENT)}>
            Use 8% of revenue instead
          </button>
        </>
      ) : (
        <label className="editor-field">
          OPEX (% of sales revenue)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            required
            value={
              value === undefined
                ? DEFAULT_OPEX_REVENUE_PERCENT
                : Number.isFinite(value)
                  ? value
                  : ""
            }
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
        </label>
      )}
      <p>
        Default: 8% of sales revenue, applied separately to Low, High and Live.
        One total allowance for operating costs, including utilities, chemicals,
        maintenance and overhead. Crude purchases are deducted separately.
      </p>
      <p>
        Planning assumption based on{" "}
        <a
          href="https://www.sec.gov/Archives/edgar/data/311337/000110465926020411/su-20251231xex99d3.htm"
          target="_blank"
          rel="noreferrer"
        >
          Suncor’s 2025 refining and marketing results
        </a>
        . Actual costs depend on the site and do not necessarily move with
        selling prices.
      </p>
    </section>
  );
}
