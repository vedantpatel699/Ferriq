"""Run the standalone tests and write their concise verification report."""
import gzip
import hashlib
import json
import platform
import unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parent

if __name__=='__main__':
    tests=unittest.defaultTestLoader.discover(str(ROOT/'tests'))
    result=unittest.TextTestRunner(verbosity=1).run(tests)
    if not result.wasSuccessful():raise SystemExit(1)
    raw=(ROOT/'tests/website-cases.json.gz').read_bytes()
    cases=json.loads(gzip.decompress(raw));counts=Counter(c['input']['model'] for c in cases)
    rows=['# Python verification report','','Executed from the standalone submission folder. All tests passed.','',f'Python {platform.python_version()}; {result.testsRun} test methods, {len(cases)} production-TypeScript comparison cases and six command-line examples.','', '| Model | Identical-input cases | Result |','|---|---:|---|']
    rows += [f'| {model} | {count} | Passed |' for model,count in counts.items()]
    rows += ['', 'Coverage: complete simulated monitor YTD histories; missing fields; zero/negative boundaries; changed configuration; configured alerts; blower forward-fill, shared trains and regression coefficients; custom heater fuels; all nine refinery routings; 0/8/12.5/100% OPEX; legacy itemized replacement; complete/incomplete market prices; YTD/7-day/partial-hour financial integration; all nine furnace passes, missing/irregular readings, existing threshold exceedance and Pass 3 scenarios.', '', 'Raw numeric tolerance: 1e-9 relative or absolute, to allow floating-point operation order. Exact comparison for keys, strings, nulls, booleans, array sizes and discrete states. Sampled display strings are checked exactly at 1, 2 and 4 decimal places. Selected seven-day sample averages are checked independently. Envelope tests cover quality, mapping units, duplicate timestamps, invalid configuration, DST ambiguity and execution of every packaged CLI example.', '', f'Display string comparisons: {sum(len(c["display"]) for c in cases):,}.', f'Fixture SHA-256: `{hashlib.sha256(raw).hexdigest()}`.', '', 'Reproduce: `python verify.py` or `python -m unittest discover -s tests -v`. Fixture generation imports the actual website calculation modules; CI separately checks fixture freshness. No private source files, website installation or live services are needed to run these captured comparisons.', '', 'Scope: numerical consistency with the verified POC calculation paths. This does not validate the site-specific thresholds, assumed healthy baseline, long-range furnace projection, intervention response, fixed refinery yields/densities or live AVEVA compatibility. These limitations are described in the manual. Website browser/build and deployment results are recorded separately in the project Phase 3 checklist.']
    (ROOT/'verification-report.md').write_text('\n'.join(rows)+'\n',encoding='utf-8')
