import { DataTable } from "./DataTable";

export function BlowerManual() {
  return (
    <>
      <h2>Air Blower model</h2>
      <p>
        The model monitors blower power, operating performance and mechanical
        condition for trains A/B. It uses the running motor current to select
        the active train, then applies that train's pressure, bypass, filter and
        available mechanical measurements.
      </p>

      <h3>Client requirements covered</h3>
      <DataTable
        caption="Blower model scope"
        rows={[
          { requirement: "Total power", implementation: "3-phase motor input power from voltage, current and power factor" },
          { requirement: "Efficiency / performance", implementation: "Polytropic and isentropic efficiency when temperatures are measured; fluid-power performance indicator otherwise" },
          { requirement: "Bearing failure prediction or alert", implementation: "Vibration and bearing-temperature limits plus short-window trend projection" },
          { requirement: "Performance reduction prediction", implementation: "Expected-flow baseline regression and measured-vs-expected flow residual" },
          { requirement: "Thrust failure prediction or alert", implementation: "Not available from the supplied workbook because no axial-position or thrust-bearing-temperature signal is identified" },
        ]}
      />

      <h3>Pressure and power calculations</h3>
      <p>
        Suction pressure is read as absolute kPa and converted to bar absolute.
        Discharge pressure is treated as gauge kPa and converted to absolute
        pressure by adding the configured site atmospheric pressure. Motor input
        power is calculated as √3 × voltage × current × power factor / 1000.
      </p>

      <h3>Efficiency and performance</h3>
      <p>
        Polytropic and isentropic efficiency require both suction and discharge
        temperature. Missing suction temperature is not replaced with a fixed
        value. A recent measured suction temperature may be forward-filled only
        within the configured time window. When thermodynamic efficiency cannot
        be calculated, the page uses the fluid-power ratio only as a performance
        indicator and labels it as a fallback.
      </p>
      <p>
        The performance model is a simple, transparent linear regression of
        measured flow against active motor current. A separate model is trained
        for each blower from the first 14 eligible clean-reference observations
        with bypass below 5% and filter differential pressure below its limit.
        The important output is the flow residual: measured flow minus expected
        flow, expressed as a percentage of expected flow. A 5% shortfall is a
        WATCH screening threshold and a 10% shortfall is an INVESTIGATE
        screening threshold. These are model-screening limits, not OEM trip
        limits.
      </p>

      <h3>Bearing health</h3>
      <p>
        The model keeps each available vibration and bearing-temperature probe
        separate, reports the maximum for the active train, and applies the
        configured vibration and temperature tiers. It also calculates a
        least-squares trend over up to seven recent valid observations and, when
        the bearing temperature is rising below the advisory limit, projects
        the number of days to that advisory threshold. The projection is a
        trend screen, not remaining useful life.
      </p>

      <h3>Thrust health</h3>
      <p>
        The supplied blower workbook does not identify an axial-position probe,
        axial displacement measurement or thrust-bearing temperature tag.
        Ferriq therefore reports thrust health as unavailable rather than
        inferring it from radial vibration. Add an OEM-identified axial/thrust
        signal before enabling thrust alerts or degradation modelling.
      </p>

      <h3>Corrected demo mapping</h3>
      <p>
        The bundled demo uses actual Blower A measurements from the client
        workbook. Blower suction comes from the blower-suction pressure tags,
        while filter differential pressure comes from the PDI tags and is
        converted from Pa to bar. B mechanical probes and missing temperature
        signals are left blank rather than copied or synthesized. The detailed
        mapping is stored in <code>reference/blower-tag-map.md</code>.
      </p>

      <h3>Key limitations</h3>
      <p>
        The baseline regression is a screening model trained on the bundled
        reference period; plant deployment requires retraining on a
        maintenance-verified healthy period. It does not estimate failure
        probability or remaining useful life. Mechanical alarm thresholds must
        be confirmed against the machine OEM, bearing design and current site
        alarm philosophy.
      </p>
    </>
  );
}
