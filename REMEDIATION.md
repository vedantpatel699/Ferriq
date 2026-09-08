# Ferriq remediation status

Working React application: this directory (`react-app`). Original HTML references remain preserved in `reference/original` and the parent project's `dashboards` directory.

## Implemented

- Indexed furnace features restored. Original quantile bands and threshold horizons match across all nine passes. Already-exceeded reference crossings display zero rather than an unavailable future crossing.
- Overview, watchlist and navigation use the same calculated resources as detail pages. Dataset dates replace fake live freshness. Furnace navigation opens the highest-priority pass.
- Full original datasets, equipment configuration, CSV templates/imports/exports, diagnostic metrics, probe series and engineering manuals restored.
- Blower missing thermodynamic efficiency stays unavailable; bounded suction-temperature fallback is disclosed. The scorecard exposes current/window-average/reference/deviation and per-metric missing/fallback indicators.
- Heater heat-balance/process discrepancy is correctly labelled and closure is visible. Exchanger energy imbalance and membrane synthetic-feed assumptions are disclosed.
- Furnace controls expose all furnaces/passes, display horizons, uncertainty, driver history, thermocouple contributions and original holdout validation.
- Economics exposes all conversion combinations, configuration, detailed streams/byproducts, complete dated price-snapshot imports, scenario save and export. Negative flows and incomplete snapshots are rejected.
- Fixed independently scrolling navigation, mobile menu, chart data tables, keyboard chart controls, custom site-time ranges, validated settings and missing-route handling implemented.
- Versioned static published data plus IndexedDB edits/backups/change log. No external service or database host. See DATABASE.md.
- Current POC Path C palette, restrained copper, locally bundled Plex fonts, neutral chart series, 8 px surfaces and shape-encoded states applied.

## Verification

See QUALITY.md for commands, outcomes and limitations. Pure engineering comparisons preserve original HTML behavior except the explicitly documented furnace bug correction and already-exceeded guard.

## Scope boundaries

The new POC plan is a broader five-sprint roadmap. Canned clean-filter comparison, numerical health-score calibration, stale-tag simulation, a validated Pass 3 what-if effect, and a print-report drawer are not represented as finished capabilities in this audit-remediation build. Existing HTML datasets and model outputs have not been replaced by the plan's illustrative demo numbers. Any future simulated scenario must be clearly distinguished from measured or validated behavior.

The user's explicit React, full-manual and static-database requests supersede the older single-file/no-database and hidden-help/export descriptions in the as-built reference. Working help/export routes are retained; unimplemented Reports/Alerts are absent from navigation.
