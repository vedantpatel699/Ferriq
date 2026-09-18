# Python verification report

Executed from the standalone submission folder. All tests passed.

Python 3.14.5; 8 test methods, 141 production-TypeScript comparison cases and six command-line examples.

| Model | Identical-input cases | Result |
|---|---:|---|
| air-blower | 29 | Passed |
| fired-heater | 24 | Passed |
| shell-tube-exchanger | 16 | Passed |
| membrane-analyzer | 14 | Passed |
| crude-to-profit | 44 | Passed |
| furnace-skin-temp | 14 | Passed |

Coverage: complete simulated monitor YTD histories; missing fields; zero/negative boundaries; changed configuration; configured alerts; blower forward-fill, shared trains and regression coefficients; custom heater fuels; all nine refinery routings; 0/8/12.5/100% OPEX; legacy itemized replacement; complete/incomplete market prices; YTD/7-day/partial-hour financial integration; all nine furnace passes, missing/irregular readings, existing threshold exceedance and Pass 3 scenarios.

Raw numeric tolerance: 1e-9 relative or absolute, to allow floating-point operation order. Exact comparison for keys, strings, nulls, booleans, array sizes and discrete states. Sampled display strings are checked exactly at 1, 2 and 4 decimal places. Selected seven-day sample averages are checked independently. Envelope tests cover quality, mapping units, duplicate timestamps, invalid configuration, DST ambiguity and execution of every packaged CLI example.

Display string comparisons: 22,452.
Fixture SHA-256: `a4caa94ebce39501f35bbce12912faf99a49718f70d4bb96fcc242bef2bb746d`.

Reproduce: `python verify.py` or `python -m unittest discover -s tests -v`. Fixture generation imports the actual website calculation modules; CI separately checks fixture freshness. No private source files, website installation or live services are needed to run these captured comparisons.

Scope: numerical consistency with the verified POC calculation paths. This does not validate the site-specific thresholds, assumed healthy baseline, long-range furnace projection, intervention response, fixed refinery yields/densities or live AVEVA compatibility. These limitations are described in the manual. Website browser/build and deployment results are recorded separately in the project Phase 3 checklist.
