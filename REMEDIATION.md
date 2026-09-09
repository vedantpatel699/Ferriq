# Ferriq remediation status

Working React application: this directory (`react-app`). Original HTML references remain preserved in `reference/original` and the parent project's `dashboards` directory.

## Implemented

- Indexed furnace features restored. Original quantile bands and threshold horizons match across all nine passes. Already-exceeded reference crossings display zero rather than an unavailable future crossing.
- Overview, watchlist and navigation use the same calculated resources as detail pages. Dataset dates replace fake live freshness. Overview links identify the highest-priority pass; the direct predictor route opens the Pass 3 POC workspace.
- Full original datasets, equipment configuration, CSV templates/imports/exports, diagnostic metrics, probe series and engineering manuals restored.
- Blower missing thermodynamic efficiency stays unavailable; bounded suction-temperature fallback is disclosed. The scorecard exposes current/window-average/reference/deviation and per-metric missing/fallback indicators.
- Heater heat-balance/process discrepancy is correctly labelled and closure is visible. Exchanger energy imbalance and membrane synthetic-feed assumptions are disclosed.
- Furnace controls expose all furnaces/passes, display horizons, uncertainty, driver history, thermocouple contributions and original holdout validation.
- Economics exposes all conversion combinations, configuration, detailed streams/byproducts, complete dated price-snapshot imports, scenario save and export. Negative flows and incomplete snapshots are rejected.
- Fixed independently scrolling navigation, mobile menu, chart data tables, keyboard chart controls, custom site-time ranges, validated settings and missing-route handling implemented.
- Versioned static published data plus IndexedDB edits/backups/change log. No external service or database host. See DATABASE.md.
- Current POC Path C palette, restrained copper, locally bundled Plex fonts, neutral chart series, 8 px surfaces and shape-encoded states applied.

- Client cleanup: all six vital pages retain their calculation engines and manuals. Equipment settings and model replacement are collapsed under advanced controls; economics opens as a read-only scenario summary until Adjust scenario is expanded.

## Verification

See QUALITY.md for commands, outcomes and limitations. Pure engineering comparisons preserve original HTML behavior except the explicitly documented furnace bug correction and already-exceeded guard.

## Scope boundaries

All five POC delivery areas are implemented: surface refresh; blower scorecard with per-metric Missing/Stale/Fallback handling and disclosed health-index rubric; elapsed-time clean-filter comparison; one Pass 3 flow-split simulation with explicit uncertainty; and the report drawer with browser PDF export. `DEMO.md` contains the truth sheet, walkthrough, environment checks and per-flow acceptance criteria.

The clean-filter baseline and optional hourly blower walkthrough datasets are simulations. The numerical health index is an uncalibrated, disclosed rubric. The Pass 3 effect is an explicitly labelled canned response layered over the unchanged original forecast, not an intervention-validated model. Historical holdout MAE and the 24 h validation boundary refer to forecast validation, not causal flow-split sensitivity. Original published measurements are preserved; illustrative plan numbers are not substituted for them. Calibration, plant intervention validation, shared remote writes, scenario libraries and DOCX/report persistence remain outside this static POC.

The user's explicit React, full-manual and static-database requests supersede the older single-file/no-database and hidden-help/export descriptions in the as-built reference. Working help/export routes are retained; unimplemented Reports/Alerts are absent from navigation.
