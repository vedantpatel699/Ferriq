import { FormulaBlock, ManualSection } from "./ModelPagePrimitives";

export function HydrogenManual() {
  return (
    <article className="reference-manual engineering-manual">
      <h2>Hydrogen Production engineering manual</h2>
      <p>
        Estimate hydrogen product, process CO₂ and reaction-water consumption
        from a gas blend.
      </p>
      <ManualSection title="Using the model">
        <ol>
          <li>
            Select Feed Case A or B and conversion Dataset 1, 2 or 3
            independently.
          </li>
          <li>
            Edit feed flows, compositions or conversion settings. Results update
            automatically when inputs are valid.
          </li>
          <li>
            Use Restore feed preset or Restore profile to return to the selected
            reference values.
          </li>
        </ol>
        <p>
          On the website, Save scenario retains inputs in the current browser.
          Results by feed shows each stream's contribution.
        </p>
        <h4>Run the Python model</h4>
        <p>
          Install Python 3 with Tcl/Tk and IDLE from python.org. Open
          hydrogen_production.py in IDLE, then choose Run → Run Module (F5). A
          calculator window opens; no code edits or additional packages are
          needed. Close the window when finished. Changes are not saved between
          Python sessions.
        </p>
      </ManualSection>
      <ManualSection title="Inputs and results">
        <p>
          Feed flows are Sm³/h. Dry compositions are mol% H₂, N₂, CO, CO₂ and
          methane through hexane. All three streams enter the reformer,
          including hydrogenation gas.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Feed</th>
              <th>Case A (Sm³/h)</th>
              <th>Case B (Sm³/h)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Chemical feed gas</td>
              <td>16,173</td>
              <td>0</td>
            </tr>
            <tr>
              <td>Natural gas</td>
              <td>40,403</td>
              <td>62,424</td>
            </tr>
            <tr>
              <td>Hydrogenation gas</td>
              <td>0</td>
              <td>1,931</td>
            </tr>
          </tbody>
        </table>
        <p>
          Compositions must total 100%. Rounding differences within 0.02
          percentage points are normalized for calculation; entered values
          remain unchanged. The chemical-gas preset totals 99.99%. Missing,
          negative or invalid inputs hide results until corrected.
        </p>
        <ul>
          <li>
            <strong>Hydrogen product:</strong> recovered H₂ after PSA, in Sm³/h
            and kmol/h. Includes H₂ already present in the feed.
          </li>
          <li>
            <strong>CO₂ generated:</strong> CO₂ formed by reactions, in t/h and
            kmol/h. Total process CO₂ also includes incoming feed CO₂.
          </li>
          <li>
            <strong>Reaction water:</strong> water consumed by reforming and
            shift, in t/h.
          </li>
        </ul>
      </ManualSection>
      <ManualSection title="Calculation method">
        <p>
          For hydrocarbon CₙH₂ₙ₊₂, n is the carbon count. Let a be the reformer
          carbon fraction converted to CO, b the fraction converted to CO₂, s
          the shift CO conversion, and r the PSA H₂ recovery. Enter percentages
          in the controls; the formulas use fractions.
        </p>
        <FormulaBlock name="Reformer reactions">
          <div>CₙH₂ₙ₊₂ + nH₂O → nCO + (2n + 1)H₂</div>
          <div>CₙH₂ₙ₊₂ + 2nH₂O → nCO₂ + (3n + 1)H₂</div>
        </FormulaBlock>
        <FormulaBlock name="Shift reaction">CO + H₂O → CO₂ + H₂</FormulaBlock>
        <FormulaBlock name="Per mole of hydrocarbon feed">
          <div>H₂ generated = a(2n + 1) + b(3n + 1) + nas</div>
          <div>CO₂ generated = n(b + as)</div>
          <div>H₂O consumed = n(a + 2b + as)</div>
        </FormulaBlock>
        <p>
          Calculated reformer outlet flows become shift inlet flows. Feed CO
          also reacts in the shift: each mole converted produces one mole each
          of H₂ and CO₂ and consumes one mole of water. Feed H₂ passes through,
          N₂ is inert, and unconverted hydrocarbons remain in the outlet.
        </p>
        <FormulaBlock name="Product and mass rates">
          <div>H₂ product = (incoming H₂ + generated H₂) × r</div>
          <div>Total process CO₂ = incoming CO₂ + generated CO₂</div>
          <div>CO₂ t/h = CO₂ kmol/h × 44 / 1000</div>
          <div>Water t/h = H₂O kmol/h × 18 / 1000</div>
        </FormulaBlock>
        <p>
          PSA recovery defaults to 90%; it is not product purity. Per-feed
          product contributions use one common recovery for the blended feed.
        </p>
      </ManualSection>
      <ManualSection title="Conversion profiles">
        <table className="data">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Carbon to CO (%)</th>
              <th>Carbon to CO₂ (%)</th>
              <th>Shift CO conversion (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>42.804629</td>
              <td>30.733267</td>
              <td>74.757576</td>
            </tr>
            <tr>
              <td>2</td>
              <td>42.686654</td>
              <td>31.610475</td>
              <td>74.959318</td>
            </tr>
            <tr>
              <td>3</td>
              <td>42.675235</td>
              <td>30.416455</td>
              <td>74.797917</td>
            </tr>
          </tbody>
        </table>
        <p>
          Factors follow CO/CO₂ formation in the supplied datasets. Original
          pairings are Feed A with Dataset 1 and Feed B with Dataset 2; other
          combinations are what-if estimates. All profiles can use either feed.
          The same fractions apply to each hydrocarbon, with a + b ≤ 1.
        </p>
        <p>
          Dataset 2 shift accounts for the increase in dry gas flow as CO
          reacts. With dry CO mole fractions of 0.123 at inlet and 0.0282 at
          outlet:
        </p>
        <FormulaBlock name="Dataset 2 shift conversion">
          s = (0.123 − 0.0282) / [0.123 × (1 + 0.0282)]
        </FormulaBlock>
        <p>
          This assumes shift only, with no intervening gas addition or removal.
          The supplied data have carbon-balance differences; Dataset 3 also has
          an unresolved shift-flow basis. Treat these profiles as estimates
          pending confirmation of the source measurements.
        </p>
      </ManualSection>
      <ManualSection title="Standard gas conditions">
        <p>
          Sm³ uses 15 °C (288.15 K), 101.325 kPa absolute and ideal gas
          behaviour (Z = 1). R = 8.31446261815324 kPa·m³/(kmol·K). Feed and
          product use the same full-precision molar volume. Actual pipe flows
          must first be converted to this basis.
        </p>
        <FormulaBlock name="Flow conversion">
          <div>Vₘ = ZRT/P</div>
          <div>
            Component kmol/h = feed Sm³/h / Vₘ × component mol% / composition
            total
          </div>
          <div>Product Sm³/h = product kmol/h × Vₘ</div>
        </FormulaBlock>
        <p>
          Mass rates use rounded molecular weights: water 18 kg/kmol and CO₂ 44
          kg/kmol.
        </p>
      </ManualSection>
      <ManualSection title="Scope and references">
        <p>
          Conversion is configured, not predicted from temperature, pressure,
          steam ratio or catalyst condition. Reaction water is not excess steam
          supply, cooling water or fresh makeup. Process CO₂ excludes furnace
          and tail-gas combustion and is not total plant emissions. HC PSA,
          steam generation and CO₂ capture are outside this calculation.
        </p>
        <p>
          Reference data: supplied H2 production workbook, Reactions and Cases
          A/B. Process description:{" "}
          <a
            href="https://www.energy.gov/cmei/fuels/hydrogen-production-natural-gas-reforming"
            target="_blank"
            rel="noreferrer"
          >
            US Department of Energy - Hydrogen Production: Natural Gas Reforming
          </a>
          .
        </p>
      </ManualSection>
    </article>
  );
}
