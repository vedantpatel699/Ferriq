# Python calculation and pricing engine

`engine.py` is the Python counterpart of the React Crude to Profit calculation engine. It and the three pricing modules were brought forward from Claude's original model. No third-party Python packages are required.

From the repository root:

```sh
python python/crude_to_profit/engine.py
npm run test:python
```

For a saved website scenario export, pass its `inputs.flows`, `inputs.config`, `inputs.residueUnit`, `inputs.gasOilUnit`, and optional `inputs.market.crude`/`product` into `run_model`. Units are m³/h and CAD/m³. The function is offline; pricing does not silently change calculation inputs.

`python scripts/fetch-market-prices.py` fetches the original pricing method and current available Bank of Canada exchange rate, validates all prices and writes the static website snapshot. Set `EIA_API_KEY` in the environment. Never place credentials in website assets. Fetch failures preserve the last good snapshot and its original dates.

Read `CRUDE-WORKBOOK-AUDIT.md` for the source-sheet AA10 correction, zero additional LPG-credit default, FCC limitations, and comparison results. Live market means the latest published observations, not guaranteed same-day quotes.

## Routing revision

`run_model` uses nine independent combinations: residue `none`, `lc_finer`, `delayed_coker`; gas oil `none`, `hydrocracker`, `fcc`. It returns stage transfers in `routing` and `unpriced_residue_m3hr`. Coker gas oil stays unsplit. Fixed conversion yields and price proxies are illustrative. `workbook_slate_m3hr` is a backward-compatible field meaning current routed products before additional LPG credit, not the original workbook result. Use `run_workbook_model` only for historical workbook comparison. The command-line output uses the current routed engine without network calls.
