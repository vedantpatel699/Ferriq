# Grace FCC release - 12 September 2026

The active FCC split is transcribed from Grace Table 1 at 75 wt% conversion. Source-fixture checks verify all four source cases, the comparison rule and unallocated 0.2 wt% closure. Python/TypeScript agree across 162 cases (49,991 comparisons); 76 unit tests pass. All 90 desktop/tablet browser checks pass, including source-link and category-table checks. Production build passes. Four market-refresh tests and historical 31,973-comparison regression pass. Three pre-existing lint warnings and bundle-size notice remain.

The source table was visually checked against printed p.48. The full relevant article (pp.46-58) was reviewed for feed, catalyst, recycle and unit-basis differences. Yields are a pilot-plant reference, not a feed-specific validation. Client categories use disclosed product-quality and price mappings. Revert to 0e83a0a if the new source mapping or source/engine parity fails after release.

## Prior verification

# Routing release checks - 10 September 2026

- 76 unit tests, including nine routing combinations, residue/FCC mass accounting, bypass, annualization and invalid saved scenarios.
- 162 Python/TypeScript routing and price cases, 48,155 comparisons; four market-refresh tests.
- Historical HTML comparison: 31,973 comparisons. Crude uses the explicitly retained historical workbook function; the new routing is checked separately.
- 90 desktop/tablet browser checks passed, including all nine routing selections, annual cards, pricing reload/failure, accessibility, five equipment dashboards and persisted workspace controls.
- Production build passes. Existing three WorkspaceContext lint warnings and large-bundle notice remain.
- Current Python copied to the original model folder and supplied as for-sudhakar/routed_engine.py. The old handoff script remains explicitly historical.

Rollback: revert this routing release if the deployed page fails to load, routing inputs do not persist, or Python/page results diverge. Fixed-price and last-good market publication remain available. Prior production commit: 0405698.

## Earlier verification record

# Quality verification

Verified locally on Windows, Node 24 and installed Chrome, 2026-09-09.

| Check | Result |
| --- | --- |
| Production TypeScript/Vite build | Pass |
| Unit tests | 54 passed across 8 files |
| Original HTML numerical comparison | 31,974 comparisons; all six suites passed |
| Full desktop/tablet browser suite | 86 passed |
| POC flows, atomic restore, six-page editing cleanup | Included in the full browser suite |
| WCAG 2 A/AA axe checks | No serious or critical violations on 12 tested routes at both desktop and tablet sizes |
| Lint | No errors; 3 React-development warnings in WorkspaceContext (two Fast Refresh export warnings and asynchronous effect refresh warning) |
| Dependency installation audit | 0 reported vulnerabilities |

Browser coverage includes routes, settings save/reset and shift effects, conflicting edits across tabs, custom ranges, chart controls, native manual dialog, scorecard values, CSV import persistence, backup download, furnace/pass selection and holdout display, invalid economics inputs, fixed sidebar and 390 px mobile navigation. Screenshots were reviewed at desktop, tablet and mobile sizes. Visual review caught and corrected a driver-selection mismatch, retained route scroll position, numeric cell wrapping and logo contrast.

The HTML comparison covers full published heater/exchanger/membrane datasets plus edge cases, representative blower pure functions, twelve complete economics cases and all nine furnace passes over 2,555 forecast days each. All 22,995 central forecast steps match and no P10/P90 band steps differ. This does not establish physical model accuracy or certify operating decisions.

Known delivery limits: GitHub Pages provides shared published data, not shared remote writes. Local backups/imports are explicit actions. The original model's distinct 470 °C measured-status criterion and 475 °C forecast reference remain identified. Source manuals are preserved with current-edition notes. Comparison, explicitly simulated scenario and browser-print reports are implemented; their delivery truth and post-POC boundaries are documented in DEMO.md and REMEDIATION.md.

Vite reports a large main bundle (approximately 1.29 MB before compression); route splitting is a future performance improvement. Build output and node_modules are not committed. No production deployment is claimed by these local checks.

Additional checks cover current/stale/missing blower simulations, 82/100 disclosed score calculation, fallback provenance, elapsed A/B comparison without interpolation, explicit Run/reset/out-of-range scenario behavior, report capture/print, offline-session saves and whole-backup rollback on version conflict. Serious/critical axe checks also cover an applied scenario and the open report drawer. Actual two-page A4 report output was rendered and visually reviewed. Original engine functions are unchanged by the UI cleanup.

## Revised crude workbook and live pricing (2026-09-09)

61 unit tests pass. The Python parity suite passes 72 scenarios / 19,409 comparisons, plus three snapshot failure/recovery tests. The revised workbook reconciles after the documented AA10 correction. Original engine parity passes 31,973 comparisons with its legacy LPG-recovery setting explicitly supplied. The desktop/tablet regression run passed 88 of 90 tests; after fixing the selector label and a test whitespace comparison, all four focused crude-pricing tests pass. The existing three nonblocking workspace lint warnings and large-bundle advisory remain.

The revised source workbook, yield limitations, price provenance and publication behavior are documented in CRUDE-WORKBOOK-AUDIT.md. A real public API fetch returned complete estimates for all five crudes and seven products. Observation dates are displayed separately from snapshot generation time.
