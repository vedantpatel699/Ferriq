# Engineering review - 17 September 2026

Phase 1 calculation corrections supersede the historical findings below. See [PHASE-1.md](PHASE-1.md) for current status.

Reviewed baseline: `ed9fccc6b20933d36bc880ea825519c543e15b6c`.

## Requirements coverage

| Model | Requested result | Current coverage |
|---|---|---|
| Air Blower | Power, efficiency, thrust and bearing alerts, performance reduction | Power and ideal-gas efficiency are implemented for one selected train. Bearing thresholds and flow-baseline regression are implemented. Actual thrust assessment is unavailable; operating deviation is informational only. |
| Fired Heater | Python efficiency calculation, generic inputs, fuel selection and combustion air | Heat balance, fuel blends, air/flue flow and process comparison are implemented. The source example uses wet oxygen. Constant-Cp process duty does not reproduce its separate steam-injection enthalpy balance. |
| Shell & Tube | Selectable passes, duty versus design, LMTD, effectiveness, fouling, overall and optional side coefficients | All except separate side coefficients are implemented. The pass setting is shell passes for the implemented N-shell relation, not unrestricted geometry. |
| Membrane | H₂ recovery, purity, feed pressure/composition, total/non-permeate ratio | All four are implemented. Synthetic online feed composition is a demonstration fallback, not a measurement or independently validated ML model. |
| Skin-temperature predictor | Time to 475 °C in any pass, additional furnace data | All nine mapped passes are evaluated. Central trajectories are trend extrapolations; XGBoost supplies the displayed spread. Long-horizon accuracy has not been established. |
| Crude to Profit | Workbook economics, variable feeds, technology yields, price pulls, open-source note | Four technologies in two feed-specific selections; Low/High/Live pricing; annual sales less feed cost on the workbook basis. Current routing and sourced FCC yields intentionally differ from literal spreadsheet outputs. |

The source requirements were checked against the original project emails and downloaded workbook/PDF attachments. Private correspondence and new attachments are excluded from this repository.

## Corrections in this review

- Replaced six manuals with the same structure: inputs, calculations, useful trends, assumptions and sources. Configuration is separate.
- Removed health alarms and coloured health classification from the unvalidated thrust proxy. The numerical index remains available as operating deviation.
- Removed unsupported ISO zone claims from configurable vibration alerts in both TypeScript and Python. ISO 20816-3 is linked as an evaluation framework, not a source for these exact alert settings.
- Corrected the combustion-air function's oxygen description to wet basis, consistent with both its water-containing balance and the supplied PDF. Numerical results are unchanged.
- Renamed the simplified loss-efficiency output and removed API/ASME attribution from arbitrary efficiency/excess-air alert thresholds.
- Renamed lab recovery to lab-composition recovery; flow-meter accuracy is not independently verified by a lab composition sample.

## Verified engineering points

- The motor datasheet contains the five current/PF pairs used by the code. Piecewise interpolation is a reasonable steady-state estimate for that motor. It is not measured power and is unsuitable for motor starting; endpoint clamping outside the table must remain disclosed.
- The blower sheet confirms 93 kPaa inlet, 178 kPaa outlet, 4 °C annual-average inlet, 711 kW train power, 76% polytropic efficiency and 3,580 rpm for the selected reference point. The 711 kW reference is not electrical motor input.
- The ideal-gas conversion of 26,665 kg/h at molecular weight 29 gives about 20,609 Nm³/h. The sheet distinguishes wet weight flow and dry normal-volume conditions; the supplied gas analysis includes water. A dry meter comparison needs consistent moisture correction. The current number is a screening reference, not a certified dry-flow conversion.
- Isentropic and polytropic equations use kelvin and absolute pressures in the main row calculation. Their validity still depends on compatible measurement locations, gas properties and heat-transfer assumptions.
- The supplied heater PDF explicitly specifies wet oxygen. Its principal energy balance matches the implemented structure. The separate loss estimate remains approximate and should not be presented as a formal PTC 4 result.
- The current economics annual value is product sales minus crude purchases, multiplied by 7,920 operating hours. It is gross margin, not net profit. Grace's FCC split is retained with 0.2 wt% unallocated closure rather than hidden normalization.

