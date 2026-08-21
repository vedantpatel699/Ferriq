# Furnace Skin TI Predictor - Training Report
Trained: 2026-05-03 04:39

Forecast horizon: 24 hours ahead.
Target: each individual radiant skin thermocouple - 3 quantile models per TC (P10, P50, P90).
Test split: chronological 80/20. Turnaround + upset rows excluded.

## Heater 1 (atmospheric residue, 4-pass)
- rows: 1896, span: 2020-08-16 00:00:00 to 2025-10-24 00:00:00
- cadence: 24 h
- excluded 119 rows (6.3%) from training (turnaround + upset)
- decoke events detected: 0 (none)
- rad_skin_p1_a (pass 1): train=1413 test=354 MAE_P50=0.932 C  R2_P50=0.48  empirical_80%_coverage=73.4%  median_band_width=8.39 C
- rad_skin_p1_b (pass 1): train=1413 test=354 MAE_P50=3.609 C  R2_P50=0.015  empirical_80%_coverage=63.6%  median_band_width=8.63 C
- rad_skin_p1_c (pass 1): train=1413 test=354 MAE_P50=2.402 C  R2_P50=0.442  empirical_80%_coverage=62.1%  median_band_width=5.62 C
- rad_skin_p1_d (pass 1): train=1414 test=354 MAE_P50=4.338 C  R2_P50=-0.486  empirical_80%_coverage=54.5%  median_band_width=14.9 C
- rad_skin_p2_a (pass 2): train=1413 test=354 MAE_P50=1.161 C  R2_P50=0.466  empirical_80%_coverage=84.2%  median_band_width=6.37 C
- rad_skin_p2_b (pass 2): train=1413 test=354 MAE_P50=0.903 C  R2_P50=0.42  empirical_80%_coverage=72.6%  median_band_width=4.32 C
- rad_skin_p2_c (pass 2): train=1414 test=354 MAE_P50=6.609 C  R2_P50=-1.493  empirical_80%_coverage=19.5%  median_band_width=13.13 C
- rad_skin_p2_d (pass 2): train=1414 test=354 MAE_P50=4.572 C  R2_P50=-0.178  empirical_80%_coverage=74.3%  median_band_width=17.58 C
- rad_skin_p3_a (pass 3): train=1413 test=354 MAE_P50=1.0 C  R2_P50=0.57  empirical_80%_coverage=89.3%  median_band_width=5.1 C
- rad_skin_p3_b (pass 3): train=1413 test=354 MAE_P50=2.037 C  R2_P50=-0.322  empirical_80%_coverage=61.3%  median_band_width=4.18 C
- rad_skin_p3_c (pass 3): train=1414 test=354 MAE_P50=8.683 C  R2_P50=-0.751  empirical_80%_coverage=64.4%  median_band_width=30.9 C
- rad_skin_p4_a (pass 4): train=1413 test=354 MAE_P50=0.939 C  R2_P50=0.478  empirical_80%_coverage=75.7%  median_band_width=4.19 C
- rad_skin_p4_b (pass 4): train=1413 test=354 MAE_P50=1.642 C  R2_P50=0.175  empirical_80%_coverage=68.4%  median_band_width=5.15 C
- rad_skin_p4_c (pass 4): train=1414 test=354 MAE_P50=3.091 C  R2_P50=-0.064  empirical_80%_coverage=47.5%  median_band_width=8.87 C
- rad_skin_p4_d (pass 4): train=1413 test=354 MAE_P50=1.781 C  R2_P50=0.527  empirical_80%_coverage=76.8%  median_band_width=7.85 C

## Heater 2 (vacuum tower, 4-pass)
- rows: 11992, span: 2020-04-06 00:00:00 to 2025-09-25 07:59:59.997000
- cadence: 4 h
- excluded 1418 rows (11.8%) from training (turnaround + upset)
- decoke events detected: 2 (2020-07-22, 2025-08-15)
- rad_skin_p1_a (pass 1): train=8410 test=2103 MAE_P50=3.797 C  R2_P50=0.429  empirical_80%_coverage=92.3%  median_band_width=20.97 C
- rad_skin_p1_b (pass 1): train=8410 test=2103 MAE_P50=3.905 C  R2_P50=0.451  empirical_80%_coverage=88.3%  median_band_width=14.12 C
- rad_skin_p1_c (pass 1): train=8408 test=2102 MAE_P50=5.466 C  R2_P50=0.434  empirical_80%_coverage=73.0%  median_band_width=7.66 C
- rad_skin_p2_a (pass 2): train=8409 test=2103 MAE_P50=4.74 C  R2_P50=0.411  empirical_80%_coverage=91.3%  median_band_width=23.36 C
- rad_skin_p2_b (pass 2): train=8410 test=2103 MAE_P50=5.148 C  R2_P50=0.447  empirical_80%_coverage=89.6%  median_band_width=16.43 C
- rad_skin_p2_c (pass 2): train=8410 test=2103 MAE_P50=4.409 C  R2_P50=0.469  empirical_80%_coverage=92.5%  median_band_width=29.53 C
- rad_skin_p3_a (pass 3): train=8411 test=2103 MAE_P50=3.743 C  R2_P50=0.518  empirical_80%_coverage=93.0%  median_band_width=14.45 C
- rad_skin_p3_b (pass 3): train=8408 test=2102 MAE_P50=4.813 C  R2_P50=0.477  empirical_80%_coverage=85.3%  median_band_width=8.98 C
- rad_skin_p3_c (pass 3): train=8408 test=2103 MAE_P50=6.694 C  R2_P50=0.375  empirical_80%_coverage=93.6%  median_band_width=17.13 C
- rad_skin_p4_a (pass 4): train=8408 test=2102 MAE_P50=5.859 C  R2_P50=0.225  empirical_80%_coverage=85.8%  median_band_width=20.41 C
- rad_skin_p4_b (pass 4): train=8409 test=2103 MAE_P50=6.794 C  R2_P50=0.367  empirical_80%_coverage=76.5%  median_band_width=18.23 C
- rad_skin_p4_c (pass 4): train=8411 test=2103 MAE_P50=31.944 C  R2_P50=-0.582  empirical_80%_coverage=21.7%  median_band_width=30.04 C

## Heater 3 (atmospheric, limited instrumentation)
- rows: 11994, span: 2020-04-06 00:00:00 to 2025-09-25 19:59:59.997000
- cadence: 4 h
- excluded 1566 rows (13.1%) from training (turnaround + upset)
- decoke events detected: 1 (2022-10-15)
- rad_skin_p1_a (pass 1): train=8190 test=2048 MAE_P50=2.175 C  R2_P50=0.034  empirical_80%_coverage=92.5%  median_band_width=8.84 C
- rad_skin_p1_b (pass 1): train=8190 test=2048 MAE_P50=0.764 C  R2_P50=0.021  empirical_80%_coverage=94.3%  median_band_width=8.71 C
