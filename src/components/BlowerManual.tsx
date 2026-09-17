import { DataTable } from "./DataTable";
import type { BlowerLimits, BlowerSettings } from "../engineering/blower/calculations";

export function BlowerManual({
  settings,
  limits,
}: {
  settings: BlowerSettings;
  limits: BlowerLimits;
}) {
  return (
    <>
      <h2>Air Blower engineering model</h2>
      <p>
        The model evaluates one operating blower at a time. In automatic mode,
        motor current determines the active train; all pressure, temperature,
        vibration, bearing-temperature and control signals are then selected
        from that train for the same timestamp.
      </p>

      <h3>Model inputs</h3>
      <DataTable
        caption="Historian / live-data inputs"
        rows={[
          { input: "Timestamp", unit: "date/time", required: "Yes", use: "Observation ordering, trends and bounded forward-fill" },
          { input: "Motor current A / B", unit: "A", required: "Yes", use: "Active-train selection, motor input power and flow-baseline model" },
          { input: "Suction pressure A / B", unit: "kPaa", required: "Active train", use: "Absolute suction pressure, pressure ratio and pressure rise" },
          { input: "Discharge pressure A / B", unit: "kPag", required: "Active train", use: "Absolute discharge pressure, pressure ratio, pressure rise and capacity check" },
          { input: "Controller discharge-pressure SP A / B", unit: "kPag", required: "No", use: "Capacity-limit condition when bypass is closed" },
          { input: "Bypass valve position A / B", unit: "% open", required: "No", use: "Recycle / capacity condition and applicability of the flow-baseline model" },
          { input: "Filter differential pressure A / B", unit: "bar", required: "No", use: "Filter restriction condition and applicability of the flow-baseline model" },
          { input: "Total blower / combustion-air flow", unit: "Nm³/hr", required: "Yes", use: "Fluid-power indicator and expected-flow performance model" },
          { input: "Suction temperature", unit: "°C", required: "For thermodynamic efficiency", use: "T1 for isentropic and polytropic efficiency" },
          { input: "Discharge temperature A / B", unit: "°C", required: "For thermodynamic efficiency", use: "T2 for isentropic and polytropic efficiency" },
          { input: "Vibration probes A / B", unit: "mm/s RMS", required: "For vibration health", use: "Maximum active-train vibration and trend" },
          { input: "Bearing temperatures A / B", unit: "°C", required: "For bearing health", use: "Maximum active-train bearing temperature, trend and advisory projection" },
          { input: "Axial position / thrust-bearing temperature", unit: "OEM tag units", required: "For thrust health", use: "Required before thrust-health monitoring can be enabled" },
        ]}
      />

      <h3>Configured engineering parameters</h3>
      <DataTable
        caption="Current model configuration"
        rows={[
          { parameter: "Motor line voltage", value: settings.motorVoltageV, unit: "V" },
          { parameter: "Motor power factor", value: settings.powerFactor, unit: "—" },
          { parameter: "Air heat-capacity ratio, k", value: settings.gammaK, unit: "—" },
          { parameter: "Site atmospheric pressure", value: settings.atmPressureBar, unit: "bar abs" },
          { parameter: "Active-current threshold", value: settings.activeCurrentMinA, unit: "A" },
          { parameter: "Suction-temperature forward-fill limit", value: settings.suctionTempFfMaxHours, unit: "h" },
          { parameter: "Selected efficiency method", value: settings.efficiencyMethod, unit: "—" },
          { parameter: "Vibration advisory / alarm / trip", value: `${limits.vibAdvisoryMms} / ${limits.vibAlarmMms} / ${limits.vibTripMms}`, unit: "mm/s RMS" },
          { parameter: "Bearing-temperature advisory / alarm / trip", value: `${limits.brgAdvisoryC} / ${limits.brgAlarmC} / ${limits.brgTripC}`, unit: "°C" },
          { parameter: "Filter ΔP maximum", value: limits.filterDpMaxBar, unit: "bar" },
          { parameter: "Blower ΔP maximum", value: limits.blowerDpMaxBar, unit: "bar" },
          { parameter: "Bypass opening maximum", value: limits.bypassOpenMaxPct, unit: "%" },
          { parameter: "Performance shortfall WATCH / INVESTIGATE", value: `${limits.performanceWatchPct} / ${limits.performanceAlarmPct}`, unit: "%" },
        ]}
      />

      <h3>Active-train selection</h3>
      <p>
        In <strong>auto</strong> mode, a train is considered running when its
        motor current exceeds the configured active-current threshold. If both
        trains exceed the threshold, the train with the higher current is
        selected. Manual A or B mode selects only that train and still requires
        its current to exceed the active-current threshold.
      </p>

      <h3>Pressure normalization</h3>
      <p>
        Suction pressure is supplied as absolute pressure and discharge pressure
        as gauge pressure. Both are converted to absolute bar before compression
        calculations:
      </p>
      <p>
        <code>P1 = Psuction,kPaa / 100</code>
        <br />
        <code>P2 = Pdischarge,kPag / 100 + Patm</code>
        <br />
        <code>ΔP = P2 - P1</code>
        <br />
        <code>Pressure ratio = P2 / P1</code>
      </p>

      <h3>Motor input power</h3>
      <p>
        Three-phase electrical input power is calculated from line voltage,
        measured motor current and power factor:
      </p>
      <p>
        <code>Pmotor = √3 × V × I × PF / 1000</code> kW
      </p>
      <p>
        The configured power factor is a nameplate / engineering assumption
        unless a measured power factor is supplied through a future integration.
      </p>

      <h3>Fluid-power performance indicator</h3>
      <p>
        A hydraulic-style power ratio is calculated from normalized flow and
        blower pressure rise:
      </p>
      <p>
        <code>Pfluid = Q × ΔP / 36</code> kW
        <br />
        <code>ηfluid = Pfluid / Pmotor × 100</code> %
      </p>
      <p>
        This is retained as a performance indicator and fallback when
        thermodynamic temperature inputs are unavailable. It is not treated as
        a rigorous compressor efficiency.
      </p>

      <h3>Isentropic efficiency</h3>
      <p>
        When both suction and active-train discharge temperature are available,
        temperatures are converted to kelvin and isentropic efficiency is:
      </p>
      <p>
        <code>
          ηs = T1 × ((P2/P1)^((k-1)/k) - 1) / (T2 - T1) × 100
        </code>
      </p>
      <p>
        The result is not calculated if discharge pressure is not above suction
        pressure or if discharge temperature is not above suction temperature.
      </p>

      <h3>Polytropic efficiency</h3>
      <p>
        The polytropic temperature exponent and efficiency are:
      </p>
      <p>
        <code>σ = ln(T2/T1) / ln(P2/P1)</code>
        <br />
        <code>ηp = ((k-1)/k) / σ × 100</code>
      </p>
      <p>
        Polytropic efficiency is the preferred thermodynamic performance metric
        when valid T1 and T2 measurements are available.
      </p>

      <h3>Performance-degradation model</h3>
      <p>
        A separate baseline is fitted for each blower using ordinary least
        squares on eligible reference observations:
      </p>
      <p>
        <code>Qexpected = a + b × Imotor</code>
      </p>
      <p>
        The baseline uses up to the first 14 valid observations with bypass
        below 5% and filter differential pressure within its configured limit.
        The same operating-envelope checks are applied before a current
        observation is classified for degradation. When the observation is
        outside that envelope, the degradation result is reported as
        unavailable rather than interpreted as equipment degradation.
      </p>
      <p>
        <code>
          Flow residual = (Qmeasured - Qexpected) / Qexpected × 100
        </code>
        <br />
        <code>
          Performance degradation = max(0, -Flow residual)
        </code>
      </p>
      <p>
        The configured WATCH and INVESTIGATE thresholds apply to this flow
        shortfall. This is an expected-behaviour regression screen; it does not
        estimate failure probability or remaining useful life.
      </p>

      <h3>Bearing and vibration condition</h3>
      <p>
        For the active train, the highest valid vibration probe and the highest
        valid bearing temperature are evaluated against the configured
        advisory, alarm and trip limits. A least-squares slope is also
        calculated over up to seven recent valid observations for maximum
        vibration and maximum bearing temperature.
      </p>
      <p>
        If bearing temperature is below the advisory threshold and the fitted
        temperature slope is positive, the model reports a trend projection:
      </p>
      <p>
        <code>
          Days to advisory = (Tadvisory - Tcurrent) / bearing trend
        </code>
      </p>
      <p>
        This is a linear trend projection only. It is not a bearing-life or
        remaining-useful-life calculation.
      </p>

      <h3>Process-condition checks</h3>
      <DataTable
        caption="Condition logic"
        rows={[
          { condition: "Filter restriction", logic: `Filter ΔP > ${limits.filterDpMaxBar} bar` },
          { condition: "High blower pressure rise", logic: `Blower ΔP > ${limits.blowerDpMaxBar} bar` },
          { condition: "High recycle / bypass", logic: `Bypass > ${limits.bypassOpenMaxPct}%` },
          { condition: "Capacity limit", logic: "Bypass < 5% and discharge pressure < controller setpoint" },
        ]}
      />

      <h3>Thrust-health method</h3>
      <p>
        Thrust health requires a dedicated axial-position / axial-displacement
        measurement, thrust-bearing temperature, or another OEM-designated
        thrust indicator. Radial vibration is not substituted for a thrust
        measurement. Until an appropriate live signal is mapped, thrust health
        is reported as unavailable.
      </p>

      <h3>Data-quality handling</h3>
      <p>
        Timestamp, active-train suction pressure, active-train discharge
        pressure, total flow and active-train motor current are required for a
        valid performance row. Missing vibration or bearing-temperature probes
        do not invalidate the performance calculation, but the affected
        mechanical-health result is unavailable. A measured suction
        temperature may be forward-filled only within the configured time
        window. If no valid suction temperature exists, no fixed temperature is
        inserted into the thermodynamic efficiency equations.
      </p>

      <h3>Primary outputs</h3>
      <DataTable
        caption="Calculated outputs"
        rows={[
          { output: "Active blower", description: "A or B selected for the observation" },
          { output: "Motor input power", description: "Calculated 3-phase electrical input, kW" },
          { output: "P1 / P2 absolute, ΔP and pressure ratio", description: "Normalized compression conditions" },
          { output: "Fluid-power indicator", description: "Flow / pressure-rise performance ratio" },
          { output: "Isentropic efficiency", description: "Thermodynamic efficiency when T1 and T2 are valid" },
          { output: "Polytropic efficiency", description: "Preferred thermodynamic efficiency when T1 and T2 are valid" },
          { output: "Expected flow", description: "Baseline-regression prediction at current motor load" },
          { output: "Flow residual / performance degradation", description: "Measured-versus-expected flow deviation when baseline conditions are applicable" },
          { output: "Maximum vibration / bearing temperature", description: "Active-train mechanical-health indicators" },
          { output: "Vibration / bearing trend", description: "Least-squares slope over recent valid observations" },
          { output: "Bearing advisory projection", description: "Linear days-to-advisory projection when applicable" },
          { output: "Alerts / state", description: "Mechanical and process-condition results rolled into NORMAL, WATCH or INVESTIGATE" },
        ]}
      />

      <h3>Live-data integration requirements</h3>
      <p>
        A historian, OPC-UA, SQL or API connector should provide one observation
        per timestamp using the input names and units above. Train A and B tags
        must remain separate. Unit conversion should occur at the integration
        boundary so the model receives kPaa suction pressure, kPag discharge
        pressure, bar filter differential pressure, Nm³/hr flow, °C
        temperatures, mm/s RMS vibration, amperes and percent-open valve
        position. Missing measurements should be sent as null / blank values;
        values from the opposite train must not be copied into unavailable
        signals.
      </p>
    </>
  );
}
