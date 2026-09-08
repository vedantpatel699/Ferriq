# Quality verification

Verified locally on Windows, Node 24 and installed Chrome, 2026-09-08.

| Check | Result |
| --- | --- |
| Production TypeScript/Vite build | Pass |
| Unit tests | 44 passed across 7 files |
| Original HTML numerical comparison | 31,974 comparisons; all six suites passed |
| Full desktop/tablet browser suite | 76 passed |
| Follow-up visual/accessibility suite after driver and scroll fixes | 32 passed |
| WCAG 2 A/AA axe checks | No serious or critical violations on 12 tested routes at both desktop and tablet sizes |
| Lint | No errors; 3 React-development warnings in WorkspaceContext (two Fast Refresh export warnings and asynchronous effect refresh warning) |
| Dependency installation audit | 0 reported vulnerabilities |

Browser coverage includes routes, settings save/reset and shift effects, conflicting edits across tabs, custom ranges, chart controls, native manual dialog, scorecard values, CSV import persistence, backup download, furnace/pass selection and holdout display, invalid economics inputs, fixed sidebar and 390 px mobile navigation. Screenshots were reviewed at desktop, tablet and mobile sizes. Visual review caught and corrected a driver-selection mismatch, retained route scroll position, numeric cell wrapping and logo contrast.

The HTML comparison covers full published heater/exchanger/membrane datasets plus edge cases, representative blower pure functions, twelve complete economics cases and all nine furnace passes over 2,555 forecast days each. All 22,995 central forecast steps match and no P10/P90 band steps differ. This does not establish physical model accuracy or certify operating decisions.

Known delivery limits: GitHub Pages provides shared published data, not shared remote writes. Local backups/imports are explicit actions. The original model's distinct 470 °C measured-status criterion and 475 °C forecast reference remain identified. Source manuals are preserved with current-edition notes. The wider POC scenario/comparison/report roadmap is documented separately in REMEDIATION.md.

Vite reports a large main bundle (approximately 1.24 MB before compression); route splitting is a future performance improvement. Build output and node_modules are not committed. No production deployment is claimed by these local checks.
