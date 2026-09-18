# Ferriq local walkthrough

All default equipment history is simulated, from January 1 to September 17, 2026 at 17:00 Edmonton time. It is not plant data. Existing browser-local edits remain in place; export them before restoring published data.

## Data and calculations

- Blower, heater, exchanger and membrane: 6,233 hourly observations each. Inputs vary with load, seasonal conditions and gradual deterioration. Simulated maintenance resets deterioration after 100 and 200 elapsed days.
- Furnace: 1,559 observations at four-hour intervals for every thermocouple. Original trained trees and dated holdout results are retained. Simulated history does not validate prediction accuracy.
- Crude to Profit: daily simulated throughput and prices, processed through the refinery calculation engine. Period totals integrate interval rates, including partial intervals, using 330/365 availability. Annual scenarios remain separate.
- Equipment window averages give equal weight to samples. They are not cumulative energy or production totals.
- OPEX defaults to an editable 8% of revenue. Margin after OPEX equals revenue less crude feed cost and operating costs. It excludes capital, financing and tax.
- Missing furnace operating inputs are listed beside the trained-horizon predictions. Those predictions use missing-value branches and are unverified with incomplete inputs. Long projections and the flow-split scenario are also unvalidated.

## Walkthrough

1. Open each equipment page. Inspect the current result, select YTD, then 24H. Check the chart, window average and Data & Log table. Export the selected observations.
2. Open Configuration, change a documented setting, save and reload. Restore published data when finished. Open the engineering manual for inputs, equations and limitations.
3. Open each furnace and pass. Compare YTD history with the separate projection horizon. Inspect trained-horizon results and missing inputs. Run and reset the Pass 3 scenario; its effect is assumed, not a validated operating recommendation.
4. Open Crude to Profit. Change routing and OPEX under Adjust scenario. Check annual reconciliation and simulated period totals. Price snapshot shows the separately published market estimates and source dates.
5. Export a workspace backup from Data Export. Local edits are saved in this browser only; other users see the published revision.

Build Report has been removed. CSV and JSON exports remain available.

See [FINAL-REVIEW.md](FINAL-REVIEW.md) for test results and outstanding source limitations. Publication follows the separately authorized commit and push after checks pass.
