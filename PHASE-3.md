# Phase 3 submission checklist

Scope: six offline Python engines, provisional common AVEVA envelope, standalone examples/parity tests and rendered engineering manual. Reuse Phase 1 mapping and FINAL-REVIEW.md. Build Report remains removed. No email is sent. Push to main and its automatic Pages deployment are authorized only after relevant checks pass.

- [x] Reuse client-source mapping and latest 121 unit / 148 browser checks.
- [x] Inspect existing Python engines and AVEVA conventions. Only generic adapter examples exist; user approved a provisional schema. Live integration unverified.
- [x] Implement six engines and uniform offline entry points.
- [x] Compare identical inputs, defaults, configuration, invalid inputs, timestamps and projections against TypeScript; save fixtures/report.
- [x] Run examples and verification in an isolated submission folder.
- [x] Reconcile manual, generate PDF, render and inspect all pages.
- [x] Run affected and required checks; review package contents and fetch remote main. Publication verification follows the checkpoint below.

Evidence: PHASE-1.md email dates and requirements; FINAL-REVIEW.md simulation and furnace limitations. Legacy heater/exchanger Python use superseded formulas and cannot be submitted unchanged. Reuse corrected python/air_blower and python/crude_to_profit calculations. Keep private emails/attachments outside repository.

Deployment #89 / run 35296127433 failed at npm test: publishedWorkspace combined full-data validation exceeded 5,000 ms (5,292 ms). Root cause: configuration validation invokes seedEquipment, generating/normalizing full YTD datasets unnecessarily. Extract defaultEquipmentConfig; preserve all validation, assertions and timeout. Final exact-commit workflow success and live primary checks are required.


## Completed implementation and validation

- Submission: six engines, common quality/time envelope, explicit unit-checked tag adapter, packaged defaults/fuel properties/public furnace trees, six examples and expected results. No network/credential adapter is included. Runtime uses Python 3.12+ and tzdata 2026.4.
- Standalone parity: 141 cases (blower 29, heater 24, exchanger 16, membrane 14, furnace 14, economics 44), exact discrete outputs and display strings, raw numeric tolerance 1e-9 relative/absolute. All eight contract/parity test methods passed. Separate folder and fresh environment with only the documented dependency passed every example and test. See submission/sudhakar/verification-report.md.
- Additional corrections found by parity: retain dropped blower-row reasons; missing bypass/controller/filter readings stay unavailable; no spurious capacity alert or thrust proxy from a missing bypass; remove numerical cancellation below 1e-12 in bearing/vibration slopes; align old Python thrust-screening label. Regression coefficients are included in the submission.
- Economics tests cover all nine routes, 0/8/12.5/100% OPEX, legacy itemized costs, replacement without double counting, partial/missing market prices, complete YTD and clipped historical integration. Overlapping submitted financial intervals are rejected.
- Browser: 148/148 desktop/tablet checks passed. Navigation, config validation/recalculation/save/reload, YTD/short windows, charts, tables, exports, manual, predictor scenarios, local backups, settings and report removal are covered.
- Project: 124/124 unit tests; blower Python comparison; 175 existing economics cases/59,584 comparisons; six existing Python tests; 394,833 legacy/corrected-engine comparisons; build passed. Lint: no errors, eight pre-existing React warnings. Existing large JavaScript bundle warning remains.
- Nine-page manual PDF rendered and each page inspected. Missing subscript glyphs were fixed; equations, tables, links and text bounds checked. The PDF and Markdown copy include all six models, simulation, OPEX, Python execution and provisional AVEVA mapping.
- CI now checks submission fixture freshness and runs the standalone suite on Python 3.12. Existing checks/assertions/timeouts remain in force.

## Source-dependent limitations

Phase 1 email mapping remains the source record; no new client engineering requirements have been inferred. No confirmed AVEVA contract was supplied; user approved a provisional schema. Plant alarm thresholds, healthy blower baseline/speed, actual thrust, heater phase-change duty, exchanger detailed geometry, synchronized membrane compositions, long-range/causal furnace prediction, refinery yield/density suitability and pricing proxies remain unverified as described in the manual. These are declared POC limits, not claims of plant validation. Private source emails and attachments remain outside the repository.

## Publication checkpoint

Remote main was fetched and still matched e99ca6880cffc65bb991b4789404eaf1df15c2de. Local checks passed. Commit/push, exact-commit workflow outcome and post-deployment live browser checks will be reported separately after publication; this checklist does not claim deployment success in advance.


Publication follow-up: 8a9afe5 pushed successfully. Run 35299025187 passed the original timeout test and all existing checks, then rejected new fixture freshness because Node 22 and Node 24 generate slightly different floating-point demo inputs (first difference: discharge temperature 67.07131529415886 versus 67.07131529415892 degC). Reproduced locally using Node 22.23.2. Keep the exact fixture-content check and all tests unchanged; pin development/CI to Node 24.15.0 via .node-version, with package engine metadata. The Python engine tolerance is unchanged. The next commit's deployment and live checks must still pass.


Second publication check: 1426a64 pushed successfully; run 35299509045 passed existing checks but found the same last-bit simulation difference on Linux with Node 24.15.0 (87.28771180983392 versus 87.28771180983398 degC). Runtime pinning alone was insufficient. Fixture freshness now uses the original specified 1e-9 absolute/relative numerical contract; defaults/source data, discrete values and display strings remain exact. Added regressions reject meaningful numerical drift, changed alarms, missing/extra outputs, changed display rounding and type changes. No numerical tolerance was increased and no engineering assertion or check was removed.

Validation after the cross-platform comparator correction: 133/133 unit tests passed. All 141 captured cases also passed freshness verification on the reproduced Node 22 runtime, with exact display/discrete comparisons retained. Python implementation and its previously passing parity suite are unchanged.
