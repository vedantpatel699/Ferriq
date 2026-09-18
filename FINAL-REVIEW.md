# Simulated YTD and final review checklist

The review was completed locally. The user subsequently authorized committing this work and pushing to main after relevant checks pass. Builds are reproducible with a fixed as-of date: 17 September 2026 17:00 America/Edmonton. UTC elapsed intervals account for daylight saving time.

## Requirements rechecked

Client correspondence and Phase 1 mapping re-read: furnace/predictor 12 October 2025; exchanger 25 October 2025; blower/membrane 11 February 2026; economics 19/25 August 2026. Example data are reference points, not required fixed operating values. Private email content remains outside project files.

| Model | Required calculation path | Remaining source limitations |
|---|---|---|
| Blower | Electrical power, ideal-gas efficiency, bearing alerts, performance reduction | No actual axial-thrust measurement/geometry; degradation is a baseline screen; site thresholds unverified |
| Heater | Fuel composition, combustion air, heat balance, process efficiency | Constant Cp; separate injection steam and oxygen/argon resolution unverified |
| Exchanger | Selectable shell passes, duty/design, LMTD/F, U, effectiveness, fouling | Individual film coefficients need geometry/properties |
| Membrane | H2 recovery/purity, pressure/composition, flow ratio | Simulation does not validate plant instruments |
| Furnace | Any-pass time to 475°C and trained-horizon predictions | Long trend and what-if causal effects unvalidated |
| Economics | Feed/yield selections, annual revenue, prices and Python | Routing/yield assumptions retained; OPEX 8% is editable planning allowance |

## Work

- [x] Recheck client requirements and preserve missing-evidence limitations.
- [x] Generate repeatable, physically coherent historical inputs; keep invalid cases in tests.
- [x] Verify actual model outputs, YTD/time-window totals, maintenance and forecast boundaries.
- [x] Exercise retained navigation, configuration, import/export, persistence, filters, charts, manuals, scenario and recovery workflows.
- [x] Run checks and document failures and final local readiness.

- User removed Build Report from scope. Component, page actions and dedicated styles removed; browser checks cover its absence. CSV/JSON exports remain.

## Implementation and evidence

- Shared deterministic clock: January 1 through September 17, 2026 at 17:00 Edmonton. Equipment hourly (6,233 rows/model), furnace four-hour (1,559 rows/furnace), economics daily intervals with exact partial-interval clipping. No wall-clock or random dependence.
- Blower load, pressure and temperature are linked by ideal-gas efficiency; flow loss, filter resistance and mechanical signals track simulated wear. Maintenance resets wear after 100 and 200 days. Degradation remains a reference-baseline estimate.
- Heater process outlet temperature follows the calculated available duty. Exchanger outlets share equal hot/cold duty and solve for clean-to-fouled U without invalid F factors. Membrane feed/permeate/nonpermeate and hydrogen flows close.
- Simulated economics calls the actual routing/yield/price/OPEX engine. Integrated margin equals sales less crude cost less OPEX; 330/365 availability is allocated uniformly. No utility costs are added on top of percentage OPEX. Daily prices are assumptions, separate from the market snapshot.
- Equipment averages, tables and exports use the selected observation window. Furnace history filtering is independent of the projection horizon; forecasts begin after the last observation.
- Fixed furnace trained-feature aliases (tc_now, tc_7d_mean, tc_velocity_c_per_d), seven-day lag velocity and rolling-window boundary to match train.py. Long-range regression remains separate. Missing model drivers are listed, never silently replaced with zero.
- Parity harness now uses the original membrane batch sorting and whole-dataset fallback rule; mixed online/missing fixtures remain separate from the default simulation.
- Build Report component/actions/styles removed at the user's request. CSV/JSON export and backup remain.

## Remaining evidence limits

The trained furnace models request pass flow, steam, crossover/outlet/inlet temperatures and other furnace-specific drivers absent from the exported reference history. Simulation provides thermal history and the existing display drivers, but does not invent complete plant relationships. Missing-value inference is visible and unverified. Original holdout metrics apply to the original training data, not this simulated history. This prevents claiming complete furnace prediction validation or full client compliance. Long-range projections and what-if interventions also remain unvalidated.

Other source-dependent limits remain in Phase 1: thrust is a proxy; operating limits need site confirmation; heater assumptions and exchanger film coefficients lack inputs; economics yields and OPEX are estimates. No new alarm thresholds were introduced.

## Validation record

- Final unit suite: 121 tests passed, including the furnace seven-day feature regression.
- Python checks: blower parity, 175 refinery cases / 59,584 comparisons and six Python tests passed. No Python engine changes in this phase.
- Final legacy/corrected-path comparison: six suites passed, 394,833 comparisons. Known intentional engineering corrections are tested independently rather than asserted equal to legacy defects.
- Build and type checking passed. Deterministic workspace revision dfe263584486 repeated across builds.
- Lint: zero errors, eight existing React warnings. Build retains existing large-chunk warnings. Diff whitespace check passed.
- Full browser sweep: 146 desktop/tablet cases exercised, including navigation, serious/critical accessibility, 320-pixel layout, data recovery, settings and price snapshots. Obsolete expectations were corrected. Loading timeouts under four concurrent workers were rerun with two workers; affected workflows passed. Additional model-import persistence checks passed on both viewports.
- Final affected workflow run: 42 passed; two stale manual-source assertions were subsequently corrected to the actual NASA reference and rerun with all six manuals: 14/14 passed.

## Readiness

The local demo supports review of all six interfaces, coherent YTD examples and financial reconciliation. Full engineering readiness is not claimed: furnace missing-driver inference and long-range/intervention accuracy remain unverified. Complete operating-driver inputs and validation evidence are needed before accepting those predictions. The review itself made no deployment. A subsequent user instruction authorizes a normal push to main after checks; that push triggers the existing GitHub Pages workflow.

## Authorized publication checks

Final clean run: 121 unit tests, Python parity (175 refinery cases / 59,584 comparisons plus blower parity), six Python tests, and all 148 desktop/tablet browser tests passed. Prior final build, type checking, six calculation comparison suites, lint and whitespace checks passed. Eight existing lint warnings and existing bundle-size warnings remain. Remote main matched the starting commit when checked; no unrelated work or private client emails are included.
