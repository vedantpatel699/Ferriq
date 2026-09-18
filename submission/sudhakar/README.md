# Ferriq engineering submission

Six offline calculation engines and the engineering manual. Demo observations are simulated, not plant measurements. This folder runs independently of the Ferriq website repository. No live AVEVA connection is included.

## Run a model

1. Install Python 3.10 or newer if it is not already installed.
2. Open the desired file from **engines** in Python IDLE.
3. Select **Run > Run Module (F5)**. A built-in example runs and saves a results JSON file beside the Python file.
4. Edit **SETTINGS** near the top of the file and run again to change assumptions.

Each of the six Python files works on its own. No extra packages, helper files, network access or setup commands are required. The embedded examples are simulated. The furnace file includes its trained model and sample history.

For your own input JSON, run `python engines/air_blower_engine.py examples/air-blower.input.json > results.json`. Each file also exposes `run(payload)` and a provisional `map_records` tag mapper. A live AVEVA connection is not included or verified.

Read the corresponding PDF in **manuals**. Each manual is printed from the website's own manual, using the same content and formula elements. Examples and tests are supporting verification material; they are not needed to run the built-in examples.

| Model | Engine | Example name |
|---|---|---|
| Air Blower | `engines/air_blower_engine.py` | `air-blower` |
| Fired Heater | `engines/fired_heater_engine.py` | `fired-heater` |
| Shell & Tube Exchanger | `engines/shell_tube_exchanger_engine.py` | `shell-tube-exchanger` |
| Membrane Analyzer | `engines/membrane_analyzer_engine.py` | `membrane-analyzer` |
| Furnace Skin TI Predictor | `engines/furnace_skin_ti_predictor_engine.py` | `furnace-skin-temp` |
| Crude to Profit | `engines/crude_to_profit_engine.py` | `crude-to-profit` |

For every example name, `examples/<name>.input.json` contains a valid request and `examples/<name>.expected.json` contains the expected `result` member. The furnace example includes history because a single reading cannot establish a trend. For Python callers, add this folder's `engines` directory to the import path and call the selected module's `run(payload)`.

## Common input and output

```json
{
  "schemaVersion": "1.0",
  "model": "membrane-analyzer",
  "source": "simulated demonstration",
  "timezone": "America/Edmonton",
  "config": {},
  "parameters": {},
  "measurements": [{
    "timestamp": "2026-09-17T17:00:00-06:00",
    "values": {
      "feedFlowNm3Hr": 10000,
      "permeateFlowNm3Hr": 5000,
      "feedH2OnlinePct": 60,
      "permeateH2OnlinePct": 95,
      "feedPressureKpag": 15000
    },
    "quality": {"feedH2OnlinePct": "simulated"}
  }]
}
```

- `config` overrides the defaults in `data/defaults.json`. Model field names match the website. Blower settings and limits are nested; other monitor settings are flat. Parameter names are case-sensitive.
- Supply ISO-8601 timestamps with explicit UTC offsets. Naive timestamps use the named zone; ambiguous or nonexistent local times are rejected. Observations are sorted and duplicate instants rejected. Explicit offsets avoid differences between operating-system time-zone database versions.
- `quality` accepts `good`, `simulated`, `bad`, `stale` or `missing`. Omitted quality means no quality flag supplied, not a verified instrument. Bad/stale/missing values become null before calculation. A bounded blower suction-temperature carry-forward may still apply and is labelled by `t1Source`.
- Successful output contains `schemaVersion`, `model`, `ok`, `source`, `integrationStatus`, merged `config`, `result`, `units`, `warnings` and `errors`. Invalid requests return `ok: false`, `result: null` and an `INVALID_INPUT` error; unreadable JSON uses `INVALID_JSON`.
- Missing measurements produce null dependent outputs or an explicitly dropped blower observation. No synthetic plant value is inserted by these engines. Alert severity describes available measurements; null results must also be checked.
- Optional `window: {"start": "...", "end": "..."}` selects inclusive observation timestamps for `window.sampleAverages`. These are equal-weight averages of finite numeric fields, not time-integrated totals. Blower regression uses the full supplied history before window selection. Furnace history and future projection are separate.
- `data/units.json` lists canonical input and output units. A/B means the corresponding train field, N means the pass number and `*` denotes a field-name pattern. No implicit unit conversion occurs in the tag adapter.

## Model-specific mapping

