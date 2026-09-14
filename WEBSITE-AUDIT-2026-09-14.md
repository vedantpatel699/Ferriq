# Website audit - 14 September 2026

The six dashboards and supporting routes pass the tested workflows. This sweep found and corrected usability, export and performance defects. Numerical agreement is strong within the tested cases; it is not independent validation of the physical models.

## Corrections in this release

| Finding | Correction and evidence |
| --- | --- |
| Mobile navigation left focus on a link inside the closed menu. Browser Back also lacked destination focus. | Focus moves to the main content after navigation. Each route now sets a descriptive browser title. Keyboard and Back regression tests pass. |
| All six dashboards overflowed at 320 CSS pixels. Time controls, furnace selections and economics fields imposed minimum widths. | Controls wrap, selections fit their container, and narrow economics grids use one column. Both the document and main content pass width assertions on all six pages. Wide data tables retain their own scroll region. |
| The fixed mobile Menu button covered text after scrolling. | A separate 56 px area keeps the scrolling content below the menu. A geometry assertion checks that they do not overlap. |
| CSV text beginning with a minus sign or whitespace followed by a formula marker could be evaluated by spreadsheet software. | Formula-like strings receive a protective apostrophe, including headers. Actual numeric measurements remain numeric. Tests cover negative numbers, formula strings, quotes, commas and multiline notes. |
| The blower rolling average scanned every row for each plotted observation. At the 50,000-row import limit this could require billions of comparisons. | A chronological sliding window calculates the same inclusive seven-day mean in linear time. Tests cover repeated timestamps, boundaries, gaps, invalid readings and 50,000 observations. This is not a full browser performance benchmark for a 50,000-row workspace. |
| Price publication time discarded its timezone offset but was labelled UTC. The live snapshot had a -06:00 offset. | The display converts to UTC before formatting. Regression example: 13:32:26 -06:00 displays as 19:32:26 UTC. Pricing amounts and API methods are unchanged. |

## Verification

- 81 unit tests pass across 12 files.
- 106 desktop/tablet browser checks pass. The final mobile menu spacing adjustment also received the 18 affected browser checks; CI runs the full suite again for publication.
- Browser checks cover 14 routes, navigation, missing-route recovery, failed-load retry, settings save/reset, multi-tab conflicts, atomic backup restoration, CSV import, engineering manuals, report preview/PDF, predictor scenarios, all nine conversion combinations and unavailable/incomplete prices.
- Automated accessibility scans found no serious or critical violations under the selected WCAG 2 A/AA and 2.1 AA rules on the tested default pages. Selected open dialogs and reports are also checked. This is not a claim of full accessibility conformance.
- Numerical parity: 162 Python/TypeScript economics cases, 49,991 comparisons, plus the Grace source fixture checks. Four price-refresh tests pass. Historical HTML comparisons pass 31,973 checks; these retain the historical workbook function separately from the new routing model. Blower historical coverage is representative pure functions, not complete batch equivalence.
- Production build passes. Lint has no errors and three existing WorkspaceContext warnings. Production dependency audit reports zero known vulnerabilities on the audit date; this is not a penetration test.
- Desktop blower and FCC views and mobile economics screenshots were inspected. Small-screen reflow was checked at 320 and 390 CSS pixels. Real browser 200% zoom, assistive-technology sessions and real iOS/Android devices were not tested.
- Live GitHub publication run 34887480945 succeeded. The price snapshot read during this audit reported a successful refresh on 14 September at 19:32:26 UTC. Source observation dates can still be older than publication; this check does not independently verify every upstream price.

## Next work, in priority order

### 1. Isolate loading failures and reduce initial load

`src/lib/WorkspaceContext.tsx` waits for both the workspace and the furnace model before rendering any route. A simulated 503 for the furnace model prevented Crude to Profit from opening, even though its own data were available. The retry screen works, but it cannot recover while the model remains unavailable.

Load the furnace model independently and give the predictor its own error/retry state. Adapt the overview and navigation summaries to represent unavailable predictor data explicitly. Load chart-heavy page code on demand. The current main JavaScript is approximately 1.31 MB uncompressed / 416 KB gzip, and the furnace JSON is 3.47 MB uncompressed. No throttled-network timing was measured in this sweep.

### 2. Offer read-only access when browser storage is unavailable

Disabling IndexedDB in a fresh browser context also prevented the website from opening. Allow the published reference workspace to load with a clear read-only notice, while disabling local save/restore actions. Do not silently replace previously loaded local edits with published defaults when storage fails mid-session. Add quota-failure and recovery checks to this work.

### 3. Harden data loading and stale-publication handling

The initial published payload and stored local resources are trusted on read; import/save paths have validation. Add schema validation and an application error boundary so malformed data produce a useful recovery screen instead of a render failure. Add an explicit overdue-publication warning based on an agreed refresh interval; current wording and source dates disclose lag but do not enforce such an interval.

### 4. Validate the process assumptions with the client

Keep these distinctions visible in manuals and reports:

- Annual sales revenue and the workbook-style annual gross margin are different. Gross margin subtracts crude cost, not operating cost, capital cost or financing. Low and High are the client's paired price cases, not statistical confidence bounds.
- Grace FCC yields represent one pilot-plant case. Mapping gasoline to Naphtha, LCO to Diesel and bottoms to UCO preserves client reporting categories but does not establish equivalent cut quality or sale specifications. Density and price mappings remain assumptions. The source's 0.2 wt% closure difference stays unallocated and unpriced.
- Coker yields depend on an assumed CCR; the whole coker gas-oil pool enters the selected downstream unit. Feed pretreatment, contaminants and unit capacity are not qualified by the routing selector.
- Fixed LC-Finer/hydrocracker yield assumptions and mixed mass/volume bases do not form a complete refinery hydrogen or mass balance. Primary assay totals remain as supplied. Unsold residue stays unpriced.
- Furnace what-if effects are POC simulations. Forecasts beyond the supported short horizon are extrapolations; parity with the original engine does not establish intervention effectiveness or safety.

These need client/feed-specific evidence, not an arbitrary code adjustment to make totals or forecasts look better. The source and workbook audit remains in `CRUDE-WORKBOOK-AUDIT.md`.

### 5. Complete human usability and accessibility validation

Run a short engineer-led session: find the dominant equipment issue, explain the source/age of a metric, compare the baseline, run a predictor scenario, change conversion routing and export a report. Record task completion and misunderstandings. Follow with keyboard-only review of every expanded panel, screen-reader testing, real 200% zoom and Safari/Firefox/mobile-device coverage. Automated checks cannot determine whether engineering users interpret the page correctly.

## Scope and release boundary

No yields, feed routes, price formulas, annualization factors or Python engine logic changed in this audit. Shared data remain published through GitHub; edits remain browser-local. The failure-isolation and engineering-validation items above remain open and are not hidden by passing tests.

Rollback: revert this audit release if navigation, exports or the rolling-average display regress. The preceding production revision is 44fef921aaa8d1b35d3320d2b8d6f1eb88189950.