## Remaining gaps

| Priority | Finding and consequence | Smallest next correction | Files |
|---|---|---|---|
| High | Baseline eligibility accepts missing bypass/filter values as zero. It also lacks training-current bounds, speed/pressure matching and a verified healthy-period selector. A flow residual can be called degradation outside comparable conditions. | Require finite eligibility inputs, bound prediction to the training-current range and identify the reference period as assumed healthy. Mirror the rule in Python. | `src/engineering/catalog.ts`, `python/air_blower/engine.py` |
| High | Bearing/vibration slopes use the latest seven rows across train changes; converting null to Number can turn missing data into zero. | Filter finite numeric values and the same active train before fitting, with an explicit maximum age. | `src/engineering/catalog.ts`, Python batch trend code |
| High | When both blowers run, the higher-current train is paired with shared flow; its power is not total station power. | Reject ambiguous shared-flow efficiency/baseline calculations or supply separate train flow and report summed electrical input. | `src/engineering/blower/calculations.ts`, `src/engineering/catalog.ts`, Python engine |
| High | Furnace trend fitting removes gaps and then assumes a regular cadence. Recursive tree spread is placed around a different central forecast for up to seven years. | Fit against actual timestamps and separate validated-horizon predictions from long-range trend projections. Do not label the latter a calibrated 80% interval. | `src/engineering/furnace/calculations.ts`, predictor page |
| Medium | The heater's loss method applies a simple oxygen/excess-air approximation alongside the wet composition balance. The source PDF also includes steam enthalpy absent from the process-Cp calculation. | Keep the heat-balance method primary. Add explicit oxygen-basis handling and an optional enthalpy/steam balance only if required for the review case. | `src/engineering/heater/calculations.ts`, heater inputs |
| Medium | Separate shell/tube film coefficients and true thrust failure assessment are not implemented. | State unavailable. Add only after receiving the required geometry/properties or direct axial/thrust instrumentation. | Exchanger and blower engines |
| Medium | Legacy Python delivery for heater, exchanger, membrane and predictor is outside the current React repository; the repository directly tests blower and economics Python engines. | Package the reviewed legacy files and add current Python/TypeScript comparisons before describing all six as a single matched Python release. | `python/`, legacy `models/` and predictor training folder |

These gaps are not resolved by filling missing measurements with simulated values. Demonstration data should exercise the interface while retaining its simulation label.

## Validation

- Production build: passed.
- Unit tests: 95 passed.
- Original JavaScript/TypeScript engine comparisons: 31,973 passed. Agreement with the original implementation does not independently validate its assumptions.
- Python checks: blower comparison passed; economics passed 162 cases and 49,991 comparisons; six Python unit tests passed.
- Manual and accessibility checks after the contrast correction: 40 passed across desktop and tablet, including all six manuals at 320 px width.
- Full browser sweep before the contrast correction: 113 passed, 17 failed. Two failures were the corrected blower text contrast. The other failures involved removed blower controls/scorecards, comparison/demo workflows, renamed validation and economics text, configuration navigation, and one desktop settings concurrency test. These require test-contract review and workflow verification before release; they have not been marked as passing.
- The build regenerates published reference JSON from source datasets, changing the checked-in 45-row blower resource to 200 rows. That generated data change is excluded from this documentation review.

Release status: local review changes only. The live website has not been updated by this review.

## Sources checked

- Original project requirements: furnace/predictor, 12 October 2025; exchanger, 25 October 2025; blower/membrane, 11 February 2026; refinery economics, 19 and 25 August 2026.
- Supplied blower workbook embedded motor/blower datasheets; supplied heater workbook and both pages of the heater efficiency PDF; exchanger, membrane and revised crude workbooks.
- [NASA compressor thermodynamics](https://www.grc.nasa.gov/www/k-12/airplane/compth.html).
- [NIST least-squares regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm).
- [ISO 20816-3:2022 scope](https://www.iso.org/standard/78311.html).
- [ASME PTC 4 scope](https://www.asme.org/codes-standards/find-codes-standards/fired-steam-generators/2013/pdf).
- [XGBoost quantile regression example](https://xgboost.readthedocs.io/en/release_3.2.0/python/examples/quantile_regression.html).
