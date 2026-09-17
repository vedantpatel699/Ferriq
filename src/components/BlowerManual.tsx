import { DataTable } from "./DataTable";
import { FormulaBlock, ManualSection } from "./ModelPagePrimitives";

export function BlowerManual() {
  return (
    <div className="engineering-manual">
      <h2>Air Blower engineering manual</h2>
      <p className="manual-lead">
        Proof-of-concept performance and condition model for a dual-train
        centrifugal air blower. One active train is evaluated per timestamp.
      </p>

      <ManualSection title="Model inputs">
        <DataTable
          caption="Live-data inputs"
          columns={["input", "unit", "required", "use"]}
          rows={[
            { input: "Timestamp", unit: "date/time", required: "Yes", use: "Ordering and trends" },
            { input: "Motor current A / B", unit: "A", required: "Yes", use: "Active-train selection, electrical power and performance baseline" },
            { input: "Suction pressure A / B", unit: "kPaa", required: "Active train", use: "P₁, pressure rise and pressure ratio" },
            { input: "Discharge pressure A / B", unit: "kPag", required: "Active train", use: "P₂, pressure rise and pressure ratio" },
            { input: "Total air flow", unit: "Nm³/hr", required: "Yes", use: "Performance indicator and expected-flow regression" },
            { input: "Suction temperature", unit: "°C", required: "Thermodynamic efficiency", use: "T₁" },
            { input: "Discharge temperature A / B", unit: "°C", required: "Thermodynamic efficiency", use: "T₂" },
            { input: "Bypass valve position A / B", unit: "% open", required: "No", use: "Recycle condition, regression applicability and thrust proxy" },
            { input: "Filter differential pressure A / B", unit: "bar", required: "No", use: "Filter restriction and regression applicability" },
            { input: "Vibration probes A / B", unit: "mm/s RMS", required: "Mechanical health", use: "Maximum vibration and trend" },
            { input: "Bearing temperatures A / B", unit: "°C", required: "Mechanical health", use: "Maximum bearing temperature and trend" },
          ]}
        />
      </ManualSection>

      <ManualSection title="Pressure normalization">
        <FormulaBlock name="Absolute suction pressure">
          <><i>P</i><sub>1</sub> = <i>P</i><sub>suction,kPaa</sub> / 100</>
        </FormulaBlock>
        <FormulaBlock name="Absolute discharge pressure">
          <><i>P</i><sub>2</sub> = <i>P</i><sub>discharge,kPag</sub> / 100 + <i>P</i><sub>atm</sub></>
        </FormulaBlock>
        <FormulaBlock name="Pressure rise and ratio">
          <><span>Δ<i>P</i> = <i>P</i><sub>2</sub> − <i>P</i><sub>1</sub></span><span className="formula-separator">; </span><span><i>r</i><sub>p</sub> = <i>P</i><sub>2</sub> / <i>P</i><sub>1</sub></span></>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Motor input power">
        <p>
          Three-phase electrical input power uses the standard balanced
          three-phase relationship. In datasheet mode, power factor is linearly
          interpolated from the supplied motor performance points at the
          measured current.
        </p>
        <FormulaBlock name="Electrical input power">
          <><i>P</i><sub>in</sub> = √3 · <i>V</i> · <i>I</i> · PF / 1000</>
        </FormulaBlock>
        <p>
          The current/power-factor points come from the supplied induction-motor
          datasheet. Fixed PF remains available as a configuration fallback.
        </p>
      </ManualSection>

      <ManualSection title="Fluid-power performance indicator">
        <p>
          This is retained as a process-performance indicator only. It is not a
          rigorous compressor thermodynamic efficiency.
        </p>
        <FormulaBlock name="Fluid power">
          <><i>P</i><sub>fluid</sub> = <i>Q</i> · Δ<i>P</i> / 36</>
        </FormulaBlock>
        <FormulaBlock name="Fluid-power ratio">
          <>η<sub>fluid</sub> = (<i>P</i><sub>fluid</sub> / <i>P</i><sub>in</sub>) · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Isentropic efficiency">
        <p>
          Ideal-gas POC estimate. The pressure-temperature relation is standard
          isentropic thermodynamics. ASME PTC 10 is the governing compressor
          performance-test framework, but this dashboard is not a full PTC 10 test.
        </p>
        <FormulaBlock name="Isentropic efficiency">
          <>η<sub>s</sub> = <span className="formula-fraction"><span><i>T</i><sub>1</sub>[(<i>P</i><sub>2</sub>/<i>P</i><sub>1</sub>)<sup>(k−1)/k</sup> − 1]</span><span><i>T</i><sub>2</sub> − <i>T</i><sub>1</sub></span></span> · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Polytropic efficiency">
        <p>
          Ideal-gas POC estimate used as the preferred thermodynamic trend when
          measured T₁ and T₂ are available. A formal acceptance/performance test
          would follow ASME PTC 10 methods and uncertainty requirements.
        </p>
        <FormulaBlock name="Polytropic temperature exponent">
          <>σ = <span className="formula-fraction"><span>ln(<i>T</i><sub>2</sub>/<i>T</i><sub>1</sub>)</span><span>ln(<i>P</i><sub>2</sub>/<i>P</i><sub>1</sub>)</span></span></>
        </FormulaBlock>
        <FormulaBlock name="Polytropic efficiency">
          <>η<sub>p</sub> = <span className="formula-fraction"><span>(k−1)/k</span><span>σ</span></span> · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Performance degradation model">
        <p>
          The coefficients <strong>a</strong> and <strong>b</strong> are fitted
          from the configured healthy-reference observations. They are not taken
          from the vendor datasheet. The vendor design point is kept separately
          as an engineering reference.
        </p>
        <FormulaBlock name="Expected-flow regression">
          <><i>Q</i><sub>expected</sub> = a + b · <i>I</i><sub>motor</sub></>
        </FormulaBlock>
        <FormulaBlock name="Least-squares slope">
          <>b = <span className="formula-fraction"><span>Σ(<i>I</i><sub>i</sub>−Ī)(<i>Q</i><sub>i</sub>−Q̄)</span><span>Σ(<i>I</i><sub>i</sub>−Ī)²</span></span></>
        </FormulaBlock>
        <FormulaBlock name="Least-squares intercept">
          <>a = Q̄ − bĪ</>
        </FormulaBlock>
        <FormulaBlock name="Flow residual">
          <><i>R</i><sub>flow</sub> = <span className="formula-fraction"><span><i>Q</i><sub>measured</sub> − <i>Q</i><sub>expected</sub></span><span><i>Q</i><sub>expected</sub></span></span> · 100%</>
        </FormulaBlock>
        <FormulaBlock name="Performance degradation">
          <>Degradation = max(0, −<i>R</i><sub>flow</sub>)</>
        </FormulaBlock>
        <p>
          Method source: NIST Engineering Statistics Handbook, linear
          least-squares regression. The model is a POC screening model, not a
          failure-probability or remaining-life model.
        </p>
      </ManualSection>

      <ManualSection title="Bearing and vibration condition">
        <p>
          Maximum active-train vibration and bearing temperature are compared
          with configured thresholds. Least-squares slopes over recent valid
          observations provide short-term trends.
        </p>
        <FormulaBlock name="Bearing advisory trend projection">
          <>Days to advisory = <span className="formula-fraction"><span><i>T</i><sub>advisory</sub> − <i>T</i><sub>current</sub></span><span>d<i>T</i>/dt</span></span></>
        </FormulaBlock>
        <p>This is a linear trend projection only, not remaining useful life.</p>
      </ManualSection>

      <ManualSection title="Thrust operating-deviation proxy">
        <p>
          No direct thrust measurement is available. For this POC, a screening
          proxy combines deviation from the supplied vendor design flow,
          pressure ratio and recycle/bypass position. This is a Ferriq
          engineering heuristic, not an ASME/API thrust equation and not a
          substitute for axial-position or thrust-bearing instrumentation.
        </p>
        <FormulaBlock name="POC thrust operating-deviation proxy">
          <>Proxy = 100 · √[(δ<sub>Q</sub>² + δ<sub>PR</sub>² + δ<sub>bypass</sub>²) / 3]</>
        </FormulaBlock>
        <p>
          δQ and δPR are fractional deviations from the vendor design point;
          δbypass is bypass fraction from 0 to 1.
        </p>
      </ManualSection>

      <ManualSection title="Primary references">
        <DataTable
          caption="Method references"
          columns={["reference", "use in this POC"]}
          rows={[
            { reference: "ASME PTC 10-2022 — Axial and Centrifugal Compressors", use: "Compressor performance-test framework for flow, pressure rise, power and efficiency" },
            { reference: "NASA Glenn Research Center — Isentropic Compression", use: "Ideal-gas pressure/temperature relation and γ = Cp/Cv" },
            { reference: "NIST Engineering Statistics Handbook — Linear Least Squares Regression", use: "Healthy-reference expected-flow regression" },
            { reference: "Supplied blower vendor datasheet", use: "Design pressure, flow, power, speed and polytropic-efficiency reference point" },
            { reference: "Supplied induction-motor datasheet", use: "Voltage, rated current and current-dependent power-factor reference points" },
          ]}
        />
      </ManualSection>

      <ManualSection title="Live-data interface">
        <p>
          A historian, OPC-UA, SQL or API connector should provide one record
          per timestamp using the documented units. Train A and B signals must
          remain separate. Missing live signals should be null rather than
          copied between trains.
        </p>
      </ManualSection>
    </div>
  );
}
