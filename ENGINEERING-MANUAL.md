# Ferriq engineering manual

Inputs, calculations and trends for the six models.

## Air Blower

Estimate motor input power and compression efficiency; track bearing condition and flow loss against a reference period.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Timestamp; motor current for each train | date/time; A | Select the running train and calculate power. |
| Suction / discharge pressure for each train | kPaa / kPag | Calculate absolute pressure ratio and pressure rise. |
| Total air flow; suction and discharge gas temperature | Nm³/h; °C | Flow comparison and thermodynamic efficiency. Both temperatures are needed. |
| Vibration; bearing temperature for each train | mm/s RMS; °C | Condition alerts and recent trends. |
| Bypass opening; filter differential pressure; pressure setpoint | % open; bar; kPag | Operating conditions and baseline eligibility. |
| Voltage, power-factor method, k, atmosphere, limits | Configuration | Use values for the installed machine. |

### Calculations

**Pressure:** P₁ = suction / 100; P₂ = discharge / 100 + Pₐₜₘ; r = P₂ / P₁

Pressures in bar absolute; ΔP = P₂ − P₁.

**Motor input:** Pₑ = √3 × V × I × PF / 1000

kW. PF is interpolated from the motor table or fixed. This is electrical input, not shaft power. Total power sums both running motors; shared flow is not assigned to one train when both run.

**Isentropic efficiency:** ηₛ = 100 × T₁ × [r^((k−1)/k) − 1] / (T₂ − T₁)

Temperatures in kelvin. Ideal-gas estimate using compatible inlet/outlet measurements.

**Polytropic efficiency:** ηₚ = 100 × [(k−1)/k] × ln(r) / ln(T₂/T₁)

Requires positive absolute pressures and a temperature rise. Results above 100% require data review.

**Flow loss:** Qexpected = a + bI; loss = max(0, 100 × (Qexpected − Q) / Qexpected)

a and b are least-squares fits for each train. The initial configured period is assumed healthy. Comparisons begin after that period and require complete inputs within its observed current and pressure-ratio range; constant speed is assumed.

**Bearing and vibration trend:** slope = Σ[(t − t̄)(x − x̄)] / Σ(t − t̄)²

Up to seven finite, fresh observations from the same train within seven days. Bearing days to advisory = (limit − temperature) / positive slope.

**Operating deviation:** D = 100 × √[(δQ² + δr² + (bypass/100)²) / 3]

Fractional deviations from design flow and pressure ratio. Informational only; no axial-force or failure prediction.

**Normal-flow reference:** Qₙ = (mass flow / molecular weight) × 22.414

kg/h and kg/kmol give Nm³/h at 0 °C and 101.325 kPa. 26,665 / 29 gives about 20,609 Nm³/h; match the meter's wet/dry basis.

**Flow-pressure indicator:** Index power = Qₙ × ΔP / 36; index = 100 × index power / Pₑ

Legacy screening index using normal flow. It is not compressor gas power or thermodynamic efficiency.

### Useful trends

- Measured and expected flow, with flow-loss percentage.
- Motor input power, pressure rise and thermodynamic efficiency at comparable loads.
- Bearing temperature and vibration against configured limits; filter pressure drop and bypass opening.

### Assumptions and limits

- Automatic selection evaluates one train; if both run, it selects the higher-current train. Total electrical input sums running motors. Shared flow is not allocated to an individual train when both run or the other current is missing.
- The reference period is assumed healthy. Bypass and filter checks alone do not prove comparable speed, gas conditions or load; no current or pressure-ratio extrapolation is used, and speed is assumed constant.
- Motor PF interpolation assumes the supplied motor at steady operation and rated voltage. Outside the table, endpoint PF is held; startup power is not represented.
- Bearing alerts and trend projections do not predict remaining life. Direct axial-position or thrust-bearing measurements are needed for thrust assessment.
- Thresholds are configurable demonstration values, not certified ISO zones or shutdown settings. A bounded held suction temperature is labelled; simulated signals do not establish actual efficiency or health.

### Sources

