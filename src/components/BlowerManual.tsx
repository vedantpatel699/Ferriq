import { DataTable } from "./DataTable";
import { FormulaBlock, ManualSection } from "./ModelPagePrimitives";

export function BlowerManual() {
  return (
    <div className="engineering-manual">
      <h2>Air Blower engineering manual</h2>
      <p className="manual-lead">
        This model evaluates blower operating performance and mechanical
        condition for a dual-train air-blower service. One train is evaluated
        per timestamp using the active-train selection logic described below.
      </p>

      <ManualSection title="Model inputs">
        <DataTable
          caption="Live-data inputs"
          columns={["input", "unit", "required", "use"]}
          rows={[
            { input: "Timestamp", unit: "date/time", required: "Yes", use: "Observation ordering and trend calculations" },
            { input: "Motor current A / B", unit: "A", required: "Yes", use: "Running-train selection, motor power and performance baseline" },
            { input: "Suction pressure A / B", unit: "kPaa", required: "Active train", use: "Absolute suction pressure, pressure ratio and pressure rise" },
            { input: "Discharge pressure A / B", unit: "kPag", required: "Active train", use: "Absolute discharge pressure, pressure ratio, pressure rise and capacity check" },
            { input: "Discharge-pressure controller SP A / B", unit: "kPag", required: "No", use: "Capacity-limit condition" },
            { input: "Bypass valve position A / B", unit: "% open", required: "No", use: "Recycle condition and performance-model applicability" },
            { input: "Filter differential pressure A / B", unit: "bar", required: "No", use: "Filter restriction and performance-model applicability" },
            { input: "Total air flow", unit: "Nm³/hr", required: "Yes", use: "Fluid-power indicator and expected-flow model" },
            { input: "Suction temperature", unit: "°C", required: "Thermodynamic efficiency", use: "T₁" },
            { input: "Discharge temperature A / B", unit: "°C", required: "Thermodynamic efficiency", use: "T₂" },
            { input: "Vibration probes A / B", unit: "mm/s RMS", required: "Mechanical health", use: "Maximum vibration and trend" },
            { input: "Bearing temperatures A / B", unit: "°C", required: "Mechanical health", use: "Maximum bearing temperature, trend and advisory projection" },
            { input: "Axial position / thrust-bearing temperature", unit: "OEM units", required: "Thrust health", use: "Required before thrust-health monitoring can be enabled" },
          ]}
        />
      </ManualSection>

      <ManualSection title="Active-train selection">
        <p>
          In automatic mode a train is considered running when its motor current
          exceeds the configured running-current threshold. If both trains are
          above the threshold, the train with the higher current is selected.
          Manual A or B mode selects only that train and still requires it to be running.
        </p>
      </ManualSection>

      <ManualSection title="Pressure normalization">
        <p>
          Suction pressure is supplied as absolute pressure. Discharge pressure
          is supplied as gauge pressure and converted to absolute pressure using
          the configured site atmospheric pressure.
        </p>
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
        <p>Three-phase electrical input power is calculated from line voltage, measured motor current and power factor.</p>
        <FormulaBlock name="Three-phase motor input power" note="Result in kW">
          <><i>P</i><sub>motor</sub> = √3 · <i>V</i> · <i>I</i> · PF / 1000</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Fluid-power performance indicator">
        <p>
          The fluid-power ratio is retained as a process-performance indicator.
          It is used as the displayed fallback when thermodynamic temperature
          measurements are not available; it is not treated as rigorous compressor efficiency.
        </p>
        <FormulaBlock name="Fluid power" note="Q in Nm³/hr, ΔP in bar, result in kW">
          <><i>P</i><sub>fluid</sub> = <i>Q</i> · Δ<i>P</i> / 36</>
        </FormulaBlock>
        <FormulaBlock name="Fluid-power indicator">
          <>η<sub>fluid</sub> = (<i>P</i><sub>fluid</sub> / <i>P</i><sub>motor</sub>) · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Isentropic efficiency">
        <p>
          T₁ and T₂ are converted to kelvin. The result is calculated only when
          P₂ &gt; P₁ and T₂ &gt; T₁.
        </p>
        <FormulaBlock name="Isentropic efficiency">
          <>η<sub>s</sub> = <span className="formula-fraction"><span><i>T</i><sub>1</sub>[(<i>P</i><sub>2</sub>/<i>P</i><sub>1</sub>)<sup>(k−1)/k</sup> − 1]</span><span><i>T</i><sub>2</sub> − <i>T</i><sub>1</sub></span></span> · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Polytropic efficiency">
        <p>Polytropic efficiency is the preferred thermodynamic performance metric when valid T₁ and T₂ measurements are available.</p>
        <FormulaBlock name="Polytropic temperature exponent">
          <>σ = <span className="formula-fraction"><span>ln(<i>T</i><sub>2</sub>/<i>T</i><sub>1</sub>)</span><span>ln(<i>P</i><sub>2</sub>/<i>P</i><sub>1</sub>)</span></span></>
        </FormulaBlock>
        <FormulaBlock name="Polytropic efficiency">
          <>η<sub>p</sub> = <span className="formula-fraction"><span>(k−1)/k</span><span>σ</span></span> · 100%</>
        </FormulaBlock>
      </ManualSection>

      <ManualSection title="Performance degradation method">
        <p>
          A separate expected-flow baseline is fitted for each blower using
          ordinary least squares over the configured reference period. Only
          observations inside the configured operating envelope are used.
        </p>
        <FormulaBlock name="Expected-flow regression">
          <><i>Q</i><sub>expected</sub> = a + b · <i>I</i><sub>motor</sub></>
        </FormulaBlock>
        <FormulaBlock name="Flow residual">
          <><i>R</i><sub>flow</sub> = <span className="formula-fraction"><span><i>Q</i><sub>measured</sub> − <i>Q</i><sub>expected</sub></span><span><i>Q</i><sub>expected</sub></span></span> · 100%</>
        </FormulaBlock>
        <FormulaBlock name="Performance degradation">
          <>Degradation = max(0, −<i>R</i><sub>flow</sub>)</>
        </FormulaBlock>
        <p>
          Degradation is reported only when bypass opening and filter
          differential pressure are inside the configured baseline envelope.
          The result is an expected-behaviour screen, not a failure probability.
        </p>
      </ManualSection>

      <ManualSection title="Bearing and vibration condition">
        <p>
          The maximum valid vibration and maximum valid bearing temperature for
          the active train are checked against configured advisory, alarm and
          trip thresholds. A least-squares slope is calculated over up to seven
          recent valid observations for each condition indicator.
        </p>
        <FormulaBlock name="Bearing advisory trend projection">
          <>Days to advisory = <span className="formula-fraction"><span><i>T</i><sub>advisory</sub> − <i>T</i><sub>current</sub></span><span>d<i>T</i>/dt</span></span></>
        </FormulaBlock>
        <p>The projection is a trend screen only; it is not remaining useful life.</p>
      </ManualSection>

      <ManualSection title="Process-condition checks">
        <DataTable
          caption="Condition logic"
          columns={["condition", "method"]}
          rows={[
            { condition: "Filter restriction", method: "Filter ΔP above configured maximum" },
            { condition: "High blower pressure rise", method: "Blower ΔP above configured maximum" },
            { condition: "High recycle / bypass", method: "Bypass opening above configured maximum" },
            { condition: "Capacity limit", method: "Bypass below the baseline-open threshold while discharge pressure remains below controller setpoint" },
          ]}
        />
      </ManualSection>

      <ManualSection title="Thrust health">
        <p>
          Thrust health requires a dedicated axial-position / axial-displacement
          measurement, thrust-bearing temperature, or another OEM-designated
          thrust indicator. Radial vibration is not substituted for a thrust
          measurement. Until an appropriate signal is mapped, thrust health is unavailable.
        </p>
      </ManualSection>

      <ManualSection title="Data-quality handling">
        <p>
          Timestamp, active-train suction pressure, active-train discharge
          pressure, total flow and active-train motor current are required for a
          valid performance observation. Missing mechanical probes do not
          invalidate the performance calculation, but their mechanical-health
          outputs remain unavailable. A measured suction temperature may be
          forward-filled only within the configured time limit; otherwise no
          fixed temperature is inserted into thermodynamic efficiency calculations.
        </p>
      </ManualSection>

      <ManualSection title="Primary outputs">
        <DataTable
          caption="Calculated outputs"
          columns={["output", "description"]}
          rows={[
            { output: "Active blower", description: "A or B selected for the observation" },
            { output: "Motor input power", description: "Calculated three-phase electrical input" },
            { output: "P₁, P₂, ΔP and pressure ratio", description: "Normalized compression conditions" },
            { output: "Fluid-power indicator", description: "Flow / pressure-rise performance indicator" },
            { output: "Isentropic efficiency", description: "Thermodynamic efficiency when T₁ and T₂ are valid" },
            { output: "Polytropic efficiency", description: "Preferred thermodynamic efficiency when T₁ and T₂ are valid" },
            { output: "Expected flow", description: "Regression prediction at current motor load" },
            { output: "Flow residual / degradation", description: "Measured-versus-expected flow deviation inside the baseline envelope" },
            { output: "Maximum vibration / bearing temperature", description: "Active-train mechanical-condition indicators" },
            { output: "Vibration / bearing trend", description: "Least-squares slope over recent valid observations" },
            { output: "Bearing advisory projection", description: "Linear days-to-advisory projection when applicable" },
            { output: "Engineering state", description: "Condition results rolled into NORMAL, WATCH or INVESTIGATE; data quality reported independently" },
          ]}
        />
      </ManualSection>

      <ManualSection title="Live-data interface">
        <p>
          A historian, OPC-UA, SQL or API connector should provide one record
          per timestamp using the input names and units listed above. Train A
          and B signals must remain separate. Unit conversion should occur at
          the integration boundary. Missing signals should be passed as null or
          blank values rather than copied from the opposite train.
        </p>
      </ManualSection>
    </div>
  );
}
