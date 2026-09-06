export interface MetricFact {
  bold?: string;
  rest: string;
}

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  emphasis?: boolean;
  state?: "normal" | "watch" | "investigate" | "data-issue";
  facts?: MetricFact[];
  method?: string;
}

/** One "key metric" tile — identity, current value + unit, and up to two
 *  facts (reference/deviation, period change). Formulas and standards
 *  citations belong in CalculationBasisDialog, not here. */
export function MetricCard({ label, value, unit, emphasis, state, facts, method }: MetricCardProps) {
  return (
    <div className={`metric-card${emphasis ? " emphasis" : ""}`}>
      <div className="metric-top">
        <div className="metric-label">{label}</div>
        {state && <span className={`state-pill ${state}`}>{state.toUpperCase().replace("-", " ")}</span>}
      </div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {facts && facts.length > 0 && (
        <div className="metric-facts">
          {facts.map((f, i) => (
            <div className="metric-fact" key={i}>
              {f.bold && <strong>{f.bold}</strong>}
              {f.rest}
            </div>
          ))}
        </div>
      )}
      {method && <div className="metric-method">{method}</div>}
    </div>
  );
}
