# Phase 1 checklist

Phase 1 implementation and checks are complete. Publication to main was authorized after validation.

## Requirements and evidence

Client emails re-read in Gmail on 17 September 2026. Attachments are in `../client-review-private`, outside the repository. Earlier findings: `ENGINEERING-REVIEW.md`.

| Model | Source | Inputs and units | Calculations / outputs | Evidence gaps |
|---|---|---|---|---|
| Blower | 11 Feb 2026; Blower.xlsx | A, V, kPaa suction, kPag discharge, Nm³/h, °C, mm/s | Electrical kW; ideal-gas efficiency %; pressure ratio; flow residual %; bearing slope °C/day | No axial geometry or thrust measurement. Reference period is assumed healthy; no speed tag. Thresholds require site confirmation. |
| Heater | 12 Oct 2025 thread, fuel/air follow-up; supplied heat-balance workbook/PDF | kg/s, °C, wet O₂ vol%, fuel mol fractions | Combustion air kg/s; heat balance kW; efficiency % | Constant Cp omits separate steam/phase-change enthalpy; complete-combustion assumption. |
| Exchanger | 25 Oct 2025; Heat Exchanger.xlsx | kg/h, kJ/(kg K), °C, m², shell passes | Duty MW, LMTD K, F, U W/(m² K), fouling m² K/W, effectiveness % | General N-shell relation only; separate film coefficients need geometry/properties. |
| Membrane | 11 Feb 2026; Membrane Performance.xlsx | Nm³/h on a common basis; H₂ vol%; kPag | Recovery %, purity %, feed pressure/composition, feed/non-permeate ratio | No measured continuous feed composition in original data; simulation must remain labelled. |
| Furnace skin TI | 12 Oct 2025 thread plus 25 Oct updated data | Timestamp, TC °C, trained feature inputs | Per-pass time to 475 °C; trained-horizon quantiles and separate trend projection | Long-range trend is not validated lifetime prediction; intervention effect unvalidated. |
| Crude to Profit | 19/25 Aug 2026; revised workbook | m³/h, yield vol%/wt% with densities, CAD/m³ | Product sales, crude purchases, annual gross margin at 7,920 h/year | Technology/feed suitability and price proxies remain assumptions. |

## Cost boundary

Workbook H51/H52 = H48/H49 product sales minus I40/I41 crude purchases; H54/H55 annualize by 24 × 330 / 1,000,000. Product “cost” cells are selling-price assumptions, not a second expense. No electricity, steam, gas, chemicals or maintenance is already deducted in the implemented economics. Price differentials change purchase/sale prices; they are not utility expenses.

Requested OPEX is a separate plant-level component, applied once after gross margin. Utility/chemical inputs represent net externally purchased consumption. Do not charge internally generated fuel gas/steam again or count the same energy as both purchased steam and boiler fuel. No automatic linkage to equipment dashboards or technology-specific allocation is justified by the sources. Maintenance may be fixed annual CAD or variable CAD/m³ feed. Zero defaults mean unconfigured, not zero actual expense. Profit measure: sales minus crude purchases minus configured OPEX; excludes unconfigured costs, depreciation, financing, taxes and capital expenditure.

## Work and checks

- [x] Locate emails, attachments, implementations and previous findings.
- [x] Blower: require finite fresh baseline inputs, a completed reference period, one running train and observed current/pressure-ratio bounds. Sum electrical input independently; suppress shared-flow indicators when allocation is ambiguous. Fit bearing/vibration slopes to up to seven same-train observations within seven days, excluding missing/stale values. Mirror numerical rules in Python and accept ISO timestamps.
- [x] Furnace: use elapsed timestamps over 30 days, retain gaps, anchor at the last pass observation and disclose missing coverage/age. Compute crossings per thermocouple. Evaluate quantile trees once at their trained horizon, separately from the long-range trend; remove its unsupported band. Reject unordered/duplicate imported predictor timestamps.
- [x] Heater: align excess air and simplified losses with the wet-oxygen balance; include inert feed CO₂ and complete-combustion SO₂ in flue-gas moles. Normalize custom mol fractions and reject invalid fuels/measurements. Exchanger: validate finite physical inputs and retain duty deviation when F is unavailable. Membrane: preserve zero recovery, reject negative/impossible flows, apply configured pressure reference, and restrict synthetic feed composition to bundled demonstrations.
- [x] Economics: separate five OPEX categories with one selected basis each; annual budgets, hourly purchased consumption or feed-specific consumption. Preserve gross margin and expose margin after configured OPEX. Same engine output drives case cards, reconciliation, costs, saved/exported results and report summary. No existing economics trend chart needed a separate calculation update; product quantities remain unchanged.
- [x] Update the six manuals and retain the previous review as historical evidence.

