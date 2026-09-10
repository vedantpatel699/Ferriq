# Active routing revision - 10 September 2026

The current website uses independent residue (None / LC Finer / Delayed Coker) and gas-oil (None / Hydrocracker / FCC) choices. Earlier workbook tie-out figures below refer to `runWorkbookModel` / `run_workbook_model`, retained for audit only. They are not the new routing output.

- Straight-run VGO goes directly to the selected gas-oil unit. Untreated vacuum residue never enters FCC or the gas-oil hydrocracker.
- All LC Finer gas-oil fractions, including HVGO, enter the gas-oil pool. Unconverted residue remains unpriced inventory with an explicit warning.
- Coker gas oil stays one pool (49.605 wt% at 15 wt% CCR). No LC Finer ratio is used to invent its light/heavy split. Routing the whole pool is a screening assumption pending feed assay, pretreatment and unit acceptance.
- FCC native yields remain illustrative: 47% gasoline, 21% LCO, 10% slurry, 12% LPG, 4% dry gas, 6% coke by mass. Gasoline uses the naphtha price proxy; LCO/slurry use the UCO price proxy. Coke is burned internally and receives no sales credit. No FCC jet/diesel is created by boiling overlap.
- Gas-oil bypass retains that pool and values it once at the UCO proxy. Residue bypass remains unpriced. Neither case silently discards feed.
- Low/High fixed prices, primary assay values, primary light-cut distribution, and annualization remain from the client sheet. Annual gross margin = (product sales - crude cost) x 24 x 330 / 1e6; annual sales are shown separately. Revised routing intentionally changes volumes and annual totals.
- No feed-specific hydrocracker calibration, hydrogen mass balance, pretreatment costs, finished-product certification, serial conversion or recycle is claimed. Original assays are not normalized; volume gain is not a refinery mass-balance proof. Streams in the routing table describe different stages and must not be summed across stages.

Routing references: [Honeywell UOP gas-oil conversion](https://uop.honeywell.com/content/uop/en/us/home/industry-solutions/refining/vacuum-gas-oil-conversion.html) and [Axens hydrocracking feed flexibility](https://www.axens.net/expertise/oil-refining/high-conversion-hydrocracking). These support process compatibility, not the numerical yield assumptions. The supplied deep-research report informed this routing revision. The data were obtained from open resources.

## Historical workbook audit

# Crude to Profit - revised workbook audit

Source: `Crude to Profit Rev 1 (1).xlsx`. The original file was read without modification. `reference/crude-workbook-rev1.json` records cell inputs, cached outputs and the source SHA-256.

## What matches

All five feed rates and all Low/High crude and product prices match the revised sheet. LC Finer's six liquid yields plus the new 11.99 wt% combined LPG/fuel-gas stream total 100 wt%. Primary assay percentages are retained as supplied; they are not normalized. Hydrocracker volume gain is retained and is not a mass-balance failure.

The sheet's SimDist!AA10 uses `=$C$9*(Z9/100)` instead of AA9. Its cached value is zero, omitting 88.59192696 m³/h direct naphtha. Both engines retain Claude's correction. With zero additional residue-LPG sales credit, all seven product flows and both margins reconcile to the revised workbook after that single correction. Six product flows match exactly; naphtha includes the correction. The workbook-comparison slate is therefore corrected, not a byte-for-byte reproduction of the sheet's defect.

## Yield assumptions

| Technology | Implemented basis | Relationship to client sheet |
|---|---|---|
| LC Finer | 14.13 / 23.95 / 12.32 / 9.78 / 2.44 / 25.39 / 11.99 wt% | Matches O12:O18; last stream is combined LPG/fuel gas |
| Delayed Coker | CCR correlation at assumed 15 wt% CCR; gas 9.96%, naphtha 16.435%, coke 24%, gas oils 49.605% | Gas oils split using LC Finer cut ratios. All derived cuts fall inside the client ranges at this CCR. This cut allocation is an assumption |
| FCC | Gasoline 47%, LCO 21%, slurry 10%, LPG 12%, dry gas 4%, coke 6% | Retained illustrative 100% slate; not a match to the incomplete client ranges |

Client FCC ranges total only 48-93 wt%, interpreting the stated approximately 5% light gas as 5%. No selection inside every range reaches 100%. Scaling these figures would silently contradict the supplied bounds. A corrected, closed FCC yield slate is still needed from the client for a client-specific FCC prediction.

FCC processes the gas-oil stream in this model, while LC Finer or coker processes vacuum residue. The three-choice interface maps LC Finer to LC Finer + hydrocracker, Delayed Coker to coker + hydrocracker, and FCC to LC Finer + FCC. An existing saved coker + FCC combination remains identifiable. FCC boiling-range allocation does not demonstrate finished jet/diesel quality; the fuel-price proxies can overstate realizable sales values. Coking yields also depend on operating conditions and feed. See [EIA's FCC description](https://www.eia.gov/todayinenergy/detail.php?id=9150) and [Colorado School of Mines' delayed-coking notes](https://people.mines.edu/jjechura/wp-content/uploads/sites/120/2019/02/CBEN409_06_Coking.pdf).

The previous 100% combined-gas LPG recovery default created 44.17319630 m³/h extra saleable LPG without a demonstrated recovery split. The revised default is zero in TypeScript, the published Python engine, the original local engine and the local client handoff engine. This removes CAD 28,712.58/h Low and CAD 34,455.09/h High speculative sales credit. Previously saved scenarios retain their explicit recovery assumption and show a visible warning; Restore published scenario selects the revised default.

## Pricing and publication

Low and High remain paired workbook price cases, not minimum/maximum profit bounds. Live market uses Claude's existing Canadian crude and Alberta-anchored product pricing modules. Public pulls use EIA, Alberta and Bank of Canada. WCS is WTI plus the signed Alberta differential; grade spreads remain reference-calibrated estimates. LPG and naphtha use Alberta NGL anchors moved by EIA drivers. Kerosene/diesel use EIA spot benchmarks; swing cuts are 50/50 destination values; UCO uses 82.5% WCS. Proxies and all source dates are visible. Live values are not clamped to the workbook ranges.

GitHub Pages remains static. The deployment workflow attempts a daily 14:30 UTC refresh and also refreshes during publication. GitHub's scheduler can be delayed. The EIA credential belongs only in the protected `EIA_API_KEY` Actions secret. No credential is shipped in the new application code. Reload published prices fetches the published JSON, not a new upstream quotation. A cached last-good snapshot survives upstream failure with its original source and generation dates; the failed refresh is marked. First deployment has a checked-in verified fallback.

## Verification

`npm run test:python` compares 72 full Python/TypeScript scenarios, including all four process combinations, zero/varied feeds, three recovery assumptions, and fixed/live prices. It also checks revised-workbook prices, independent output tie-out and coker bounds. The original HTML parity harness explicitly supplies its old recovery default to test preserved formulas; the new default is independently checked by the workbook/Python suite.

The data were obtained from open resources.
