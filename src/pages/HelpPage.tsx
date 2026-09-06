/** Content audited against the actual application — no references to
 *  features that don't exist. Each card here corresponds to a real,
 *  working page. */
const CARDS: { title: string; body: string }[] = [
  { title: "Home", body: "Engineering overview: a watchlist of equipment flagged for review, and the full equipment grid with current key metrics." },
  { title: "Watchlist", body: "Standalone view of every equipment condition currently flagged for engineering review, ranked by deviation magnitude, rate of change, and persistence — not raw alarm count." },
  { title: "Equipment dashboards", body: "Air Blower, Fired Heater, Shell & Tube Exchanger, and Membrane Analyzer each show current key metrics, a trend chart, calculation inputs, and mechanical health where applicable. Every dashboard's formulas and standards references are behind its \"Calculation basis & references\" link." },
  { title: "Furnace Skin TI Predictor", body: "A trained forecasting model projects tube skin temperature forward and reports time-to-alarm-threshold, distinct from the engineering-state summary shown elsewhere in the app." },
  { title: "Crude to Profit", body: "Refinery yield and margin model: adjust the crude blend and the residue/gas-oil conversion units to see the resulting product slate and margin." },
  { title: "Trend windows", body: "Shift / 24H / 7D / Custom controls actually change the underlying queried data and period-over-period comparisons, not just a highlighted pill." },
];

export function HelpPage() {
  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">System</div>
          <div className="page-title">Help</div>
          <div className="page-sub">What each page in Ferriq actually does</div>
        </div>
      </div>
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {CARDS.map((c) => (
          <div className="metric-card" key={c.title}>
            <div className="metric-label" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{c.title}</div>
            <div className="metric-fact">{c.body}</div>
          </div>
        ))}
      </div>
    </>
  );
}