| Model | Principal measurement fields | Configuration / outputs |
|---|---|---|
| Blower | `motorCurrentA/B` A; `suctionPressureA/B` kPaa; `dischargePressureA/B` kPag; `totalFlowNm3hr` Nm3/h; `suctionTempC`, `dischargeTempA/B` degC; `vibrationA/B` and `bearingTempA/B` arrays; `filterDpA/B` bar; `bypassOpA/B` %; `controllerSpA/B` kPag | Voltage, PF mode, gamma, baseline duration and limits; kW, efficiencies, flow loss, trend slopes and screening proxy. |
| Heater | `fuelFlowKgS`, `processFlowKgS`; `combustionAirTempC`, `fuelTempC`, `stackTempC`, `processInC`, `processOutC`, `bridgewallAC/BC`; `stackO2Pct` wet vol%; `processCpKjKgK` | Fuel case/custom molar fractions, reference temperature, radiation loss, limits; heat balance kW, efficiency %, closure and alerts. |
| Exchanger | `hotInC`, `hotOutC`, `coldInC`, `coldOutC`; `hotFlowKgHr`, `coldFlowKgHr`; `hotCpKjKgK`, `coldCpKjKgK`; `shellDpBar`, `tubeDpBar` | Area, clean U, shell count, design duty, limits; duty, LMTD, F, U, fouling and alerts. |
| Membrane | `feedFlowNm3Hr`, `permeateFlowNm3Hr`; `feedH2OnlinePct`, `feedH2LabPct`, `permeateH2OnlinePct`, `permeateH2LabPct`; `feedPressureKpag` | Design pressure and limits; recovery, purity, feed/non-permeate ratio and alerts. Common normal-volume basis required. |
| Furnace | TC aliases from `data/furnace-model.json`, degC; historical model features in original source units | `furnace`, `pass`, `horizonDays`; optional `parameters.flowSplit` for Pass 3. Trained-horizon quantiles, separate trend projection, crossing time and missing coverage. |
| Economics | `flows` keyed OSH/SHD/AWB/SCO/FRB, m3/h; optional `market.crude` and `market.product`, CAD/m3 | `parameters.residueUnit`: none/lc_finer/delayed_coker; `gasOilUnit`: none/hydrocracker/fcc. Yields, rates, annual sales/costs/margins and routing. |

For economics, `opexRevenuePercent` defaults to 8 and is configurable from 0 to 100. The allowance is applied to each price case's revenue and replaces itemized OPEX. To reproduce an earlier itemized scenario, supply all five `opex` items and omit `opexRevenuePercent`. Annual, hourly and feed-throughput bases retain their original units. Gross margin is sales less crude purchases; margin after configured OPEX deducts the allowance once. Neither is net profit.

Economics observations may include `intervalEnd`; `parameters.integrationWindow` clips the intervals. Overlapping intervals are rejected. `priceCase` is low/high/market (default market); complete selected prices are required. `period` totals integrate hourly rates using 330/365 availability, matching the website. Sum period totals for YTD. Annual scenario values use 7,920 operating hours and must not be summed across dates.

## Provisional AVEVA adapter

No confirmed AVEVA payload specification or sample was supplied. `map_records` in each engine maps caller-provided timestamped tag dictionaries through an explicit `tag_map`. Each mapping supplies `field` and canonical `unit`. A unit mismatch is rejected; upstream code must make documented conversions. Tag identifiers, authentication, endpoint, subscription, quality-code translation and historian retrieval remain site integration work. The envelope is provisional, not a claim of AVEVA API compatibility.

## Evidence, assumptions and verification

Requirement mapping is carried forward from client emails and attachments: blower/membrane 11 February 2026; heater/furnace October 2025; exchanger 25 October 2025; economics 19/25 August 2026. Private messages and original attachments are excluded. Engineering assumptions and public references appear in the six PDFs in `manuals/`, printed from the website manual content.

Simulated history runs from 1 January through 17 September 2026, 17:00 Edmonton: hourly equipment samples, four-hour furnace history and daily financial intervals with a final partial day. The captured parity fixtures include the actual calculation outputs, not invented chart curves. Simulation does not validate plant performance or forecast accuracy.

`tests/website-cases.json.gz` was generated by the production TypeScript engines. `tests/test_parity.py` checks identical inputs, exact discrete outputs, raw floating-point values within 1e-9 relative/absolute tolerance and exact display strings at 1, 2 and 4 decimals. The tolerance handles arithmetic ordering, not engineering uncertainty. Captured fixtures are sufficient for offline testing; refreshing them requires the website repository's `npm run submission:fixtures`. CI checks that captured fixtures still match the production calculations. See `verification-report.md` for the executed results.

Remaining engineering limitations: assumed-healthy blower reference and constant speed; no actual thrust-force measurement; constant-Cp heater duty omits separate phase-change/steam enthalpy; exchanger geometry/property detail is incomplete; membrane composition must be synchronized; furnace long-range and flow-split effects are unvalidated; refinery yields/densities and product price proxies need site confirmation. No new plant alarm thresholds were inferred.
