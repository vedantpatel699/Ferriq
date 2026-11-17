import { FormulaBlock, ManualSection } from "./ModelPagePrimitives";
export function HydrogenManual() {
  return (
    <article className="reference-manual engineering-manual">
      <h2>Hydrogen Production engineering manual</h2>
      <p>
        Estimate recovered hydrogen, process CO₂ and reaction-water consumption
        from a gas blend. This is a static scenario calculator.
      </p>
      <ManualSection title="Inputs and units">
        <p>
          Each feed has a standard flow in Sm³/h and a dry composition in mol%:
          H₂, N₂, CO, CO₂ and methane through hexane. All three feeds enter the
          reformer. Feed Case A or B and conversion Dataset 1, 2 or 3 can be
          selected independently.
        </p>
        <p>
          Compositions must total 100%. Differences of up to 0.02 percentage
          points are accepted as rounding and normalized in the calculation;
          entered values remain visible. The chemical-gas preset totals 99.99%.
          Negative, missing and nonfinite inputs are rejected, including
          composition inputs for inactive feeds.
        </p>
        <p>
          Conversion settings are fractions of feed hydrocarbon carbon forming
          CO or CO₂, the fraction of shift-inlet CO converted, and PSA hydrogen
          recovery. Reformer fractions must sum to no more than 100%. Remaining
          hydrocarbons pass through unreacted.
        </p>
      </ManualSection>
      <ManualSection title="Standard gas conditions">
        <p>
          Sm³ refers to 15 °C (288.15 K), 101.325 kPa absolute and ideal gas
          behaviour (Z = 1). R = 8.31446261815324 kPa·m³/(kmol·K). The same
          full-precision molar volume is used for feed and product. Actual pipe
          volumes must first be converted to this reference basis.
        </p>
        <FormulaBlock name="Gas flow">
          Vₘ = ZRT/P; component flow = standard feed flow / Vₘ × component mol%
          / composition total
        </FormulaBlock>
      </ManualSection>
      <ManualSection title="Calculations">
        <p>
          For CₙH₂ₙ₊₂, n is the carbon count. Let a be reformer conversion to
          CO, b conversion to CO₂ and s shift CO conversion. The same fractions
          apply to each hydrocarbon.
        </p>
        <FormulaBlock name="Reformer reactions">
          CₙH₂ₙ₊₂ + nH₂O → nCO + (2n + 1)H₂; CₙH₂ₙ₊₂ + 2nH₂O → nCO₂ + (3n + 1)H₂
        </FormulaBlock>
        <FormulaBlock name="Hydrogen generated per mole of hydrocarbon">
          H₂ = a(2n + 1) + b(3n + 1) + nas
        </FormulaBlock>
        <FormulaBlock name="CO₂ and water per mole of hydrocarbon">
          CO₂ generated = n(b + as); H₂O consumed = n(a + 2b + as)
        </FormulaBlock>
        <FormulaBlock name="Shift reaction">
          CO + H₂O → CO₂ + H₂; CO converted = reformer outlet CO × s
        </FormulaBlock>
        <p>
          Calculated reformer outlet component flows become shift inlet flows.
          Incoming feed CO also undergoes shift and consumes one mole of water
          per mole converted. Incoming hydrogen is carried through; nitrogen is
          inert.
        </p>
        <FormulaBlock name="Hydrogen recovery">
          H₂ product = (incoming H₂ + generated H₂) × PSA recovery; product
          Sm³/h = product kmol/h × Vₘ
        </FormulaBlock>
        <FormulaBlock name="CO₂ and water totals">
          Total process CO₂ = incoming CO₂ + generated CO₂; CO₂ t/h = kmol/h ×
          44 / 1000; reaction water t/h = kmol/h × 18 / 1000
        </FormulaBlock>
        <p>
          Molecular weights use the rounded engineering values 44 kg/kmol for
          CO₂ and 18 kg/kmol for water. PSA recovery defaults to 90%; it is not
          hydrogen purity. Per-feed product contributions use the common
          recovery assumption, not separate PSA units.
        </p>
      </ManualSection>
      <ManualSection title="Conversion profiles">
        <p>
          Dataset 1: a = 42.804629%, b = 30.733267%, s = 74.757576%. Dataset 2:
          a = 42.686654%, b = 31.610475%, s = 74.959318%. Dataset 3: a =
          42.675235%, b = 30.416455%, s = 74.797917%. Calculations retain the
          underlying precision.
        </p>
        <p>
          Reformer factors follow CO/CO₂ formation in the reference datasets.
          The formation-minus-disappearance carbon differences are +0.0087,
          +2.1302 and −0.1516 percentage points respectively. These factors are
          supplied estimates, not independently validated plant performance.
        </p>
        <FormulaBlock name="Dataset 2 shift correction">
          s = (yCO,in − yCO,out) / [yCO,in × (1 + yCO,out)] = (0.123 − 0.0282) /
          [0.123 × 1.0282]
        </FormulaBlock>
        <p>
          This replaces the equal-dry-flow estimate of 77.0732%. It assumes
          comparable dry CO analyses and only the shift reaction, with no
          intervening gas additions or removal. Dataset 3 retains its supplied
          shift factor; its reference shift flows repeat Dataset 1 values and
          differ slightly from its reformer outlet. That source basis remains
          unverified.
        </p>
        <p>
          The original pairings are Feed A with Dataset 1 and Feed B with
          Dataset 2. Other combinations are what-if estimates. Dataset 3
          supplies conversion factors only; its incomplete inlet composition is
          not used as a feed preset.
        </p>
      </ManualSection>
      <ManualSection title="Scope and use">
        <p>
          Hydrogenation gas is treated as reformer feed. Its hydrogen
          contribution includes existing H₂ plus H₂ generated from its methane,
          correcting the original final sum that used total gas flow instead.
        </p>
        <p>
          CO₂ generated excludes incoming CO₂; total process CO₂ includes it.
          Neither is whole-plant emissions: furnace firing, tail-gas combustion
          and capture are excluded. Water is chemically consumed water, not
          excess steam supply, cooling water or fresh makeup demand. The
          separate HC PSA and steam-generation reference are excluded.
        </p>
        <p>
          Conversion is configured, not predicted from temperature, pressure,
          steam ratio or catalyst condition. No live plant data or trend is
          connected. Save scenario stores inputs in this browser only.
          Recalculate applies edits; restore actions reload the chosen presets.
        </p>
      </ManualSection>
      <ManualSection title="Sources">
        <ul>
          <li>
            Client-supplied hydrogen-production workbook: Reactions and feed
            Cases A/B.
          </li>
          <li>
            <a
              href="https://www.energy.gov/cmei/fuels/hydrogen-production-natural-gas-reforming"
              target="_blank"
              rel="noreferrer"
            >
              US Department of Energy: natural gas reforming, shift and PSA
            </a>
            . Supports the process sequence, not the numerical conversion
            factors.
          </li>
        </ul>
      </ManualSection>
    </article>
  );
}