- [NASA Glenn: compressor thermodynamics](https://www.grc.nasa.gov/www/k-12/airplane/compth.html)
- [NIST: linear least squares](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)
- [ISO 20816-3: vibration evaluation scope](https://www.iso.org/standard/78311.html)
- Supplied blower and motor datasheets: design points and power-factor table

## Fired Heater

Estimate absorbed heat and fuel efficiency, compare the process-side duty, and track combustion losses.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Timestamp; fuel mass flow | date/time; kg/s | Fuel heat input and trends. |
| Fuel composition and LHV | Mole fractions; MJ/kg | Select a saved fuel or enter a custom blend in Configuration. |
| Fuel, combustion-air and stack temperature | °C | Sensible heat and stack loss. |
| Stack oxygen | vol% wet | Combustion-air balance, matching the supplied heater example. |
| Process flow, heat capacity and inlet/outlet temperature | kg/s; kJ/(kg·K); °C | Optional independent process-side duty. |
| Bridgewall temperatures | °C | Average available readings and compare with configured limits. |
| Reference temperature, radiation loss and design duty | °C; %; kW | Heat-balance assumptions. |

### Calculations

**Fuel blend:** MW = ΣxᵢMWᵢ; LHV = ΣwᵢLHVᵢ

Custom mole fractions are normalized; mass fractions wᵢ follow from molecular weights.

**Combustion air:** O₂excess = y × nwet,stoich / [1 − y × (1 + N₂/O₂air)]

y is wet oxygen fraction. Complete combustion sets CO₂, water and stoichiometric oxygen; air uses 21% O₂ and 79% N₂ by volume. Flue mass = fuel + air.

**Heat balance:** Qabsorbed = ṁfuel × LHV + Qfuel,sensible + Qair,sensible − Qstack − Qradiation

kW with LHV in kJ/kg. Each sensible term is ṁCp(T − Treference). Radiation is a configured fraction of fuel LHV input.

**Efficiency:** ηbalance = 100 × Qabsorbed / QLHV; Qprocess = ṁprocess Cp ΔT

Process efficiency = 100 × Qprocess / QLHV. Closure = 100 × |Qabsorbed − Qprocess| / QLHV.

**Loss estimate:** ηloss = 100 − dry-gas loss − moisture loss − radiation loss − unaccounted loss

Separate simplified estimate using constant heat capacities. Excess air = 100 × (actual air / stoichiometric air − 1), using the same wet-oxygen composition balance. This is not a full PTC 4 test.

### Useful trends

- Absorbed and process-side duty versus design, with closure discrepancy.
- Efficiency alongside stack temperature and oxygen to distinguish changes in heat loss and excess air.
- Fuel input, combustion-air flow, dry-gas/moisture losses and bridgewall temperature.

### Assumptions and limits

- Complete combustion, constant heat capacities and fixed heat-loss assumptions. CO, SO₂, air leakage and steam-injection enthalpy are not explicitly resolved.
- Do not enter dry-basis oxygen as wet-basis oxygen. The simplified loss estimate uses a different approximation and will not exactly match the composition balance.
- Process duty assumes sensible heating with the entered Cp; phase change requires an enthalpy-based model. Alerts use configured limits, not universal API or ASME thresholds.

### Sources

- Supplied Furnace Heat and Material Balances workbook and Furnace efficiency example: wet oxygen and heat-balance structure
- [ASME PTC 4: fired steam-generator test framework, not certification of this simplified calculation](https://www.asme.org/codes-standards/find-codes-standards/fired-steam-generators/2013/pdf)

## Shell & Tube Exchanger

Compare heat duty with design and track overall heat transfer, fouling resistance and effectiveness.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Timestamp; hot and cold inlet/outlet temperatures | date/time; °C | Four temperatures for duty and temperature driving force. |
| Hot and cold mass flow and heat capacity | kg/h; kJ/(kg·K) | Both stream duties and heat-capacity rates. |
| Shell and tube differential pressure | bar | Optional measured pressure drops; retained in results. |
| Shell passes, heat-transfer area, clean U and design duty | count; m²; W/(m²·K); MW | Configuration for correction factor and reference comparisons. |

### Calculations

**Duty:** Qhot = ṁhot Cp,hot(Th,in − Th,out)/3600; Qcold = ṁcold Cp,cold(Tc,out − Tc,in)/3600

kW. Qavg is their mean; imbalance = 100 × |Qhot − Qcold| / |Qavg|.

**Temperature driving force:** LMTD = (ΔT₁ − ΔT₂) / ln(ΔT₁/ΔT₂)

ΔT₁ = Th,in − Tc,out; ΔT₂ = Th,out − Tc,in. Equal end differences use that common difference.

**Pass correction:** P = (Tc,out − Tc,in)/(Th,in − Tc,in); R = (Th,in − Th,out)/(Tc,out − Tc,in)

The N-shell-pass relation supplies F(P,R,N). Effective driving force = F × LMTD.

**Heat transfer and fouling:** U = 1000 × Qavg / (A × F × LMTD); Rf = 1/U − 1/Uclean

Rf is displayed in 10⁻⁴ m²·K/W. Negative values mean performance exceeds the chosen clean reference.

**Effectiveness and design comparison:** ε = 100 × Qavg / [Cmin(Th,in − Tc,in)]

C = ṁCp/3600 in kW/K. Duty deviation = 100 × (Qavg,MW − Qdesign)/Qdesign.

### Useful trends

- Average duty versus design and hot/cold duties to check balance.
- Overall U and fouling resistance at comparable flow rates.
- Effectiveness, LMTD, correction factor and both end approaches.

### Assumptions and limits

- Single-phase sensible heat with constant Cp. The implemented arrangement is N shell passes with the corresponding even-tube-pass correction, not arbitrary exchanger geometry.
- Separate shell-side and tube-side film coefficients are not calculated. They require geometry, fluid properties and suitable correlations.
- Invalid terminal temperatures or an undefined correction factor suppress U and fouling results. Low U alone does not establish fouling; first check flows, temperatures and balance.

### Sources

- Supplied Heat Exchanger workbook: duty, effectiveness and pass arrangements
- Bowman, Mueller and Nagle (1940): Mean Temperature Difference in Design, N-shell-pass correction

## Hydrogen Membrane

Track hydrogen recovery, permeate purity, feed pressure and the feed-to-non-permeate flow ratio.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Timestamp; feed and permeate flow | date/time; Nm³/h | Hydrogen recovery and flow balance. |
| Non-permeate flow | Nm³/h | Flow ratio; derived as feed minus permeate if absent. |
| Feed and permeate H₂ content | vol% | Separate online analyzer and laboratory readings. |
| Feed pressure | kPag | Compare with the design pressure. |
| Design values and condition limits | Configuration | Recovery, purity, flow ratio and pressure references. |

### Calculations

**Hydrogen recovery:** Recovery = 100 × (Qpermeate × yH₂,permeate) / (Qfeed × yH₂,feed)

Online and lab cases use their respective compositions. All flows must share the same reference conditions.

**Purity and flow ratio:** Purity = permeate H₂%; ratio = Qfeed / Qnon-permeate

Purity is an input measurement, not a predicted membrane composition.

**Pressure deviation:** Deviation = 100 × (Pfeed − Pdesign) / Pdesign

Gauge-pressure comparison; the alert checks absolute percentage deviation.

### Useful trends

- Recovery and purity together to show the recovery/purity trade-off.
- Feed H₂ and feed pressure alongside recovery changes.
- Feed, permeate and non-permeate flows; total/non-permeate ratio against its limit.
- Online and lab results to check analyzer disagreement at matched sample times.

### Assumptions and limits

- If the whole dataset lacks online feed H₂, a labelled synthetic trace is interpolated from lab samples. It is not an online measurement. Individual missing online values can use the lab value.
- Lab recovery still uses measured flow inputs; it is not independent verification of all instruments. Recovery above 100% or a negative flow balance requires input review.
- This is a material-balance monitor, not a membrane transport, remaining-life or failure-probability model.

### Sources

- Supplied Membrane Performance workbook: hydrogen balance, purity, pressure and flow-ratio requirements

## Furnace Skin Temperature

Project when the hottest thermocouple in each pass may reach 475 °C and show the temperature history behind that projection.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Timestamp and each mapped skin thermocouple | date/time; °C | Current maximum and recent temperature trend for each pass. |
| Available pass flows and process drivers | Units defined in the supplied model bundle | Model features and the Pass 3 flow-split scenario. |
| Furnace/pass mapping, sampling interval and trained models | Published model bundle | Defines available thermocouples, feature names and validation results. |

### Calculations

**Temperature trajectory:** T(d) = Tnow + recent slope × d

The central projection fits temperature against actual timestamps in the latest 30 days. Missing samples retain their time gaps. It is separate from the XGBoost prediction.

**Uncertainty display:** Trained-horizon P10, P50 and P90 = base score + sum of tree outputs

Trees run once at the bundled training horizon. Their quantiles are reported per thermocouple, separately from the unbounded linear trend. No calibrated pass-maximum or long-range interval is claimed.

**Pass maximum and crossing:** Tpass(d) = max(Tthermocouples(d))

Interpolate the first crossing of 475 °C. A flat/falling trajectory may have no crossing. Longer extrapolations are labelled separately.

**Current status:** Alarm: T ≥ 470 °C or crossing < 24 h; advisory: T ≥ 460 °C or crossing < 72 h

These are review thresholds. The requested forecast target remains 475 °C.

**Flow-split scenario:** Pass 3 split = 100 × Q₃ / ΣQpass

Run scenario applies a simulated response to the baseline. The slider alone does not rerun the scenario.

### Useful trends

- Each pass's hottest measured temperature and projected trajectory against 475 °C.
- The thermocouple driving the pass maximum and the upper/lower projection band.
- Baseline versus the applied Pass 3 scenario, with its assumptions and model-support label.

### Assumptions and limits

- Holdout accuracy describes the trained prediction horizon, not the full multi-year trend extrapolation. The internal search extends up to 2,555 days and is not a validated service-life forecast.
- Projection starts at the last available pass observation. Its age relative to the dataset end and any missing thermocouples are disclosed. A projected crossing is not evidence of future operating conditions.
- Only mapped thermocouples contribute. An unavailable or unmapped sensor cannot establish a pass is safe.
- The flow-split response and extra scenario uncertainty are assumptions, not a plant-validated causal effect. Simulated inputs do not add validation evidence.

### Sources

- Supplied furnace skin-temperature workbook and published model holdout results
- [XGBoost: quantile regression](https://xgboost.readthedocs.io/en/release_3.2.0/python/examples/quantile_regression.html)
- [NIST: linear least squares](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)

## Crude to Profit

Estimate annual product sales, crude purchases, gross margin and margin after configured operating costs for the selected feed, technologies and prices.

### Inputs and units

| Input | Unit | Use |
|---|---|---|
| Crude feed rates | m³/h | Blend the five workbook crudes. |
| Residue technology | None / LC Finer / Delayed Coker | Treat vacuum residue or retain it unpriced. |
| Gas-oil technology | None / Hydrocracker / FCC | Treat straight-run and eligible converted gas oils once. |
| Price case | Low / High / Live market | C$/m³ feed and product prices; dated sources appear in Price snapshot. |
| Yields, densities, cut points and coker carbon residue | Stored assumptions | Convert feeds into product volumes; assumptions are not live plant measurements. |

### Calculations

**Primary split:** Cut flow = crude flow × volume yield / 100

Calculate blend shares, barrel flow and sulfur mass. VGO is the sum of its light, medium and heavy cuts.

**Residue conversion:** Product mass = residue mass × weight yield / 100; volume = mass / density

LC Finer uses the workbook split. Delayed coking uses feed carbon residue (CCR).

**Delayed coker:** Gas = 7.80 + 0.144CCR; naphtha = 11.29 + 0.343CCR; coke = 1.60CCR

wt%. Gas oil is the remainder to 100%; it remains one pool rather than invented diesel/VGO subcuts.

**Gas-oil conversion:** Pool = straight-run VGO + converted gas oil + heavy light-stream tails

Hydrocracker uses the workbook volume yields. FCC uses the Grace 75 wt% conversion case; vacuum residue does not feed FCC directly.

**Economics:** Hourly margin = Σ(product volume × price) − Σ(crude volume × price)

Annual gross margin = hourly margin × 24 × 330 / 1,000,000 in million C$/year. Gross margin is retained separately.

**Operating costs:** Annual variable cost = consumption/h × CAD/unit × 7,920; or consumption/m³ feed × feed m³/h × CAD/unit × 7,920

Electricity: kWh; steam: t; natural gas: GJ on the same heating-value basis as its rate; chemicals: kg. Maintenance is fixed CAD/year or CAD/m³ feed × annual feed. Each category uses one selected basis; fixed annual budgets are not multiplied by operating hours.

**Margin after configured OPEX:** Annual margin after OPEX = annual sales − annual crude purchases − annual configured OPEX

Partial operating margin, not net profit. All values are CAD. Costs are plant totals with no technology allocation. Enter net purchased consumption once; do not duplicate purchased steam and its boiler fuel. Zero defaults are unconfigured, not evidence of zero expense.

### Useful trends

- Reconcile sales minus crude purchases minus configured OPEX for each price case.
- Compare Low, High and Live market annual estimates for the same feed and routing.
- Compare product volumes and sales contribution across technology choices.
- Review price observation dates, cached sources and pricing proxies before comparing scenarios. The page is a scenario calculator, not a historical revenue forecast.

### Assumptions and limits

- Four technologies form two independent selections, giving nine routing combinations including bypass. Feed is counted once and no inter-unit recycle is modelled.
- Grace FCC yields are 2.2% dry gas, 13.3% LPG, 51.9% gasoline, 16.7% LCO, 8.6% bottoms and 7.1% coke. The reported 0.2% gap is unallocated, not saleable product.
- Client product headings are retained: FCC gasoline uses Naphtha, LCO uses Diesel, and bottoms uses UCO pricing proxies. These are not certified finished products.
- Coke, dry gas and held residue have no sales credit. Configured electricity, steam, natural gas, chemicals and maintenance are deducted once after gross margin. Hydrogen, unconfigured costs, capital, depreciation, financing and taxes are excluded. Fixed yields and densities do not replace a refinery simulation.
- Low and High pair their respective crude and product prices; they are not guaranteed worst/best margins. Live uses the latest published observations and derived prices, not executable quotes.
- The data were obtained from open resources. Client workbook assumptions and separately sourced yield cases are identified above.

### Sources

- Client Crude to Profit Rev 1 workbook: feed, product headings, fixed prices and annualization
- [Grace: Strategies for Maximizing FCC Light Cycle Oil, Table 1, printed p.48](https://grace.com/content/dam/grace-site/english/grace-publications/Grace-The-Essential-Articles-Vol-1_WEB.pdf#page=49)
- Price snapshot: observation dates and individual pricing sources
