# Fired Heater Skin TI Prediction - A Primer

A learning chapter on the engineering and modelling problem of predicting refinery furnace tube skin temperatures, with reference to the Ferriq predictor architecture.

---

## 1. The problem

Refinery fired heaters (atmospheric heaters, vacuum tower heaters, coker heaters) operate process fluid through serpentine coils inside a fired box. As the run progresses, coke deposits build up on the tube ID, reducing convective heat transfer. To keep the same outlet temperature, fired duty must rise, and the tube metal temperature (skin TI) creeps upward.

The skin TI is constrained by metallurgy. For 9Cr-1Mo or 5Cr-0.5Mo tubes per **API 530**, the design metal temperature is typically 600 °C, but the operational concern arrives much earlier: **475 °C is the polythionic stress corrosion cracking (PASCC) sensitization threshold per NACE SP0170**.

### Why 475 °C matters: the PASCC chain

1. **Sensitization (above 475 °C in operation)**: chromium carbides precipitate at austenite grain boundaries, depleting chromium locally. The boundaries lose corrosion resistance.
2. **Shutdown exposure**: when the furnace cools and tubes are exposed to air + moisture, sulfide deposits on the ID react to form polythionic acids (H₂SₓO₆).
3. **Cracking under stress**: polythionic acids attack the sensitized grain boundaries while the tube is under residual tensile stress, propagating intergranular cracks.

The mitigation is **soda ash neutralization** during shutdown: an alkaline (Na₂CO₃) wash raises surface pH and neutralizes the polythionic acids before they crack the tubes.

### Operational consequences

| Skin TI status | Decoke decision | Soda ash decision |
|---|---|---|
| Stayed below 475 °C all run | Skip; extend run | Optional / skip |
| Approaching 475 °C late in run | Schedule decoke at next TA | Recommended (precaution) |
| Excursion above 475 °C any time in run | Decoke required at TA | **Mandatory** |
| Currently above 475 °C | Cut throughput now | Mandatory at next shutdown |

