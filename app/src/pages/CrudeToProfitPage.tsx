import { useMemo, useState } from "react";
import { CalculationBasisDialog } from "../components/CalculationBasisDialog";
import { MetricCard } from "../components/MetricCard";
import {
  CRUDES, PRODUCTS, DEFAULT_CRUDE_FLOWS_M3HR, DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  RESIDUE_UNIT_LABELS, GAS_OIL_UNIT_LABELS, type ResidueUnit, type GasOilUnit, type CrudeCode,
} from "../engineering/crudeToProfit/data";
import { runModel } from "../engineering/crudeToProfit/calculations";

const PRODUCT_LABEL: Record<string, string> = {
  lpg: "LPG", naphtha: "Naphtha", swing_naphtha: "Swing naphtha", kerosene: "Kerosene",
  diesel: "Diesel", swing_diesel: "Swing diesel", uco: "UCO",
};

/** All tabs (crude blend, residue/gas-oil unit selection, product slate,
 *  economics) drive off the same live runModel() call — nothing here is
 *  a static mockup. The "market" price case (live EIA/WCS-derived
 *  pricing) is not wired yet; only the validated fixed low/high cases
 *  from the original workbook are shown, which is what the model ties
 *  out on and needs no network. */
export function CrudeToProfitPage() {
  const [flows, setFlows] = useState<Record<CrudeCode, number>>({ ...DEFAULT_CRUDE_FLOWS_M3HR });
  const [residueUnit, setResidueUnit] = useState<ResidueUnit>("lc_finer");
  const [gasOilUnit, setGasOilUnit] = useState<GasOilUnit>("hydrocracker");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const result = useMemo(
    () => runModel(flows, DEFAULT_CRUDE_TO_PROFIT_CONFIG, null, null, residueUnit, gasOilUnit),
    [flows, residueUnit, gasOilUnit],
  );

  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">Economics</div>
          <div className="page-title">Crude to Profit</div>
          <div className="page-sub">Refinery yield &amp; margin model — crude blend through finished product slate</div>
        </div>
      </div>

      <div className="section-heading-row">
        <h2 className="section-heading">Crude blend (m³/hr)</h2>
        <button type="button" className="calc-basis-link" onClick={() => setDrawerOpen(true)}>Calculation basis &amp; references</button>
      </div>
      <div className="context-grid">
        {CRUDES.map((c) => (
          <div className="context-item" key={c}>
            <label className="context-label" htmlFor={`crude-flow-${c}`}>{c}</label>
            <input
              id={`crude-flow-${c}`} aria-label={`${c} crude flow, m3 per hour`}
              type="number" className="config-input" style={{ width: "100%" }}
              value={flows[c]} min={0} step={1}
              onChange={(e) => setFlows((f) => ({ ...f, [c]: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        ))}
      </div>

      <h2 className="section-heading">Conversion units</h2>
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="metric-card">
          <label className="metric-label" htmlFor="residue-unit">Residue conversion unit</label>
          <select id="residue-unit" className="config-input" style={{ width: "100%", marginTop: 8 }} value={residueUnit} onChange={(e) => setResidueUnit(e.target.value as ResidueUnit)}>
            {Object.entries(RESIDUE_UNIT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="metric-card">
          <label className="metric-label" htmlFor="gas-oil-unit">Gas-oil conversion unit</label>
          <select id="gas-oil-unit" className="config-input" style={{ width: "100%", marginTop: 8 }} value={gasOilUnit} onChange={(e) => setGasOilUnit(e.target.value as GasOilUnit)}>
            {Object.entries(GAS_OIL_UNIT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>

      <h2 className="section-heading">Product slate</h2>
      <table className="data" style={{ marginBottom: 32 }}>
        <thead><tr><th>Product</th><th className="num">m³/hr</th></tr></thead>
        <tbody>
          {PRODUCTS.map((p) => (
            <tr key={p}><td>{PRODUCT_LABEL[p]}</td><td className="num">{result.product_slate_m3hr[p].toFixed(1)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="section-heading">Economics</h2>
      <div className="metrics-grid">
        <MetricCard label="Crude cost (low case)" value={result.economics.crude_cost_low_cad_hr.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="C$/hr" />
        <MetricCard label="Revenue (low case)" value={result.economics.revenue_low_cad_hr.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="C$/hr" />
        <MetricCard label="Margin (low case)" value={result.economics.margin_low_cad_hr.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="C$/hr" emphasis facts={[{ bold: result.economics.margin_low_mcad_yr.toFixed(1), rest: " MC$/yr" }]} />
        <MetricCard label="Margin (high case)" value={result.economics.margin_high_cad_hr.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="C$/hr" facts={[{ bold: result.economics.margin_high_mcad_yr.toFixed(1), rest: " MC$/yr" }]} />
      </div>

      <div className="callout assumption">
        <strong>Calculation assumption.</strong> Low/high cases use the fixed price assumptions this model ties out on (no network required). The live market-price case (today's EIA/WCS-derived pricing) is not yet wired into this page.
      </div>

      <CalculationBasisDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={[
          { heading: "Model pipeline", paragraphs: [
            "Crude blend → primary distillation split → residue conversion (LC Finer or delayed coker) → SimDist re-split → gas-oil conversion (hydrocracker/hydrotreater or FCC) → final product slate → economics.",
          ] },
          { heading: "Residue conversion", paragraphs: [
            "LC Finer uses the workbook's own measured yield table. Delayed coker uses published carbon-residue correlations: gas = 7.80 + 0.144·CCR, naphtha = 11.29 + 0.343·CCR, coke = 1.60·CCR, gas oil = remainder.",
          ] },
          { heading: "Gas-oil conversion", paragraphs: [
            "Hydrocracking adds hydrogen and favours middle distillate. Catalytic cracking (FCC) rejects carbon and favours gasoline-range material — assumes a hydrotreated feed (not modelled as a separate unit here).",
          ] },
          { heading: "Economics", paragraphs: [
            "Margin = revenue − crude cost, at fixed low/high price assumptions. Annualized at 330 operating days/year, 24 h/day.",
          ] },
        ]}
      />
    </>
  );
}