## Validation

- `npm test`: 107 passed, including independent dimensional checks, zero/invalid inputs, train changes, missing measurements, irregular timestamps, fuel composition, OPEX basis switching, legacy scenario compatibility and all nine routing combinations. Includes Python/TypeScript blower batch comparison.
- `npm run test:python`: passed; 171 economics cases / 58,346 comparisons, blower core comparison and six Python unit tests. Revised workbook prices and the documented AA10 correction still reconcile; Grace yield transcription unchanged.
- `npm run test:parity`: passed, 156,806 checks. Compares unchanged legacy outputs only; intentional corrections are listed in the harness and independently tested. Furnace checks validate the replacement calculation, not equivalence to the defective original.
- Production build and TypeScript: passed. Existing large-bundle warning remains.
- Manual/accessibility browser checks: 40 passed across desktop/tablet. Phase 1 browser checks cover OPEX recalculation, save/reload, export, report, invalid input and all nine furnace passes. Final targeted run: six passed (OPEX, all furnace passes and the existing Pass 3 scenario workflow on desktop/tablet), using `playwright.phase1.config.ts`.
- Lint: no errors; eight pre-existing React warnings remain. Whitespace check passed.

## Assumptions and issues for later phases

- OPEX consumption/rates/budgets are not supplied by the client. Zero is explicitly unconfigured. No technology-dependent utility allocation or internal fuel/steam credit is inferred. Operating hours remain the workbook's 7,920/year.
- A blower reference period is assumed healthy, not certified; no speed tag supports speed correction. Pressure ratio/current envelope checks limit comparison but do not establish causal degradation. Site approval of thresholds and actual thrust instrumentation remain missing.
- Python offset-free timestamps retain legacy wall-clock interpretation. Use explicit UTC offsets for elapsed-time studies spanning daylight-saving changes; mixed aware/offset-free batches are rejected. The web application uses the configured Edmonton site convention.
- The furnace's long-range line is a trend projection, not a calibrated forecast or remaining life. Training-horizon validation does not validate a flow-split intervention. Missing thermocouples can hide the actual hottest tube.
- Heater constant-Cp process duty does not include the source example's separate injection-steam enthalpy. Oxygen/argon in supplied fuel compositions is not separately resolved; current combustion treats that combined component as oxygen. No detailed SO₂ heat-capacity/emissions calculation is introduced.
- Exchanger side-specific film coefficients need geometry and fluid properties. Shell-pass selection applies only to the implemented N-shell arrangement. Membrane instruments need matching normal-volume bases and synchronized composition samples.
- Arithmetic window averages are sample averages, not time-weighted energy totals. OPEX does not integrate dashboard demo signals.
- Workbook primary yields and fixed densities are retained, including rounding/non-closure; they are not a rigorous overall refinery mass balance. FCC/coker suitability and product price proxies still need client review.
- The active repository's Python counterparts for blower/economics are updated and tested. Legacy heater/exchanger/membrane/predictor Python delivery outside this checkout is not a newly synchronized six-engine Python release.
- The earlier full-suite failures involving obsolete controls/comparison/report workflows remain recorded in `ENGINEERING-REVIEW.md`; broad UI remediation belongs to later phases. No claim of full application readiness is made.
- Earlier unfinished YTD/demo work in `../react-app` is untouched. Build-generated workspace JSON is excluded from these source changes. Private client files remain outside the repository. Publication is authorized after successful checks; GitHub Pages deploys automatically from main.

## Publication follow-up

- Verified the Phase 1 Pages deployment succeeded and the live page includes Operating costs below Adjust scenario.
- Removed Excel cell references and workbook commentary from the economics overview and report; retained operating hours and cost exclusions.

## Revenue-percentage OPEX follow-up

- User requested one configurable percentage of revenue. Default 8%, derived from Suncor 2025 R&M OS&G / operating revenue (2,439 / 30,671 = 7.95%). This broad operating/marketing/general allowance is not a site-specific estimate or a supported five-category allocation.
- Each pricing case uses its own sales revenue. Percentage mode replaces itemized costs; earlier saved itemized settings are preserved until the user selects percentage mode. New scenarios default to 8%. Save/export/report and Python share the same calculation. Zero is allowed explicitly; values outside 0–100% are rejected.
- Validation: 109 unit tests; 175 Python/TypeScript cases with 59,584 comparisons; production build; desktop/tablet OPEX save, reload, export and report checks passed. Lint has no errors and eight existing warnings.
