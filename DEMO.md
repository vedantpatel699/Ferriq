# Ferriq client walkthrough

## Truth sheet

| Capability | Delivery truth |
| --- | --- |
| Equipment calculations and original reference data | Real ports of all six HTML engines and preserved datasets. Numerical parity is tested; this is not plant certification. |
| Manuals | Original HTML content plus current configuration, status and React-edition notes. |
| Blower POC data | Explicit hourly simulations selected under POC demo data. The default published observations remain unchanged. |
| Clean-filter baseline | Canned simulation dated November 2025. Both A and B use the current configuration. No maintenance verification is claimed. |
| Health index | Visible uncalibrated rubric, not a learned failure probability. Full 30-day POC A is 82 and B is 100; do not quote the design sketch's 91. Missing/stale scored inputs block the index. |
| Data quality | Explicit missing/stale metadata and original engine fallback provenance. Historical dates alone are never called stale. Held readings are excluded from averages, condition alarms and deltas. |
| Furnace forecast | Original hybrid trend and XGBoost quantile-spread forecast. Published holdout metrics are shown, rather than substituted demo metrics. |
| Pass 3 scenario | Assumed POC response to a change in flow share, layered over the original baseline. No causal intervention effect is validated. Observed flow-history range is not a safe operating envelope. |
| Scenario uncertainty | Original P10-P90 spread plus an illustrative allowance growing beyond 24 h. Not a calibrated scenario confidence interval. |
| Reports | Nonmodal drawer, frozen preview, one engineer-note field, visible charts and current measurements, browser Save as PDF. No server or report archive. |
| Database | Common published JSON and versioned browser-local IndexedDB edits. Atomic backup restore, conflict checks, tab updates and history. No shared remote writes or external service. |
| Post-POC | Plant calibration and intervention validation, live historian, automatic market feeds, authentication, remote collaborative editing, scenario libraries and saved reports. |

## 20-minute sequence

1. **0-2 min: scope and data.** Open Ferriq in Chrome at 1440 × 900. Point out Published reference data and Edits saved in this browser. Explain the six original engines and preserved manuals.
2. **2-6 min: trusted asset state.** Open Air Blower → POC demo data → Load current POC demo. The 30-day simulated window shows bearing temperature 71.8 °C, an advisory and index 82. Fallback is marked on affected efficiency metrics. Select Maximum bearing temperature in the scorecard to focus its chart. Open Calculation basis & references for the original formulas and configured limits. Close it. Load stale POC demo: the held bearing value is 3 h old, its state is unreliable and the index is unavailable. Load missing POC demo to show the gap. Reload current POC demo.
3. **6-10 min: comparison.** Select Compare: Off to enable Clean-filter baseline. A is solid/square, B dashed/hollow. Read A/B averages, delta and state change. Show All metrics for stable families. Hover a common point for both actual timestamps and A-minus-B. Open Comparison data and original timestamps to inspect alignment. No interpolation fills unmatched samples.
4. **10-17 min: predictor.** Open Furnace Skin TI Predictor (Heater 1, Pass 3), Forecast. Read Now and the original baseline. Reduce Pass 3 flow split by about 2.5 percentage points. The dirty message confirms nothing is applied yet. Select Run scenario. Read the illustrative 24 h effect and computed crossing delay. Explain the 24 h forecast validation boundary and wider illustrative interval. Move to the far right of the slider to show the unsupported-history warning; reset. The displayed lever is a share of total pass flow, not generic throughput. No plant action is recommended.
5. **17-20 min: handoff.** Return to Air Blower, select Build Report. Add: 'Bearing temperature increase appears isolated; compare against lube-oil maintenance history before next reliability review.' Preview report, inspect source/quality/charts, Export PDF → Save as PDF. Open Database & change log to demonstrate backup and retained resource versions.

## Answers to engineering challenges

- **Which variable changes?** Pass 3 flow divided by the sum of all pass flows, in percent. The POC applies an assumed sensitivity curve. It does not validate redistribution to the other passes.
- **Is the scenario causal or trained?** No. The baseline is the original engine; the scenario is an explicit simulation. Forecast holdout accuracy does not prove intervention sensitivity.
- **Where did the baseline come from?** The bundled November 2025 clean-filter simulation. Its actual timestamps and source are visible; it is not an observed post-maintenance campaign.
- **How are thresholds configured?** Equipment Advanced → Edit engineering configuration exposes the original settings and limits. Save applies validated local changes to calculations; Restore published restores the shared reference. Manuals display the current configuration.
- **Why not the exact numbers on the design sketch?** Sketch values were illustrative. The displayed score is derived from the documented rubric and the scenario delay is calculated from the trajectories. Neither is replaced with a hard-coded result.
- **Can coworkers see my edits?** Visitors see the same published revision. This browser's edits require a reviewed backup publication for cross-device sharing. GitHub Pages has no write server.

## Environment and acceptance checklist

- Use current Chrome, target 1440 × 900; tablet and 390 px navigation are also checked. Fonts are bundled locally.
- Load the site before disconnecting the network. Local saves and calculations continue in the already loaded session. Initial navigation/reload still needs published assets; no offline service worker is claimed.
- Routine input editors start collapsed. Equipment edits are under Advanced → Edit engineering configuration; economics uses Adjust scenario.
- Export any existing local work before choosing a demo dataset. Restore published data after the walkthrough if those local simulations are no longer wanted.
- Flow 1: scorecard, flagged bearing row, visible quality overlay, correct selected chart, missing/stale score unavailable, manuals open.
- Flow 2: A/B curves and delta columns, actual timestamps, no interpolation, consistent selected-window averages.
- Flow 3: one slider, explicit Run, dirty/reset/out-of-range behavior, original baseline unchanged, projected effect and model support visible, validation marker and interval shown.
- Flow 4: nonmodal report, frozen preview, notes, source and quality, chart image, legible browser-print PDF.
- Database: backup/export, validated atomic import, retained versions and cross-tab conflict rejection.
- Release: production build, unit tests, all six parity suites, desktop/tablet browser suite, serious/critical accessibility checks, GitHub quality check and Pages deployment pass.