The dollar stakes are large. From [Becht's coker heater monitoring overview](https://becht.com/becht-blog/entry/coker-heater-health-monitoring-for-maximum-throughput-and-reliability/): too high an end-of-run temperature → tube retubing every few cycles. Too low → unnecessary decokes, lost throughput. The sweet spot is operating right up to (but never through) the metallurgical limit.

This is why "when will we hit 475 °C?" is the question every refiner wants their predictor to answer.

---

## 2. Modelling approaches surveyed

### 2.1 Empirical / statistical regression

The simplest baseline: linear regression of skin TI against operating drivers (firing rate, pass flow, COT, days_in_run).

```
skin_TI = a + b·firing_rate + c·days_in_run + d·pass_flow + ε
```

**Pros**: tiny model, fully interpretable, fast.
**Cons**: fouling is non-linear (skin rises slowly early in run, accelerates late). Linear can't capture that. Also can't represent driver interactions.

Polynomial extension `skin_TI = a + b·days² + c·days + ...` captures one curve shape but is brittle outside the training range.

### 2.2 Random forest / gradient boosted trees

Gradient boosted decision trees (GBDT) - **XGBoost**, **LightGBM**, **CatBoost** - are the consensus winner for small-to-medium tabular industrial datasets. Reference: [Tabular Data: Deep Learning is Not All You Need (Shwartz-Ziv & Armon, 2021)](https://arxiv.org/abs/2106.03253) demonstrated XGBoost outperformed deep learning models across nearly every benchmark tabular dataset, with much less hyperparameter tuning effort.

**Why GBDTs win on this kind of data**:
- Handle non-linearities natively (each tree is a piecewise constant approximation)
- Handle mixed-type features without preprocessing
- Robust to outliers (split-based)
- Don't require feature normalization
- Forgiving of small datasets (regularization built in)
- Each tree dump is small JSON (~10 KB per 80-tree model, depth 3)

**Why XGBoost specifically over LightGBM / CatBoost**:
For browser-deployed inference, the choice is essentially aesthetic - all three serialize to similar JSON tree-dumps that a 10-line JavaScript walker can evaluate. XGBoost has the longest track record and the best documentation; LightGBM is faster to train but the difference is irrelevant when training takes seconds. CatBoost handles categorical features differently which doesn't matter here (all our features are continuous).

### 2.3 Neural networks (MLP, LSTM, Transformer)

LSTMs (Long Short-Term Memory networks) are the natural fit for time-series, modelling temporal dependencies between days. Transformers can do similar.

**Pros**: capture sequential patterns, good with large datasets.
**Cons for our use case**:
- Need much more data than 1900 rows. Reference: [When Do Neural Nets Outperform Boosted Trees on Tabular Data? (McElfresh et al., 2023)](https://arxiv.org/pdf/2305.02997) - NNs only beat GBDTs reliably above ~10,000 rows AND with carefully designed architectures.
- Browser deployment requires shipping the architecture + weights, ~MB-scale even for small networks.
- Uncertainty quantification is harder (need MC dropout or quantile heads).
- Black-box interpretation; engineering audit is harder.

LSTMs would be the right call for an installation with 5+ years of minute-cadence DCS data and a Python/TensorFlow Serving backend. For a single-page browser dashboard with 1900 daily rows, GBDTs are better matched.

### 2.4 Physics-informed regression

The Dittus-Boelter correlation gives the inside-film heat transfer coefficient:

```
h_inside = (k/D) · 0.023 · Re^0.8 · Pr^0.4
```

Combined with a fouling resistance R_f that grows over time:

```
1/U = 1/h_inside + R_f(t) + 1/h_outside
skin_TI = T_fluid + Q · (1/h_outside + R_f(t))
```

Physics-informed approach: parameterize R_f(t) with a few coefficients learned from data:

```
R_f(t) = α · t^β · exp(γ · T_avg)
```

Then fit (α, β, γ) by least squares on the historical record.

**Pros**:
- Tiny coefficient set (~3-5 numbers per pass)
- Naturally handles operating regime changes (the physics base term scales correctly)
- Physically interpretable; engineers can sanity-check
- Long-horizon extrapolation is grounded (fouling rate doesn't fly off into nonsense)

**Cons**:
- Only as good as the assumed functional form. If R_f(t) has a more complex shape, the fit is poor.
- Doesn't capture interactions (e.g., crude blend changes shifting fouling regime).

Reference: [Physics-Informed Neural Networks for Heat Transfer (Cai et al., ASME 2021)](https://asmedigitalcollection.asme.org/heattransfer/article/143/6/060801/1104439/Physics-Informed-Neural-Networks-for-Heat-Transfer) is the modern hybrid form, where an NN approximates R_f(t) but the heat-transfer physics constrains the loss.

### 2.5 State-space / Kalman filter

Frame the problem as: there's an unobserved coke layer thickness L(t), it grows according to deterministic + stochastic dynamics, and skin TI is a noisy observation of it.

```
L(t+1) = L(t) + r(operating_state) · dt + noise
skin_TI(t) = f(L(t), operating_state) + measurement_noise
```

Kalman filter recursively estimates L(t) and propagates uncertainty.

**Pros**: principled uncertainty propagation, online learning natural.
**Cons**: requires explicit state model; harder to deploy than tree dump.

This is the approach used by some commercial coker monitoring tools (KBC, AspenTech) where the physics model is hand-built.

### 2.6 Time-to-event / survival analysis

If the goal is literally "time until skin TI hits 475 °C", survival analysis (Kaplan-Meier, Cox proportional hazards) directly models that.

**Pros**: target the actual decision quantity.
**Cons**: needs many "events" (skin-475 crossings) to fit. We typically have at most one or two per furnace per dataset - too few. Survival models also need censoring information that's not always clean.

### 2.7 Hybrid: physics base + ML residual

The pragmatic middle path:

```
skin_TI(t+1) = physics_baseline(operating_state) + ML_residual(features)
```

Train the physics part on a curve fit, then use ML (XGBoost or NN) to learn corrections from features the physics doesn't capture. The ML never has to extrapolate to extreme regimes because the physics handles those.

This is the approach in [Physics-Informed hybrid machine learning for critical heat flux prediction (ScienceDirect 2025)](https://www.sciencedirect.com/science/article/abs/pii/S0029549325006119) and the [Hybrid PI-LSTM for heat exchangers (Frontiers 2026)](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2026.1779002/full).

---

## 3. Feature engineering for fouling models

The model architecture matters less than the features. The features used to predict skin TI in this domain are:

### 3.1 Operating drivers (current state)

- **Pass flow** (m³/h): higher flow → more fluid mass to heat → more duty pulled → higher skin TI for fixed firing
- **COT (coil outlet temperature)** (°C): the controlled variable; firing chases this setpoint
- **Box / radiant section T** (°C): effective hot-side driving temperature
- **Convection skin TI**: a leading indicator for radiant skin TI
- **Crossover T**: between convection and radiant sections
- **IP velocity steam injection** (kg/h): reduces residence time, lowers fouling rate
- **Stack T**: reflects overall thermal balance
- **Fuel gas flow / pressure**: firing rate proxy
- **Combustion air**: excess-air control

### 3.2 Engineered features

- **`days_since_run_start`** - days since the last decoke (resets after each detected decoke). This is the single most important feature for fouling prediction. The model can learn "at day 30 of a run, expect 0.05 °C/day rise; at day 800, expect 0.15 °C/day".
- **`tc_now`**: the current value of the TC being predicted (autoregressive)
- **`tc_7d_mean`**: 7-day rolling mean of the TC (low-pass filter)
- **`tc_velocity_c_per_d`**: change in TC over the last 7 days, ÷ 7 (slope)
- **`duty_integral_norm`**: cumulative pass-flow × time integral, a proxy for total throughput

### 3.3 What to MASK / EXCLUDE

- **Sensor faults**: skin TI < 150 °C or > 700 °C are physically implausible; mask as NaN.
- **Turnaround rows**: the entire furnace cold (max skin < 250 °C) plus a ±3 day buffer for cool-down/warm-up transients. These periods don't represent normal operation and bias the model if included.
- **Process upsets**: day-over-day skin change > 50 °C indicates a sensor glitch or violent disturbance; exclude.

Reference: [ABC-ANFIS-CTF for ethylene cracker coking (MDPI Processes 2019)](https://www.mdpi.com/2227-9717/7/12/909) uses a similar feature set with adaptive neuro-fuzzy inference - their feature engineering is essentially the same as ours, validating the approach.

### 3.4 The decoke detection problem

A turnaround is a planned shutdown. A decoke is a turnaround that included tube cleaning. After a decoke, fouling resets to ~zero; after a non-decoke maintenance shutdown, the previous fouling state resumes.

**Heuristic**: compare the 7-day mean skin TI just before the shutdown against the 7-day mean just after restart. If the post mean is at least 30 °C lower than the pre mean, classify as a decoke. Otherwise, treat as a maintenance stop.

This matters because `days_since_run_start` should reset only at decokes. Aligning multiple runs at t=0 in feature space means the model learns a single fouling curve shape, not a smeared average across cycles.

Reference: [ScienceDirect 2024 - ML for thermal cracking furnace service life](https://www.sciencedirect.com/science/article/pii/S2590123024006042) demonstrates that "a model identified near the start of a run degrades as the run progresses, then resets to a different baseline after decoking" - which is exactly why the per-run feature is needed.

---

## 4. Uncertainty quantification

A point forecast is necessary but not sufficient for an operational decision. Engineers need to know how much confidence to assign.

### 4.1 The naive approach: σ × √d

For a 1-step-ahead model with residual standard deviation σ, the d-step forecast under random-walk error compounding has variance σ²·d, so the 1σ band is σ·√d.

**This is what the Ferriq predictor used initially**, and it's wrong for recursive forecasts that converge to a steady state. After the model converges (~14 days for our case), the forecast value stops changing day-to-day, so the assumption of independent compounding errors breaks down. Using σ·√d at 365 days gives ~19× the base sigma, an absurd band that makes the prediction useless.

### 4.2 Capped variance

Practical refinement: cap d at the convergence horizon (~30 days). The 1σ band is `σ·√min(d, 30)`, giving a maximum band of ~5.5× the base sigma. Reasoning: after the model has converged, additional steps don't add variance because the prediction isn't changing. This is one workable approach to bounded long-horizon variance for a recursive forecast.

### 4.3 Quantile regression

Train three XGBoost models per TC: one for the 50th percentile (median, the "central forecast"), one for the 10th percentile (lower bound), one for the 90th percentile (upper bound). XGBoost supports this via the `reg:quantileerror` objective with `quantile_alpha` parameter (XGBoost 2.0+).

This is the approach used in the Ferriq predictor. The hold-out validation view in the About tab lets the user verify empirical coverage on a per-TC basis. Coverage targets 80% (the nominal P10-P90 spread); observed coverage ranges from ~50 to ~95% across TCs depending on data quality.

```python
from xgboost import XGBRegressor
m_lo = XGBRegressor(objective='reg:quantileerror', quantile_alpha=0.1)
m_med = XGBRegressor(objective='reg:quantileerror', quantile_alpha=0.5)
m_hi = XGBRegressor(objective='reg:quantileerror', quantile_alpha=0.9)
```

References: [Towards Data Science - Confidence intervals for XGBoost](https://towardsdatascience.com/confidence-intervals-for-xgboost-cac2955a8fde/), [Cienciadedatos - Prediction intervals when forecasting with ML](https://cienciadedatos.net/documentos/py42-forecasting-prediction-intervals-machine-learning.html).

**Pros**: prediction intervals are learned from data, not assumed. Correct asymmetric bands when the underlying distribution is skewed.
**Cons**: 3× the model count, 3× the JSON size. Not implemented yet in Ferriq.

This is the recommended next upgrade.

### 4.4 Bootstrap intervals

Train N models on bootstrap samples of the data. For each forecast point, use the spread across the N model predictions as the band.

**Pros**: distribution-free, captures both data and model uncertainty.
**Cons**: N× training cost, N× JSON size. Heavy.

### 4.5 The recursive-forecast subtlety

Even with quantile regression, there's a question of how prediction intervals propagate when the model is recursive (its own output becomes the next input). The proper treatment is:

1. At step t+1, predict (median, lo, hi) from current state
2. At step t+2, predict three trajectories: one starting from each of (median, lo, hi) at t+1
3. The t+2 band should be the union of the resulting prediction ranges

In practice, people use the simpler approximation: treat the median trajectory as the central forecast and combine sigmas naively.

---

## 5. Industry practice

### 5.1 Standards framework

- **API 530**: Calculation of Heater Tube Thickness in Petroleum Refineries. Defines the design metal temperature framework and the relationship between skin TI, tube life, and required wall thickness.
- **API 560**: Fired Heaters for General Refinery Service. Covers heater design, operation, and inspection scope.
- **API RP 573**: Inspection Practices for Fired Boilers and Heaters. Guides what to look for during turnaround inspection.
- **API 571**: Damage Mechanisms Affecting Fixed Equipment. Documents PASCC and other failure modes.
- **NACE SP0170**: Protection of Austenitic Stainless Steels and Other Austenitic Alloys from Polythionic Acid SCC During Shutdown of Refinery Equipment. Defines the soda ash wash protocol.

### 5.2 Operator decision support patterns

The industry operator workflow looks like:

1. **Daily**: monitor live skin TI, alarm on excursion > 475 °C
2. **Weekly**: trend the fouling rate per pass
3. **Monthly**: review per-pass run length forecasts; flag passes drifting outside expected range
4. **Pre-TA (~6 months out)**: decide which passes will get decoked and which can be skipped, based on projected end-of-run skin TI
5. **At TA**: tubes operated above 475 °C this run get soda ash; others may skip

The **fouling rate (°C/year or °C/day)** is the headline KPI. From the [AFPM Q35 industry Q&A](https://www.afpm.org/data-reports/technical-papers/qa-search/question-35-what-are-your-major-parameters-and-mechanisms): heavy Canadian crude in coker heaters shows 6-12 °F/day = 3.3-6.7 °C/day. Atmospheric / vacuum heaters are much slower, typically 0.05-0.3 °C/day.

### 5.3 Per-run vs whole-life modelling

This is the central modelling choice. The literature consistently favours per-run features:

- **Whole-life model**: train on all years of data, treat them as one continuum. Fails because each decoke reset isn't represented; the model sees skin trajectories that don't make physical sense.
- **Per-run model**: detect decokes, reset the run-day clock at each, train on aligned-at-t=0 fouling curves. The model now sees (effectively) N independent fouling curves and learns the typical shape.

The **single most important feature** is `days_since_run_start`. Without it, the model can't tell early-run from late-run regimes; with it, the model learns the implicit fouling curve.

---

## 6. The Ferriq predictor architecture

What this dashboard implements, and the reasons:

### 6.1 Per-TC modelling

One XGBoost regressor per individual radiant skin thermocouple, not per pass. ~30 models total across three furnaces.

**Why**: each TC has its own noise characteristics and its own fouling trajectory. A pass-level "max skin" is biased upward by whichever TC happens to be noisiest. Per-TC models give cleaner per-TC sigmas (which translates to tighter confidence bands), and let the dashboard surface which specific TC is driving any concern.

### 6.2 Feature set

For each TC: pass flow, IP steam, convection skin (same pass), crossover (same pass), pass outlet, plus whole-furnace box T, fuel gas, combustion air, plus engineered: tc_now, tc_7d_mean, tc_velocity_c_per_d, duty_integral_norm, **days_since_run_start**.

### 6.3 Decoke detection

`detect_decoke_events()` compares 7-day mean skin before each turnaround vs 7-day mean after restart. 30 °C drop threshold = decoke. Resets the run-day clock.

For the current data:
- Heater 1: 0 decokes (5 years of continuous run, June-July 2025 was a maintenance stop only - 14 °C drop, below threshold)
- Heater 2: 2 decokes (early 2020 and August 2025)
- Heater 3: 1 decoke (October 2022)

### 6.4 Hyperparameters

```
n_estimators = 80
max_depth = 3
learning_rate = 0.06
subsample = 0.85
colsample_bytree = 0.85
objective = "reg:squarederror"
tree_method = "hist"
```

Conservative settings to keep model size reasonable (~6 KB JSON per TC) and avoid overfitting on small data. With these defaults, no hyperparameter tuning was performed - the result is "good enough" and tuning effort is better spent on feature engineering per the literature.

### 6.5 Distillation to JSON

After training, each XGBoost model dumps to a list of decision trees. Each tree converts to compact nested objects:

```json
{"f": feat_idx, "t": threshold, "l": left_node, "r": right_node, "m": missing_dir}
{"v": leaf_value}
```

A 5-line JS recursive walker evaluates the tree. Inference is microseconds per prediction. Total bundle size for 30 TCs ≈ 1.5 MB JSON, inlined into the HTML.

**The base_score gotcha**: XGBoost auto-learns `base_score` from training data, but `model.get_params()` returns the user-set value (default `None` → falls back to 0.5). The actual learned value is in `booster.save_config()` as a string like `'[4.71E2]'`. Forgetting to parse this gives predictions of ~30 °C instead of ~470 °C - a silent bug that took an afternoon to track down.

### 6.6 Recursive forecast

For each TC, walk the model 24h-ahead step-by-step out to 2555 days (7 years). Early-exit when predictions converge to a steady state (delta < 0.05 °C for 14 consecutive days), backfill the rest with the converged value.

The chart's forecast pill bar (+7D / +90D / +1Y) controls how much of this trajectory is displayed; the underlying computation is always over the full 7 years.

### 6.7 Confidence band - quantile regression

Three XGBoost quantile models per TC (P10, P50, P90) trained with `objective='reg:quantileerror'`. All three walk the model 24h-ahead recursively in parallel. P50 is the central trajectory; P10/P90 give the data-driven 80% prediction interval.

The headline logic is band-aware: if the central P50 doesn't cross 475 °C but P90 does within the 7-year internal horizon, the tile reports `Possible in N days (upper bound)`.

Empirical coverage on hold-out test data is bundled per TC and visualized in the About tab's Hold-out Validation card.

### 6.8 TA decision support

Per-pass card derives:
- Linear fouling rate from last 30 days of skin readings
- Projected skin at user-specified next TA (default 4-year cycle)
- Decoke recommendation: required / recommended / skip
- Soda ash recommendation: mandatory if any TC exceeded 475 °C this run, otherwise optional

---

## 7. Open questions and future directions

### 7.1 Hybrid physics-informed residual

Add a Dittus-Boelter-derived skin TI baseline as a feature, then let XGBoost learn corrections. Provides physical grounding for long-horizon extrapolation when the data thins out.

### 7.3 Online learning

Currently the model retrains offline whenever `train.py` is rerun. A streaming setup would update the model as new data comes in, naturally adapting to current operating regime. Library options: River (Python), Vowpal Wabbit. Out of scope for a static portfolio dashboard.

### 7.4 Coke layer thickness back-calculation

Given measured skin TI, fluid temperature, and known tube geometry, back-calculate the coke layer thickness via the heat transfer equation. Useful as a target for direct prediction, and as a sanity check on skin TI trends.

### 7.5 Multi-pass interactions

Currently each pass's TC models use only that pass's drivers + whole-furnace drivers. Pass-to-pass coupling (e.g., hot pass → adjacent pass radiates heat to it) is ignored. Could add neighbour-pass features.

### 7.6 Multi-furnace transfer learning

Heaters in similar service (atmospheric residue, vacuum, etc.) have similar fouling physics. A model pretrained on one heater's full history could be fine-tuned for a sister heater with less data. Useful for new installations where data is scarce.

---

## 8. Reading list

### Primary references

- API 530, API 560, API 571, API RP 573 - the standards framework
- NACE SP0170 - PASCC management
- Ellis & Paul, "Delayed Coking Fundamentals" - [Mines.edu tutorial](https://people.mines.edu/jjechura/wp-content/uploads/sites/120/2019/02/DECOKTUT.pdf)

### Industry articles / best practice

- [Improving Coker Heater Run Length - CB&I 2016](https://refiningcommunity.com/wp-content/uploads/2016/08/Improving-Delayed-Coker-Heater-Run-Length-Catala-Faegh-CBI-DCU-Mumbai-2016.pdf)
- [Coker Heater Health Monitoring - Becht](https://becht.com/becht-blog/entry/coker-heater-health-monitoring-for-maximum-throughput-and-reliability/)
- [An introduction to fouling in fired heaters - DigitalRefining](https://www.digitalrefining.com/article/1002759/an-introduction-to-fouling-in-fired-heaters-part-1)
- [AFPM Q35 - Coker furnace fouling rates](https://www.afpm.org/data-reports/technical-papers/qa-search/question-35-what-are-your-major-parameters-and-mechanisms)
- [AFPM Q36 - Decoke decision indicators](https://www.afpm.org/print/pdf/node/41195)
- [How fouling and severity erode cracking furnace efficiency - Imubit](https://imubit.com/articles/cracking-furnace-efficiency)

### Academic / ML for furnace coking

- Shwartz-Ziv & Armon, "Tabular Data: Deep Learning is Not All You Need" - [arXiv 2021](https://arxiv.org/abs/2106.03253)
- McElfresh et al., "When Do Neural Nets Outperform Boosted Trees on Tabular Data" - [arXiv 2023](https://arxiv.org/pdf/2305.02997)
- "ML approach with a posteriori-based feature for thermal cracking furnace service life" - [ScienceDirect 2024](https://www.sciencedirect.com/science/article/pii/S2590123024006042)
- "ABC-ANFIS-CTF: Coking degree prediction" - [MDPI Processes 2019](https://www.mdpi.com/2227-9717/7/12/909)
- "Thermal control of coke furnace by data-driven approach" - [ScienceDirect 2022](https://www.sciencedirect.com/science/article/pii/S2772508122000011)
- "Prediction of heat exchanger fouling using ANN" - [ResearchGate 2024](https://www.researchgate.net/publication/383775021_Prediction_of_heat_exchanger_fouling_for_predictive_maintenance_using_artificial_neural_networks)

### Physics-informed and hybrid

- Cai et al., "Physics-Informed Neural Networks for Heat Transfer" - [ASME 2021](https://asmedigitalcollection.asme.org/heattransfer/article/143/6/060801/1104439/Physics-Informed-Neural-Networks-for-Heat-Transfer)
- "Physics-Informed hybrid ML for critical heat flux prediction" - [ScienceDirect 2025](https://www.sciencedirect.com/science/article/abs/pii/S0029549325006119)

### Uncertainty quantification

- "Confidence intervals for XGBoost" - [Towards Data Science](https://towardsdatascience.com/confidence-intervals-for-xgboost-cac2955a8fde/)
- "Prediction intervals when forecasting with ML models" - [Cienciadedatos](https://cienciadedatos.net/documentos/py42-forecasting-prediction-intervals-machine-learning.html)
- "Recursive multi-step forecasting" - [Skforecast docs](https://skforecast.org/0.9.1/user_guides/autoregresive-forecaster)

---

## 9. Summary - the 60-second version

- **Problem**: predict when each pass's tube skin TI hits 475 °C (the PASCC sensitization limit), to support decoke / soda ash decisions at the next turnaround.
- **Right model class for our data size and deployment**: gradient-boosted decision trees (XGBoost, LightGBM, or CatBoost - functionally interchangeable). Per the [tabular-data-deep-learning-is-not-all-you-need](https://arxiv.org/abs/2106.03253) literature, GBDTs beat NNs on small (<10K row) tabular industrial datasets nearly always.
- **Most important feature**: `days_since_run_start` (resets at each detected decoke). Without it, models smear different runs together and lose the fouling-curve signal.
- **Common pitfall**: training on shutdown / startup transients biases the model. Mask turnarounds and 3-day buffers around them.
- **Confidence band done right**: quantile regression with `reg:quantileerror` objective. 3 models per target (P10, P50, P90). Fully data-driven intervals; no σ × √d assumption.
- **The right operational headline**: not "central crosses 475" alone, but "central + upper band crosses 475". Otherwise wide bands are misleading.

---

*This primer accompanies the Ferriq Furnace Skin TI Predictor. It is not a substitute for vendor or regulatory documentation. For specific equipment decisions, defer to the responsible mechanical / process engineering authority and the relevant API / NACE standards.*
